import { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Avatar from '../components/Avatar'
import { auth } from '../lib/auth'
import { dbRT } from '../lib/firebase'
import {
  fetchConversationMessages,
  fetchConversations,
  markConversationRead,
  sendConversationMessage,
} from '../lib/data'
import { 
  ref, 
  onValue, 
  push, 
  set, 
  onDisconnect,
  serverTimestamp,
  query,
  orderByKey,
  limitToLast,
  remove,
} from 'firebase/database'

function normalizeParticipants(participants) {
  if (Array.isArray(participants)) {
    return participants.filter((uid) => typeof uid === 'string' && uid.trim())
  }

  if (participants && typeof participants === 'object') {
    return Object.entries(participants)
      .filter(([uid, value]) => {
        if (typeof uid !== 'string' || !uid.trim()) return false
        if (value === true || typeof value === 'string') return true
        if (value && typeof value === 'object') return Object.keys(value).length > 0
        return false
      })
      .map(([uid, value]) => (typeof value === 'string' ? value : uid))
      .filter((uid) => typeof uid === 'string' && uid.trim())
  }

  return []
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => {
    if (message.tempId) byId.delete(message.tempId)
    byId.set(message.id, { ...byId.get(message.id), ...message, pending: false, queued: false, failed: false })
  })
  return [...byId.values()].sort(
    (left, right) => (left.createdAt || 0) - (right.createdAt || 0),
  )
}

function getMessagePreview(value) {
  if (typeof value === 'string') return value
  return typeof value?.text === 'string' ? value.text : ''
}

