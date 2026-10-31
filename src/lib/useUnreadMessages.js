import { useEffect, useState } from 'react'
import { onValue, ref } from 'firebase/database'
import { dbRT } from './firebase'

export default function useUnreadMessages(uid) {
  const [unreadState, setUnreadState] = useState({ uid: null, count: 0 })

  useEffect(() => {
    if (!uid) return undefined

    let active = true
    const listeners = new Map()
    const readReceiptListeners = new Map()
    const unreadByConversation = new Map()
    const conversationData = new Map()
    const readReceiptTimes = new Map()
    const updateUnread = (id) => {
      const conversation = conversationData.get(id)
      if (!conversation) {
        unreadByConversation.delete(id)
      } else {
        const storedUnread = conversation.unread?.[uid]
        if (Number.isFinite(Number(storedUnread))) {
          unreadByConversation.set(id, Math.max(0, Number(storedUnread)))
        } else {
          const lastMessageTime = Number(conversation.lastMessageTime) || 0
          const lastReadTime =
            Number(conversation.lastRead?.[uid]) ||
            Number(readReceiptTimes.get(id)) ||
            0
          unreadByConversation.set(id, lastMessageTime > lastReadTime ? 1 : 0)
        }
      }
      setUnreadState({
        uid,
        count: [...unreadByConversation.values()].reduce((sum, count) => sum + count, 0),
      })
    }

    const unsubscribeIndex = onValue(ref(dbRT, `userConversations/${uid}`), (snapshot) => {
      const ids = Object.keys(snapshot.val() || {})
      for (const [id, unsubscribe] of listeners) {
        if (!ids.includes(id)) {
          unsubscribe()
          listeners.delete(id)
          readReceiptListeners.get(id)?.()
          readReceiptListeners.delete(id)
          conversationData.delete(id)
          readReceiptTimes.delete(id)
          unreadByConversation.delete(id)
        }
      }

      ids.forEach((id) => {
        if (listeners.has(id)) return
        const unsubscribe = onValue(ref(dbRT, `conversations/${id}`), (conversationSnapshot) => {
          if (!active) return
          conversationData.set(id, conversationSnapshot.val())
          updateUnread(id)
        }, (error) => console.error('Unread conversation subscription failed:', error))
        listeners.set(id, unsubscribe)
        const unsubscribeReadReceipt = onValue(
          ref(dbRT, `readReceipts/${id}/${uid}`),
          (readSnapshot) => {
            if (!active) return
            readReceiptTimes.set(id, readSnapshot.val())
            updateUnread(id)
          },
          (error) => console.error('Unread read-receipt subscription failed:', error),
        )
        readReceiptListeners.set(id, unsubscribeReadReceipt)
      })
      setUnreadState({
        uid,
        count: [...unreadByConversation.values()].reduce((sum, count) => sum + count, 0),
      })
    })

    return () => {
      active = false
      unsubscribeIndex()
      listeners.forEach((unsubscribe) => unsubscribe())
      readReceiptListeners.forEach((unsubscribe) => unsubscribe())
    }
  }, [uid])

  useEffect(() => {
    const count = unreadState.uid === uid ? unreadState.count : 0
    document.title = count > 0 ? `(${count}) Freelanso` : 'Freelanso'
  }, [uid, unreadState])

  return unreadState.uid === uid ? unreadState.count : 0
}
