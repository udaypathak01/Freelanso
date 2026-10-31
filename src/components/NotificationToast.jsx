import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import { markNotificationRead } from '../lib/data'
import useNotifications from '../lib/useNotifications'

const TOAST_DURATION_MS = 6000

const getToastKey = (notification) =>
  `${notification.recipientUid}:${notification.id}`

function playNotificationSound(context) {
  if (!context || context.state !== 'running') return

  const now = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(660, now)
  oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.1)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.23)
}

export default function NotificationToast() {
  const navigate = useNavigate()
  const [user, setUser] = useState(() => auth.getUser())
  const userRef = useRef(user)
  const [toasts, setToasts] = useState([])
  const { notifications, isLoaded } = useNotifications(user?.uid)
  const seenRef = useRef({ uid: null, ids: new Set() })
  const audioContextRef = useRef(null)
  const timersRef = useRef(new Map())

  useEffect(() => {
    const syncUser = () => {
      const nextUser = auth.getUser()
      if (userRef.current?.uid !== nextUser?.uid) {
        for (const timer of timersRef.current.values()) clearTimeout(timer)
        timersRef.current.clear()
        seenRef.current = { uid: null, ids: new Set() }
        setToasts([])
      }
      userRef.current = nextUser
      setUser(nextUser)
    }
    window.addEventListener('auth-change', syncUser)
    window.addEventListener('storage', syncUser)
    return () => {
      window.removeEventListener('auth-change', syncUser)
      window.removeEventListener('storage', syncUser)
    }
  }, [])

  useEffect(() => {
    const unlockAudio = () => {
      const AudioContextConstructor =
        window.AudioContext || window.webkitAudioContext
      if (!AudioContextConstructor || audioContextRef.current) return

      const context = new AudioContextConstructor()
      audioContextRef.current = context
      if (context.state === 'suspended') {
        context.resume().catch((error) => {
          console.warn('Notification sound could not be enabled:', error)
        })
      }
      document.removeEventListener('pointerdown', unlockAudio)
      document.removeEventListener('keydown', unlockAudio)
    }

    document.addEventListener('pointerdown', unlockAudio)
    document.addEventListener('keydown', unlockAudio)
    return () => {
      document.removeEventListener('pointerdown', unlockAudio)
      document.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  useEffect(() => {
    if (!user?.uid) {
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
      seenRef.current = { uid: null, ids: new Set() }
      return
    }
    if (!isLoaded) return

    if (seenRef.current.uid !== user.uid) {
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
      seenRef.current = {
        uid: user.uid,
        ids: new Set(notifications.map(({ id }) => id)),
      }
      return
    }

    const newNotifications = notifications.filter(
      ({ id }) => !seenRef.current.ids.has(id),
    )
    if (!newNotifications.length) return

    for (const notification of newNotifications) {
      seenRef.current.ids.add(notification.id)
      playNotificationSound(audioContextRef.current)
    }
    setToasts((current) => [
      ...current,
      ...newNotifications.map((notification) => ({
        ...notification,
        recipientUid: user.uid,
      })),
    ])
  }, [isLoaded, notifications, user?.uid])

  useEffect(() => {
    for (const toast of toasts) {
      const key = getToastKey(toast)
      if (timersRef.current.has(key)) continue
      const timer = setTimeout(() => {
        timersRef.current.delete(key)
        setToasts((current) =>
          current.filter((item) => getToastKey(item) !== key),
        )
      }, TOAST_DURATION_MS)
      timersRef.current.set(key, timer)
    }
  }, [toasts])

  useEffect(
    () => () => {
      for (const timer of timersRef.current.values()) clearTimeout(timer)
      timersRef.current.clear()
      audioContextRef.current?.close().catch((error) => {
        console.warn('Notification audio context could not be closed:', error)
      })
    },
    [],
  )

  const dismissToast = (notification) => {
    const key = getToastKey(notification)
    clearTimeout(timersRef.current.get(key))
    timersRef.current.delete(key)
    setToasts((current) =>
      current.filter((toast) => getToastKey(toast) !== key),
    )
  }

  const openToast = async (notification) => {
    try {
      if (notification.readAt == null) {
        await markNotificationRead(notification.id)
      }
    } catch (error) {
      console.error('Could not mark notification as read:', error)
    }
    dismissToast(notification)
    navigate(
      typeof notification.href === 'string' &&
        notification.href.startsWith('/')
        ? notification.href
        : '/notifications',
    )
  }

  const visibleToasts = toasts.filter(
    (notification) => notification.recipientUid === user?.uid,
  )
  if (!visibleToasts.length) return null

  return (
    <div
      aria-label="New notifications"
      aria-live="polite"
      className="fixed right-4 top-[72px] z-[300] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3"
    >
      {visibleToasts.map((notification) => (
        <div
          key={getToastKey(notification)}
          className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#15151a]/95 p-4 shadow-[0_16px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl [animation:notification-slide-in_250ms_ease-out]"
        >
          <button
            type="button"
            onClick={() => openToast(notification)}
            className="min-w-0 flex-1 text-left"
          >
            <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-[#4c91ff]">
              New notification
            </span>
            <span className="block truncate text-sm font-bold text-white">
              {notification.title || 'Freelanso update'}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#aaa]">
              {notification.body || 'You have a new update.'}
            </span>
            <span className="mt-2 block text-[10px] font-bold text-[#4c91ff]">
              View update
            </span>
          </button>
          <button
            type="button"
            onClick={() => dismissToast(notification)}
            aria-label="Dismiss notification"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#888] transition hover:bg-white/10 hover:text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
