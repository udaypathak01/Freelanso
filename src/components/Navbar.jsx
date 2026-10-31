import { useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { auth } from '../lib/auth'
import Avatar from './Avatar'

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Explore', to: '/explore' },
  { label: 'Post Work', to: '/post-work' },
  { label: 'How it Works', to: '/how-it-works' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const containerRef = useRef(null)
  const mobileMenuRef = useRef(null)

  const [user, setUser] = useState(() => auth.getUser())
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  /* ── Scroll + auth listeners (non-GSAP, keep in useEffect-style via useGSAP cleanup) ── */
  useGSAP(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    const onAuthSync = () => setUser(auth.getUser())

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('auth-change', onAuthSync)
    window.addEventListener('storage', onAuthSync)

    /* ── Entrance animations ── */
    gsap.fromTo(containerRef.current, { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out' })
    gsap.fromTo('.nav-logo', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out', delay: 0.2 })
    gsap.fromTo('.nav-link', { opacity: 0, y: -10 }, { opacity: 1, y: 0, stagger: 0.05, duration: 0.5, delay: 0.4, ease: 'power3.out' })
    gsap.fromTo('.nav-auth', { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.5, delay: 0.6, ease: 'power3.out' })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('auth-change', onAuthSync)
      window.removeEventListener('storage', onAuthSync)
    }
  }, { scope: containerRef })

  /* ── Mobile menu slide-in ── */
  useGSAP(() => {
    if (mobileOpen && mobileMenuRef.current) {
      gsap.from(mobileMenuRef.current, { y: -20, opacity: 0, duration: 0.3, ease: 'power2.out' })
    }
  }, { scope: containerRef, dependencies: [mobileOpen] })

  const handleLogout = () => {
    auth.logout()
    setUser(null)
    navigate('/')
  }

  const isActive = (to) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to.split('#')[0]) && to !== '/'
  }

  return (
    <nav
      ref={containerRef}
      className={[
        'sticky top-0 z-50 h-[58px] flex items-center',
        'bg-bg/90 backdrop-blur-xl border-b border-white/5',
        'transition-shadow duration-300',
        scrolled ? 'shadow-[0_1px_0_rgba(255,255,255,0.06)]' : '',
      ].join(' ')}
    >
      <div className="max-w-[1280px] mx-auto w-full flex items-center justify-between px-8">

        {/* LOGO */}
        <div className="nav-logo flex items-center gap-2.5 cursor-pointer select-none" onClick={() => navigate('/')}>
          <div className="w-7 h-7 rounded-[7px] bg-acc flex items-center justify-center font-syne font-extrabold text-[13px] text-white shrink-0">F</div>
          <span className="font-syne font-black text-[1rem] text-white tracking-tight">Freelan<span className="text-[#0066FF]">so</span></span>
        </div>

        {/* NAV LINKS */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={[
                'nav-link text-[0.78rem] font-bold px-3.5 py-[7px] rounded-[7px]',
                'transition-all duration-150 cursor-pointer',
                isActive(link.to) ? 'text-white bg-white/10' : 'text-[#D1D1D1] hover:text-white hover:bg-white/5',
              ].join(' ')}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* RIGHT SIDE */}
        <div className="nav-auth hidden md:flex items-center gap-2">
          {user ? (
            <>
              <div 
                className="flex items-center gap-2 bg-s2 border border-white/9 rounded-full pl-0.5 pr-3.5 py-0.5 cursor-pointer hover:border-acc/40 transition-all"
                onClick={() => navigate('/profile')}
              >
                <Avatar 
                  src={user.avatar} 
                  name={user.name} 
                  size="w-7 h-7" 
                  className="rounded-full border-none" 
                />
                <span className="text-t0 text-[0.78rem] font-medium leading-none">
                  {user.name?.split(' ')[0] ?? 'User'}
                </span>
              </div>
              <button onClick={handleLogout} className="text-[#FAFAFA] hover:text-white text-xs font-bold px-4 py-[7px] rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/30 text-[0.75rem] font-bold px-4 py-[7px] rounded-lg transition-all"
              >
                Log in
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="bg-[#0066FF] hover:bg-[#0055EE] text-white text-[0.75rem] font-bold px-4 py-[7px] rounded-lg transition-all shadow-[0_4px_12px_rgba(0,102,255,0.3)]"
              >
                Sign up →
              </button>
            </>
          )}
        </div>

        {/* HAMBURGER */}
        <button
          className="md:hidden flex flex-col justify-center items-center gap-[5px] w-9 h-9 rounded-lg hover:bg-s3 transition-colors"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span className={['block w-5 h-[1.5px] bg-t0 transition-all duration-300 origin-center', mobileOpen ? 'rotate-45 translate-y-[6.5px]' : ''].join(' ')} />
          <span className={['block w-5 h-[1.5px] bg-t0 transition-all duration-300', mobileOpen ? 'opacity-0 scale-x-0' : ''].join(' ')} />
          <span className={['block w-5 h-[1.5px] bg-t0 transition-all duration-300 origin-center', mobileOpen ? '-rotate-45 -translate-y-[6.5px]' : ''].join(' ')} />
        </button>
      </div>

      {/* MOBILE MENU */}
      {mobileOpen && (
        <div ref={mobileMenuRef} className="mobile-menu md:hidden absolute top-[58px] left-0 right-0 bg-s1 border-b border-white/5 p-4 z-40">
          <div className="flex flex-col gap-1 mb-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={['text-sm font-bold px-4 py-3 rounded-[10px] transition-all', isActive(link.to) ? 'text-white bg-white/10' : 'text-[#A0A0B4] hover:text-white hover:bg-white/5'].join(' ')}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-2 py-1">
                  <div className="w-[26px] h-[26px] rounded-full bg-acc flex items-center justify-center font-syne font-extrabold text-[11px] text-white">
                    {user.name?.charAt(0).toUpperCase() ?? 'U'}
                  </div>
                  <span className="text-t0 text-sm font-medium">{user.name?.split(' ')[0] ?? 'User'}</span>
                </div>
                <button onClick={() => { handleLogout(); setMobileOpen(false) }} className="text-t1 text-sm font-semibold px-4 py-2.5 rounded-[8px] hover:bg-s3 hover:text-t0 transition-all text-left">
                  Logout
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { navigate('/login'); setMobileOpen(false) }} className="w-full text-center bg-white/5 border border-white/10 text-white text-sm font-bold px-4 py-3 rounded-xl transition-all hover:bg-white/10">
                  Log in
                </button>
                <button onClick={() => { navigate('/signup'); setMobileOpen(false) }} className="w-full text-center bg-[#0066FF] hover:bg-[#0055EE] text-white text-sm font-bold px-4 py-3 rounded-xl transition-all shadow-[0_4px_12px_rgba(0,102,255,0.3)]">
                  Sign up →
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
