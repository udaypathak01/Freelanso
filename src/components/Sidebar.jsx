import { useNavigate, useLocation } from 'react-router-dom'
import { auth } from '../lib/auth'
import Avatar from './Avatar'
import useUnreadMessages from '../lib/useUnreadMessages'

const NAV_ITEMS = [
  { label: 'Home', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', to: '/' },
  { label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', to: '/explore' },
  { label: 'Browse Jobs', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', to: '/jobs' },
  { label: 'Services', icon: 'M13 10V3L4 14h7v7l9-11h-7z', to: '/services' },
  { label: 'Battles', icon: 'M12 6c1.657 0 3 1.343 3 3s-1.343 3-3 3-3-1.343-3-3 1.343-3 3-3zm0 10c-3.314 0-6 2.686-6 6h12c0-3.314-2.686-6-6-6z M6 9l6 6m0-6l-6 6M7 8l10 10M17 8l-10 10', to: '/battles' },
  { label: 'Messages', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', to: '/messages' },
]

const BOTTOM_ITEMS = [
  { label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', to: '/profile' },
  { label: 'Dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2zm0 0h10a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2v12a2 2 0 002 2h2a2 2 0 002-2z', to: '/dashboard' },
  { label: 'Support', icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z', to: '/support' },
]

export default function Sidebar({ collapsed, setCollapsed }) {
  const navigate = useNavigate()
  const location = useLocation()
  const user = auth.getUser()
  const unreadMessages = useUnreadMessages(user?.uid)

  const handleLogout = async () => {
    await auth.logout()
    navigate('/login')
  }

  return (
    <aside className={`fixed left-0 top-0 h-screen bg-[#09090B] border-r border-[#15151A] flex flex-col pt-6 pb-4 px-3 overflow-hidden z-[60] transition-all duration-300 ${collapsed ? 'w-[78px]' : 'w-[240px]'}`}>

      {/* Brand logo & collapse */}
      <div className={`flex items-center mb-8 px-2 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-6 h-6 rounded-md bg-[#0066FF] flex items-center justify-center font-syne font-black text-xs text-white">F</div>
            <span className="font-syne font-black text-[1rem] text-white tracking-tight">freelan<span className="text-[#0066FF]">so</span></span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all ${collapsed ? 'rotate-180' : ''}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      </div>

      {/* Primary Links */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(item => {
          const active = item.to === '/messages'
            ? location.pathname.startsWith(item.to)
            : location.pathname === item.to
          return (
            <div
              key={item.label}
              onClick={() => navigate(item.to)}
              className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${active ? 'bg-[#121216] border border-white/5 shadow-inner' : 'hover:bg-white/[0.03]'
                } ${collapsed ? 'justify-center' : ''}`}
            >
              <svg
                className={`w-5 h-5 shrink-0 transition-colors ${active ? 'text-[#0066FF]' : 'text-[#666] group-hover:text-white'}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {!collapsed && (
                <span className={`text-[0.9rem] font-bold tracking-tight transition-colors ${active ? 'text-white' : 'text-[#888] group-hover:text-white'}`}>
                  {item.label}
                </span>
              )}
              {item.label === 'Messages' && unreadMessages > 0 && (
                <span className={`${collapsed ? 'absolute right-1 top-1' : 'ml-auto'} min-w-5 rounded-full bg-[#0066FF] px-1.5 py-0.5 text-center text-[9px] font-black text-white`}>
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
              {active && !collapsed && <div className="ml-auto w-1 h-4 rounded-full bg-[#0066FF]" />}
            </div>
          )
        })}

        {/* Action Button */}
        <div className={`pt-4 ${collapsed ? 'px-0 flex justify-center' : 'px-1'}`}>
          <button 
            onClick={() => navigate('/post-work')}
            className={`flex items-center gap-3 bg-[#0066FF]/5 hover:bg-[#0066FF]/10 border border-[#0066FF]/20 text-[#0066FF] font-black transition-all group ${collapsed ? 'w-10 h-10 rounded-xl justify-center p-0' : 'w-full px-4 py-3 rounded-2xl'}`}
          >
            <span className={`rounded-lg bg-[#0066FF] text-white flex items-center justify-center text-lg ${collapsed ? 'w-6 h-6 text-sm' : 'w-5 h-5'}`}>+</span>
            {!collapsed && <span>Add Post</span>}
          </button>
        </div>
      </nav>

      {/* Bottom Profile Section */}
      <div className="border-t border-[#15151A] pt-4 mt-auto space-y-0.5">
        {!collapsed && user && (
          <div className="px-4 py-3 flex items-center gap-3 mb-2 bg-white/[0.02] rounded-2xl border border-white/5 mx-1">
            <Avatar src={user.avatar} name={user.name} />
            <div className="min-w-0">
               <p className="text-[11px] font-black text-white truncate">{user.name}</p>
               <p className="text-[9px] font-bold text-[#666] truncate">{user.email}</p>
            </div>
          </div>
        )}

        {BOTTOM_ITEMS.map(item => {
          const active = location.pathname === item.to
          return (
            <button
              key={item.label}
              onClick={() => navigate(item.to)}
              className={`group w-full flex items-center gap-4 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent ${active ? 'bg-[#0066FF]/10 border-[#0066FF]/20 text-white' : 'hover:bg-white/[0.02] text-[#777] hover:text-white'} ${collapsed ? 'justify-center' : ''}`}
            >
              <svg
                className={`w-5 h-5 shrink-0 transition-colors ${active ? 'text-[#0066FF]' : 'group-hover:text-white'}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d={item.icon} />
              </svg>
              {!collapsed && <span className="text-[0.9rem] font-bold transition-colors">{item.label}</span>}
            </button>
          )
        })}

        <button
          onClick={handleLogout}
          className={`group w-full flex items-center gap-4 px-3.5 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent hover:bg-red-500/10 text-[#777] hover:text-red-400 ${collapsed ? 'justify-center' : ''}`}
        >
          <svg
            className="w-5 h-5 shrink-0 transition-colors group-hover:text-red-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {!collapsed && <span className="text-[0.9rem] font-bold transition-colors">Log Out</span>}
        </button>
      </div>

    </aside>
  )
}
