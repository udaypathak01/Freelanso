import { useNavigate, useLocation } from 'react-router-dom'

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
    label: 'Jobs',
    to: '/jobs',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18m-12 0v2h6v-2" strokeWidth={active ? "2.5" : "2"} />
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
    label: 'Dashboard',
    to: '/dashboard',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="8" rx="1.5" fill={active ? 'currentColor' : 'none'} />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
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

  // Don't show on auth pages
  const hideOn = ['/login', '/signup']
  if (hideOn.includes(location.pathname)) return null

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 inset-x-0 z-[200] lg:hidden bg-[#09090B]/95 backdrop-blur-xl border-t border-white/[0.06] flex items-end justify-around px-1 pb-[env(safe-area-inset-bottom)] pt-2" style={{paddingBottom: 'max(env(safe-area-inset-bottom), 8px)'}}>
      {TABS.map(tab => {
        const isActive = tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to)
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.to)}
            aria-label={tab.label === 'Jobs' ? 'Browse jobs' : tab.label}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 py-1 transition-all active:scale-90"
            style={{WebkitTapHighlightColor: 'transparent'}}
          >
            <span className={`relative ${tab.special ? '' : isActive ? 'text-[#0066FF]' : 'text-[#555]'}`}>
              {tab.icon(isActive)}
            </span>
            {!tab.special && (
              <span className={`whitespace-nowrap text-[8px] font-black uppercase tracking-wide transition-colors ${isActive ? 'text-[#0066FF]' : 'text-[#444]'}`}>
                {tab.label}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