function formatMessageDay(timestamp) {
  return new Date(timestamp).toLocaleDateString([], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatLastSeen(timestamp) {
  if (!timestamp) return 'Offline'
  return `Last seen ${new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

function getConversationLoadError(error) {
  if (error?.status === 404 && error?.message === 'Route not found') {
    return 'The messaging API route is unavailable. Deploy the latest server API and verify VITE_API_URL points to it.'
  }
  return `Unable to load conversations: ${error.message}`
}

export default function Messages() {
  const user = useMemo(() => auth.getUser(), [])
  const navigate = useNavigate()
  const { conversationId } = useParams()
  const [searchParams] = useSearchParams()
  const [collapsed, setCollapsed] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sendError, setSendError] = useState('')
  const [historyCursor, setHistoryCursor] = useState(null)
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState({})
  const [isTyping, setIsTyping] = useState(false)
  const [othersTyping, setOthersTyping] = useState(false)
  
  const chatEndRef = useRef(null)
  const containerRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const threadRef = useRef(null)
  const sendingRef = useRef(new Set())
  const reconnectRetriedRef = useRef(new Set())
  const readPendingRef = useRef(new Set())
  const presenceListenersRef = useRef(new Map())
  const loadingOlderRef = useRef(false)
  const preserveScrollHeightRef = useRef(null)

  const requestedConversationId = conversationId || searchParams.get('convId')
  const messageContext = searchParams.get('context')

  // Load the REST summary first; RTDB then keeps it live.
  useEffect(() => {
    let active = true
    fetchConversations()
      .then((items) => {
        if (!active) return
        setConversations(items)
        setActiveId((current) => {
          if (requestedConversationId && items.some((item) => item.id === requestedConversationId)) {
            return requestedConversationId
          }
          if (current && items.some((item) => item.id === current)) return current
          return items[0]?.id ?? null
        })
      })
      .catch((error) => {
        if (active) setSendError(getConversationLoadError(error))
      })
    return () => { active = false }
  }, [requestedConversationId])

  useEffect(() => {
    if (!user) return
    let active = true
    const listeners = new Map()
    const indexRef = ref(dbRT, `userConversations/${user.uid}`)

    const unsubscribeIndex = onValue(indexRef, (snapshot) => {
      const ids = Object.keys(snapshot.val() || {})
      setActiveId((current) => {
        if (requestedConversationId) return requestedConversationId
        if (current && ids.includes(current)) return current
        return ids[0] || current || null
      })
      for (const [id, unsubscribe] of listeners) {
        if (!ids.includes(id)) {
          unsubscribe()
          listeners.delete(id)
          setConversations((current) => current.filter((conversation) => conversation.id !== id))
        }
      }

      ids.forEach((id) => {
        if (listeners.has(id)) return
        const unsubscribe = onValue(ref(dbRT, `conversations/${id}`), (conversationSnapshot) => {
          if (!active) return
          const value = conversationSnapshot.val()
          if (!value) {
            setConversations((current) => current.filter((conversation) => conversation.id !== id))
            return
          }
          const participants = normalizeParticipants(value.participants)
          if (!participants.includes(user.uid)) return
          const conversation = { id, ...value, participants }
          setConversations((current) => [
            conversation,
            ...current.filter((item) => item.id !== id),
          ])
        })
        listeners.set(id, unsubscribe)
      })
    }, (error) => {
      if (active) setSendError(getConversationLoadError(error))
    })

    return () => {
      active = false
      unsubscribeIndex()
      listeners.forEach((unsubscribe) => unsubscribe())
    }
  }, [user, requestedConversationId])

  // Firebase Realtime Database is the authenticated live delivery transport.
  useEffect(() => {
    if (!user) return undefined
    let currentPresenceRef = null
    const lastSeenRef = ref(dbRT, `presence/${user.uid}/lastSeen`)
    const connectionListener = onValue(ref(dbRT, '.info/connected'), async (snapshot) => {
      const connected = snapshot.val() === true
      setIsConnected(connected)
      if (!connected) {
        currentPresenceRef = null
        return
      }

      const connectionId = push(ref(dbRT, `presence/${user.uid}/connections`)).key
      if (!connectionId) return
      currentPresenceRef = ref(dbRT, `presence/${user.uid}/connections/${connectionId}`)
      try {
        await onDisconnect(currentPresenceRef).remove()
        await onDisconnect(lastSeenRef).set(serverTimestamp())
        await set(currentPresenceRef, true)
      } catch (error) {
        setSendError(`Unable to update online status: ${error.message}`)
      }
    }, (error) => setSendError(`Realtime connection failed: ${error.message}`))

    return () => {
      connectionListener()
      if (currentPresenceRef) void remove(currentPresenceRef)
      void set(lastSeenRef, Date.now()).catch((error) => {
        console.error('Unable to update last-seen status:', error.message)
      })
    }
  }, [user])

  useEffect(() => {
    const activeUids = new Set(
      conversations
        .flatMap((conversation) => normalizeParticipants(conversation.participants))
        .filter((uid) => uid !== user?.uid),
    )
    presenceListenersRef.current.forEach((_unsubscribe, uid) => {
      if (!activeUids.has(uid)) {
        presenceListenersRef.current.get(uid)?.()
        presenceListenersRef.current.delete(uid)
      }
    })
    activeUids.forEach((uid) => {
      if (presenceListenersRef.current.has(uid)) return
      const unsubscribe = onValue(ref(dbRT, `presence/${uid}`), (snapshot) => {
        const presence = snapshot.val() || {}
        const isOnline = Object.values(presence.connections || {}).some((value) => value === true)
        setOnlineUsers((current) => ({
          ...current,
          [uid]: { online: isOnline, lastSeen: presence.lastSeen ?? null },
        }))
      }, (error) => setSendError(`Unable to load user presence: ${error.message}`))
      presenceListenersRef.current.set(uid, unsubscribe)
    })
  }, [conversations, user?.uid])

  useEffect(() => () => {
    presenceListenersRef.current.forEach((unsubscribe) => unsubscribe())
    presenceListenersRef.current.clear()
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
  }, [])

  // Load the latest history page from REST and merge live RTDB updates into it.
  useEffect(() => {
    if (!activeId || !user) return
    let active = true
    setMessages([])
    setHistoryCursor(null)
    setHasOlderMessages(false)
    fetchConversationMessages(activeId)
      .then((page) => {
        if (!active) return
        setMessages((current) => mergeMessages(current, page.items))
        setHistoryCursor(page.nextCursor)
        setHasOlderMessages(page.hasMore)
        if (page.items.some((message) => message.senderId !== user.uid && !message.readAt)) {
          markConversationRead(activeId).catch((error) => {
            if (active) setSendError(`Unable to mark messages as read: ${error.message}`)
          })
        }
      })
      .catch((error) => {
        if (active) setSendError(`Unable to load message history: ${error.message}`)
      })

    const msgsRef = query(ref(dbRT, `messages/${activeId}`), orderByKey(), limitToLast(30))
    const typingRef = ref(dbRT, `typing/${activeId}`)

    const unsubMsgs = onValue(msgsRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const incoming = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
        setMessages((current) => mergeMessages(current, incoming))
        const hasUnreadIncoming = incoming.some(
          (message) => message.senderId !== user.uid && !message.readAt,
        )
        if (hasUnreadIncoming && !readPendingRef.current.has(activeId)) {
          readPendingRef.current.add(activeId)
          markConversationRead(activeId)
            .catch((error) => setSendError(`Unable to mark messages as read: ${error.message}`))
            .finally(() => readPendingRef.current.delete(activeId))
        }
      }
    }, (error) => setSendError(`Unable to load messages: ${error.message}`))

    // Listen for typing indicator
    const unsubTyping = onValue(typingRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const typingUsers = Object.keys(data).filter(uid => uid !== user.uid && data[uid])
        setOthersTyping(typingUsers.length > 0)
      } else {
        setOthersTyping(false)
      }
    })

    return () => {
      active = false
      unsubMsgs()
      unsubTyping()
    }
  }, [activeId, user])

  const loadOlderMessages = useCallback(async () => {
    if (!activeId || !historyCursor || !hasOlderMessages || loadingOlderRef.current) return
    const scrollElement = threadRef.current
    const oldHeight = scrollElement?.scrollHeight ?? 0
    loadingOlderRef.current = true
    preserveScrollHeightRef.current = oldHeight
    setLoadingOlder(true)
    try {
      const page = await fetchConversationMessages(activeId, { before: historyCursor })
      setMessages((current) => mergeMessages(page.items, current))
      setHistoryCursor(page.nextCursor)
      setHasOlderMessages(page.hasMore)
    } catch (error) {
      preserveScrollHeightRef.current = null
      setSendError(`Unable to load older messages: ${error.message}`)
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [activeId, hasOlderMessages, historyCursor])

  const activeConv = useMemo(() => 
    conversations.find(c => c.id === activeId),
    [activeId, conversations]
  )
  const activeOtherUserId = activeConv
    ? normalizeParticipants(activeConv.participants).find((uid) => uid !== user?.uid)
    : null

  const filteredConversations = useMemo(() => 
    conversations.filter(c => {
      const participants = normalizeParticipants(c.participants)
      const otherUserId = participants.find(uid => uid !== user?.uid)
      const otherUser = c.userInfo?.[otherUserId]
      return (otherUser?.name || '').toLowerCase().includes(search.toLowerCase())
    }),
    [search, conversations, user?.uid]
  )

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useLayoutEffect(() => {
    if (preserveScrollHeightRef.current !== null && threadRef.current) {
      threadRef.current.scrollTop +=
        threadRef.current.scrollHeight - preserveScrollHeightRef.current
      preserveScrollHeightRef.current = null
      return
    }
    scrollToBottom()
  }, [messages, othersTyping])

  const transmitMessage = useCallback(async (text, tempId) => {
    if (!activeId || sendingRef.current.has(tempId)) return
    sendingRef.current.add(tempId)
    setSendError('')
    try {
      const message = await sendConversationMessage(activeId, text, tempId)
      setMessages((current) => mergeMessages(current, [message]))
      reconnectRetriedRef.current.delete(tempId)
    } catch (error) {
      setMessages((current) => current.map((message) =>
        message.tempId === tempId
          ? { ...message, pending: false, queued: false, failed: true }
          : message,
      ))
      setSendError(error.message || 'Unable to send message. Retry when reconnected.')
    } finally {
      sendingRef.current.delete(tempId)
    }
  }, [activeId])

  const submitMessage = (text, tempId = crypto.randomUUID()) => {
    const optimistic = {
      id: tempId,
      tempId,
      senderId: user.uid,
      text,
      createdAt: Date.now(),
      pending: true,
      queued: false,
      failed: false,
    }
    setMessages((current) => mergeMessages(current, [optimistic]))
    handleTyping(false)
    void transmitMessage(text, tempId)
  }

  const handleSend = (e) => {
    e.preventDefault()
    const text = newMessage.trim()
    if (!text || text.length > 2000 || !activeId || !user) return
    setNewMessage('')
    submitMessage(text)
  }

  const retryMessage = (message) => {
    setMessages((current) => current.map((item) =>
      item.tempId === message.tempId
        ? { ...item, pending: true, failed: false, queued: false }
        : item,
    ))
    reconnectRetriedRef.current.delete(message.tempId)
    void transmitMessage(message.text, message.tempId)
  }

  const wasConnectedRef = useRef(false)
  useEffect(() => {
    if (!isConnected) {
      wasConnectedRef.current = false
      return
    }
    if (wasConnectedRef.current) return
    wasConnectedRef.current = true
    messages
      .filter((message) => message.tempId && (message.queued || message.failed))
      .forEach((message) => {
        if (reconnectRetriedRef.current.has(message.tempId)) return
        reconnectRetriedRef.current.add(message.tempId)
        setMessages((current) => current.map((item) =>
          item.tempId === message.tempId
            ? { ...item, pending: true, queued: false, failed: false }
            : item,
        ))
        void transmitMessage(message.text, message.tempId)
      })
  }, [isConnected, messages, transmitMessage])

  const handleTyping = (status) => {
    if (!activeId || !user) return
    const myTypingRef = ref(dbRT, `typing/${activeId}/${user.uid}`)
    set(myTypingRef, status).catch((error) => {
      setSendError(`Unable to update typing status: ${error.message}`)
    })
    // Automatically clear typing if user disconnects
    onDisconnect(myTypingRef).set(false).catch((error) => {
      setSendError(`Unable to register typing cleanup: ${error.message}`)
    })
  }

  const onInputChange = (e) => {
    setNewMessage(e.target.value)
    if (!isTyping) {
      setIsTyping(true)
      handleTyping(true)
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      handleTyping(false)
    }, 2000)
  }

  return (
    <div className="flex h-screen bg-[#09090B] text-white overflow-hidden" ref={containerRef}>
      <div className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? 'w-[78px]' : 'w-[240px]'}`}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Converation List */}
        <div className={`${activeId ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] border-r border-white/5 flex-col pt-8`}>
          <div className="px-6 mb-8">
            <h1 className="text-2xl font-black uppercase tracking-tight mb-6">Messages</h1>
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444]" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats..." 
                className="w-full bg-[#121216] border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none focus:border-[#0066FF]/30 transition-all font-bold placeholder-[#333]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-10">
            {filteredConversations.length === 0 && (
              <p className="px-4 py-10 text-center text-sm font-bold text-[#666]">
                {conversations.length ? 'No conversations match your search.' : 'No conversations yet'}
              </p>
            )}
            {filteredConversations.map(conv => {
              const participantsList = normalizeParticipants(conv.participants)
              const otherUserId = participantsList.find(uid => uid !== user?.uid)
              const otherUser = conv.userInfo?.[otherUserId] || { name: 'Chat' }
              
              const myLastRead = conv.lastRead?.[user?.uid] || 0
              const storedUnread = conv.unread?.[user?.uid]
              const unreadCount = Number.isFinite(Number(storedUnread))
                ? Math.max(0, Number(storedUnread))
                : Number(myLastRead) < (Number(conv.lastMessageTime) || 0) ? 1 : 0
              const isUnread = unreadCount > 0
              const preview = getMessagePreview(conv.lastMessage)
              const otherOnline = onlineUsers[otherUserId]?.online ?? otherUser.isOnline

              return (
                <button 
                  key={conv.id} 
                  onClick={() => {
                    setActiveId(conv.id)
                    navigate(`/messages/${encodeURIComponent(conv.id)}`, { replace: true })
                  }}
                  className={`conv-item w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeId === conv.id ? 'bg-[#0066FF]/10 border border-[#0066FF]/20 shadow-[inset_0_0_20px_rgba(0,102,255,0.05)]' : 'hover:bg-white/[0.03] border border-transparent'}`}
                >
                  <div className="relative shrink-0">
                    <Avatar src={otherUser.avatar} name={otherUser.name} size="w-12 h-12" className="rounded-2xl border-white/5" />
                    {otherOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-[#09090B] rounded-full" />}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[0.9rem] font-black truncate">{otherUser.name}</span>
                      <span className="text-[10px] font-bold text-[#444]">
                        {conv.lastMessageTime ? new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      </span>
                    </div>
                    <p className={`text-[11px] font-bold truncate leading-normal ${isUnread ? 'text-white' : 'text-[#666]'}`}>
                      {preview}
                    </p>
                  </div>
                  {isUnread && (
                    <span className="min-w-5 rounded-full bg-[#0066FF] px-1.5 py-0.5 text-center text-[9px] font-black text-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className={`${activeId ? 'flex' : 'hidden md:flex'} flex-1 flex-col relative bg-[#09090B]`}>
          {/* Header */}
          <div className="chat-header h-[88px] border-b border-white/5 px-8 flex items-center justify-between shrink-0 bg-[#09090B]/50 backdrop-blur-xl z-20">
            {activeConv ? (<>
              <button
                type="button"
                onClick={() => navigate('/messages')}
                className="mr-3 rounded-lg bg-white/5 px-3 py-2 text-xs font-bold text-white md:hidden"
                aria-label="Back to conversations"
              >
                Back
              </button>
              {(() => {
               const participants = normalizeParticipants(activeConv.participants)
               const otherUserId = participants.find(p => p !== user?.uid)
               const otherUser = activeConv.userInfo?.[otherUserId] || { name: 'Chat' }
               const otherOnline = onlineUsers[otherUserId]?.online ?? otherUser.isOnline
               return (
                 <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar src={otherUser.avatar} name={otherUser.name} size="w-11 h-11" className="rounded-2xl border-white/5" />
                    {otherOnline && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-[#09090B] rounded-full" />}
                  </div>
                  <div>
                    <h2 className="text-[1.05rem] font-black">{otherUser.name}</h2>
                    <div className="flex items-center gap-1.5 h-4">
                      {othersTyping ? (
                        <span className="text-[9px] font-black uppercase tracking-widest text-[#0066FF] animate-pulse">Typing...</span>
                      ) : (
                        <span className={`text-[10px] font-black uppercase tracking-widest ${otherOnline ? 'text-green-500' : 'text-[#555]'}`}>
                          {otherOnline ? 'Online' : formatLastSeen(onlineUsers[otherUserId]?.lastSeen)}
                        </span>
                      )}
                      {!isConnected && <span className="text-[10px] font-bold text-amber-300">Reconnecting...</span>}
                    </div>
                  </div>
                </div>
               )
              })()}
            </>) : (
              <p className="text-sm font-bold text-[#666]">Select a conversation to start messaging.</p>
            )}
            
            <div className="flex items-center gap-3">
               <button className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-all text-[#666] hover:text-white">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
               </button>
               <button className="w-10 h-10 rounded-xl bg-[#0066FF] flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-white shadow-[0_0_20px_rgba(0,102,255,0.3)]">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
               </button>
            </div>
          </div>

          {/* Messages Thread */}
          <div
            ref={threadRef}
            onScroll={(event) => {
              if (event.currentTarget.scrollTop < 50) void loadOlderMessages()
            }}
            className="flex-1 overflow-y-auto p-5 md:p-10 space-y-8 scroll-smooth pb-24"
          >
            {loadingOlder && <p className="text-center text-xs font-bold text-[#666]">Loading older messages...</p>}
            {(messageContext || activeConv?.postTitle) && activeConv && (
              <div className="rounded-xl border border-[#0066FF]/20 bg-[#0066FF]/5 px-4 py-3 text-xs font-bold text-[#9BBFFF]">
                Regarding: {messageContext || activeConv.postTitle}
              </div>
            )}
            {sendError && <p role="alert" className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{sendError}</p>}
            {!messages.length && activeConv && (
              <p className="py-8 text-center text-sm font-bold text-[#666]">No messages yet. Send the first message.</p>
            )}
            {messages.map((msg, index) => {
              const isMe = msg.senderId === user?.uid
              const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'
              const day = msg.createdAt ? formatMessageDay(msg.createdAt) : ''
              const previousDay = index > 0 && messages[index - 1].createdAt
                ? formatMessageDay(messages[index - 1].createdAt)
                : ''
              
              return (
                <div key={msg.id}>
                  {day && day !== previousDay && (
                    <p className="my-4 text-center text-[10px] font-black uppercase tracking-widest text-[#555]">{day}</p>
                  )}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] group ${isMe ? 'items-end' : 'items-start'}`}>
                    <div className={`px-6 py-4 rounded-[24px] text-sm font-bold leading-relaxed shadow-sm transition-all ${isMe ? 'bg-[#0066FF] text-white rounded-tr-[4px]' : 'bg-[#121216] border border-white/5 text-white/90 rounded-tl-[4px]'}`}>
                      {msg.text}
                    </div>
                    <div className={`flex items-center gap-2 mt-2 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[9px] font-black text-[#444] uppercase tracking-wider">{time}</span>
                        {isMe && (
                          <svg className="text-[#0066FF]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            {msg.failed ? null : msg.pending ? (
                              <circle cx="12" cy="12" r="8" />
                            ) : msg.readAt ? (
                              <><path d="M3 12l5 5L20 5" /><path d="M9 12l3 3 9-9" /></>
                            ) : msg.deliveredAt ? (
                              <><path d="M3 12l5 5L20 5" /><path d="M7 12l2 2" /></>
                            ) : <path d="M20 6L9 17l-5-5" />}
                          </svg>
                        )}
                        {isMe && msg.failed && (
                          <button
                            type="button"
                            onClick={() => retryMessage(msg)}
                            className="text-[9px] font-black text-red-400 hover:text-red-300"
                          >
                            Failed - retry
                          </button>
                        )}
                        {isMe && msg.queued && <span className="text-[9px] font-bold text-amber-300">Queued</span>}
                    </div>
                  </div>
                  </div>
                </div>
              )
            })}
            <div ref={chatEndRef} />
          </div>

          {/* Input Bar */}
          {activeConv && <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-[90%] z-20">
            <form onSubmit={handleSend} className="bg-[#121216]/80 backdrop-blur-2xl border border-white/5 rounded-3xl p-2 px-4 md:px-6 flex items-center gap-3 md:gap-4 shadow-2xl">
              <button type="button" className="text-[#555] hover:text-[#0066FF] transition-colors">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
              </button>
              <textarea
                value={newMessage}
                onChange={onInputChange}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSend(event)
                  }
                }}
                maxLength={2000}
                rows={1}
                placeholder="Type a message..." 
                className="flex-1 resize-none bg-transparent py-4 text-sm font-bold outline-none placeholder-[#333]"
              />
              <button 
                type="submit"
                disabled={!newMessage.trim() || newMessage.trim().length > 2000}
                className="w-12 h-12 bg-[#0066FF] text-white rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition-all shadow-[0_10px_20px_rgba(0,102,255,0.2)]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="rotate-45 -translate-x-0.5 translate-y-0.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
              </button>
            </form>
          </div>}
        </div>

        {/* User Info Sidebar (Right) */}
        <div className="hidden xl:flex w-[300px] border-l border-white/5 flex-col p-8 pt-10">
           {activeConv && (() => {
              const participants = normalizeParticipants(activeConv.participants)
              const otherUserId = participants.find(p => p !== user?.uid)
              const otherUser = activeConv.userInfo?.[otherUserId] || { name: 'Chat' }
              return (
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                      <Avatar src={otherUser.avatar} name={otherUser.name} size="w-24 h-24" className="rounded-[32px] border-2 border-white/5 p-1" />
                      {(onlineUsers[otherUserId]?.online ?? otherUser.isOnline) && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-4 border-[#09090B] rounded-full" />}
                  </div>
                  <h3 className="text-[1.2rem] font-black mb-1">{otherUser.name}</h3>
                  <p className="text-[11px] font-black text-[#555] uppercase tracking-[2px]">Professional Talent</p>
                </div>
              )
           })()}

           <div className="mt-12 space-y-6">
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#444] mb-4">Actions</h4>
                <div className="grid grid-cols-1 gap-2">
                   <button
                     type="button"
                     onClick={() => activeOtherUserId && navigate(`/profile/${encodeURIComponent(activeOtherUserId)}`)}
                     className="w-full text-left bg-white/[0.02] border border-white/5 px-5 py-3 rounded-xl text-xs font-bold text-[#888] hover:text-[#0066FF] hover:border-[#0066FF]/30 transition-all flex items-center justify-between group"
                   >
                     View Profile
                     <svg className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                   </button>
                   <button className="w-full text-left bg-white/[0.02] border border-white/5 px-5 py-3 rounded-xl text-xs font-bold text-[#888] hover:text-[#0066FF] hover:border-[#0066FF]/30 transition-all flex items-center justify-between group">
                     Create Contract
                     <svg className="opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                   </button>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#444] mb-4">Shared Media</h4>
                <p className="text-xs text-[#666]">Shared media will appear here.</p>
              </div>
           </div>
        </div>
      </main>
    </div>
  )
}
