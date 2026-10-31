import { useNavigate, useLocation } from 'react-router-dom'
import { auth } from '../lib/auth'
import useNotifications from '../lib/useNotifications'

const TABS = [
  {
    label: 'Home',
    to: '/',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )
  },
  {
    label: 'Explore',
    to: '/explore',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" strokeWidth={active ? "3" : "2"} />
      </svg>
    )
  },
  {
    label: 'Post',
    to: '/post-work',
    icon: () => (
      <div className="w-11 h-11 rounded-2xl bg-[#0066FF] shadow-[0_4px_20px_rgba(0,102,255,0.45)] flex items-center justify-center -mt-6 border-4 border-[#09090B]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
    ),
    special: true
  },
  {
    label: 'Alerts',
    to: '/notifications',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </svg>
    )
  },
  {
    label: 'Messages',
    to: '/messages',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    )
  },
  {
    label: 'Profile',
    to: '/profile',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  }
]

export default function MobileTabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = auth.getUser()
  const { unreadCount: unreadNotifications } = useNotifications(user?.uid)

  // Don't show on auth pages
  const hideOn = ['/login', '/signup']
  if (hideOn.includes(location.pathname)) return null

  return (
    <nav className="fixed bottom-0 inset-x-0 z-[200] lg:hidden bg-[#09090B]/95 backdrop-blur-xl border-t border-white/[0.06] flex items-end justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2" style={{paddingBottom: 'max(env(safe-area-inset-bottom), 8px)'}}>
      {TABS.map(tab => {
        const isActive = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to)
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.to)}
            className="flex flex-col items-center gap-1 flex-1 py-1 transition-all active:scale-90"
            style={{WebkitTapHighlightColor: 'transparent'}}
          >
            <span className={`relative ${tab.special ? '' : isActive ? 'text-[#0066FF]' : 'text-[#555]'}`}>
              {tab.icon(isActive)}
              {tab.to === '/notifications' && unreadNotifications > 0 && (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0066FF] px-1 text-[9px] font-black text-white">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </span>
            {!tab.special && (
              <span className={`text-[9px] font-black uppercase tracking-wider transition-colors ${isActive ? 'text-[#0066FF]' : 'text-[#444]'}`}>
                {tab.label}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
