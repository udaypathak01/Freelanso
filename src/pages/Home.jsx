import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { fetchServiceCategories } from '../lib/serviceData'

gsap.registerPlugin(ScrollTrigger)

/* ─── small shared helpers ─── */
const STEPS = [
  {
    icon: '🔍',
    step: 'Step 01',
    title: 'Browse Visually',
    body: 'Scroll through a curated Pinterest-style feed of real work — no resumes, just proof of skill.',
  },
  {
    icon: '⚡',
    step: 'Step 02',
    title: 'Hire Instantly',
    body: 'One tap to send an inquiry. Freelancers respond within hours, not days.',
  },
  {
    icon: '✅',
    step: 'Step 03',
    title: 'Get Results',
    body: 'Collaborate, review, and approve deliverables — all inside Freelanso.',
  },
]

export default function Home() {
  const containerRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesError, setCategoriesError] = useState('')
  const [categoriesRetry, setCategoriesRetry] = useState(0)
  const navigate = useNavigate()

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery)}`)
    } else {
      navigate('/explore')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchServiceCategories({ signal: controller.signal })
      .then(setCategories)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setCategories([])
          setCategoriesError(error.message || 'Unable to load categories.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCategoriesLoading(false)
      })
    return () => controller.abort()
  }, [categoriesRetry])

  const retryCategories = () => {
    setCategoriesLoading(true)
    setCategoriesError('')
    setCategoriesRetry((value) => value + 1)
  }

  useGSAP(() => {
  /* ── staggered hero entrance ── */
  gsap.from('.hero-eyebrow', { opacity: 0, y: 16, duration: 0.5 })
  gsap.from('.hero-h1 .line', { opacity: 0, y: 48, stagger: 0.1, duration: 0.7, delay: 0.15, ease: 'power3.out' })
  gsap.from('.hero-sub', { opacity: 0, y: 20, duration: 0.5, delay: 0.55 })
  gsap.from('.hero-btn', { opacity: 0, y: 16, stagger: 0.1, duration: 0.4, delay: 0.75 })
  gsap.from('.hero-stat', { opacity: 0, y: 12, stagger: 0.08, duration: 0.4, delay: 0.9 })

  /* ── floating cards ── */
  /* ── scroll-triggered entrance ── */
  gsap.fromTo('.services-title',
    { opacity: 0, x: -30 },
    {
      opacity: 1, x: 0, duration: 1,
      scrollTrigger: { trigger: '.services-section', start: 'top 85%' }
    }
  )

  gsap.fromTo('.step-block',
    // ... rest of the gsap animations ...
    { opacity: 0, y: 30 },
    {
      opacity: 1, y: 0, stagger: 0.12, duration: 0.8,
      ease: 'power4.out',
      scrollTrigger: {
        trigger: '.steps-section',
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
    }
  )
  gsap.fromTo('.cta-banner',
    { opacity: 0, scale: 0.95 },
    {
      opacity: 1, scale: 1, duration: 1,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.cta-section',
        start: 'top 88%',
        toggleActions: 'play none none none'
      },
    }
  )
}, { scope: containerRef })

  return (
  <div ref={containerRef} className="w-full">

    {/* ══════════════════════════════════════════
          HERO
      ══════════════════════════════════════════ */}
    <section className="relative w-full mx-auto flex flex-col items-center justify-center pt-20 md:pt-32 pb-16 md:pb-24 px-5 md:px-8 min-h-[100svh] md:min-h-[85vh] bg-grid overflow-hidden">
      {/* Glow orb */}
      <div
        className="absolute rounded-full w-[800px] h-[800px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-[60%] pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(0,102,255,0.06), transparent 60%)',
        }}
      />

      {/* Eyebrow badge */}
      <div className="hero-eyebrow relative z-10 inline-flex items-center gap-2 bg-[#0a1930] border border-[#18345E] text-[#60A5FA] text-[9px] md:text-[10px] font-bold uppercase tracking-widest rounded-full px-3 md:px-4 py-1.5 md:py-2 mb-6 md:mb-10">
        <span className="w-2 h-2 rounded-full bg-[#3B82F6] animate-pulse" />
        IN INDIA'S #1 VISUAL FREELANCE PLATFORM
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
      </div>

      {/* H1 */}
      <h1
        className="hero-h1 relative z-10 font-syne font-black leading-[0.9] text-center flex flex-col items-center tracking-[-0.04em]"
        style={{ fontSize: 'clamp(2.8rem,9vw,8.5rem)' }}
      >
        <span className="line text-[#FFFFFF] mb-1">Hire by</span>
        <span className="line text-[#0066FF] relative mb-1">
          seeing
          <span className="absolute -bottom-1 -left-[5%] right-0 w-[110%] h-[5px] md:h-[8px] bg-[#0066FF]"></span>
        </span>
        <span className="line text-[#4a4a4a] mt-2">the work.</span>
      </h1>

      {/* Subheading */}
      <p className="hero-sub relative z-10 text-[#888888] text-[0.88rem] md:text-[1.1rem] font-medium leading-[1.6] max-w-[500px] text-center mt-7 md:mt-12 mb-6 md:mb-10">
        Browse real portfolios. No guesswork — just India's best creative
        talent, all in one place.
      </p>

      {/* Search Bar */}
      <div className="hero-btn relative z-10 w-full max-w-[560px] flex flex-col sm:flex-row items-stretch gap-2 mb-6 md:mb-10">
        <div className="flex flex-1 items-center bg-[#171717] border border-white/5 rounded-[20px] p-1.5 focus-within:border-[#0066FF]/40 transition-all">
          <div className="pl-4 pr-2 text-t2">
            <svg className="w-5 h-5 text-[#666]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search designers, developers..."
            className="flex-1 bg-transparent border-none outline-none text-[#F0EDE8] py-3 text-[14px] placeholder:text-[#666] font-bold"
          />
        </div>
        <button
          onClick={handleSearch}
          className="bg-[#0066FF] hover:bg-[#0052CC] text-white rounded-[16px] px-6 py-3.5 font-bold text-sm transition-all shadow-[0_4px_20px_rgba(0,102,255,0.3)] active:scale-95"
        >
          Search
        </button>
      </div>

      {/* CTAs */}
      <div className="hero-ctas relative z-10 flex flex-col sm:flex-row gap-3 justify-center w-full sm:w-auto">
        <button
          onClick={() => navigate('/explore')}
          className="hero-stat bg-white hover:bg-gray-100 text-black rounded-full px-8 py-3.5 font-bold text-sm transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2"
        >
          Browse Talent <span className="font-light">→</span>
        </button>
        <button
          onClick={() => navigate('/post-work')}
          className="hero-stat bg-[#1a1a1a] hover:bg-[#252525] border border-white/5 text-white rounded-full px-8 py-3.5 font-bold text-sm transition-all hover:-translate-y-0.5 text-center"
        >
          Post Your Work
        </button>
      </div>
    </section>

    {/* Browse the canonical service categories returned by the API. */}
    <section className="services-section border-y border-white/5 bg-[#050505] py-14 md:py-20">
      <div className="mx-auto max-w-[1280px] px-5 md:px-8">
        <h2 className="services-title mb-8 font-syne text-3xl font-black tracking-tight text-white md:text-5xl">
          Explore by Category
        </h2>
        {categoriesError ? (
          <div className="text-sm text-red-300" role="alert">
            <p>{categoriesError}</p>
            <button
              onClick={retryCategories}
              className="mt-3 rounded-lg bg-white/10 px-4 py-2 font-bold text-white"
            >
              Retry
            </button>
          </div>
        ) : categoriesLoading ? (
          <p className="text-sm text-[#888]" role="status">Loading categories...</p>
        ) : categories.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => (
              <button
                key={category.slug}
                onClick={() => navigate(`/services?category=${encodeURIComponent(category.slug)}`)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left font-bold text-white transition hover:border-[#0066FF]/50 hover:bg-[#0066FF]/10"
              >
                {category.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#888]">No service categories are available.</p>
        )}
      </div>
    </section>

    {/* ══════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════ */}
    <section className="steps-section border-t border-white/5 py-12 md:py-16 px-5 md:px-8 max-w-[1280px] mx-auto">
      <div className="flex flex-col md:flex-row gap-8 md:gap-20 items-start">

        {/* Heading block */}
        <div className="shrink-0">
          <p className="text-t2 text-[10px] font-bold uppercase tracking-[1.2px] mb-3">
            How It Works
          </p>
          <h2 className="font-syne font-extrabold text-2xl md:text-3xl text-t0 leading-tight mb-3">
            Three steps<br />to hire.
          </h2>
          <p className="text-t1 text-sm leading-relaxed max-w-xs">
            No complicated onboarding. Just fast, friction-free hiring.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
          {STEPS.map((step) => (
            <div
              key={step.step}
              className="step-block bg-s1 border border-white/5 rounded-[18px] p-5 md:p-6 flex flex-col"
            >
              <div className="w-9 h-9 rounded-[10px] bg-acc/10 border border-acc/20 flex items-center justify-center text-lg mb-4">
                {step.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.8px] text-acc mb-2">
                {step.step}
              </span>
              <h3 className="font-syne font-bold text-[0.95rem] text-t0 mb-2">
                {step.title}
              </h3>
              <p className="text-t1 text-[0.78rem] leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    {/* ══════════════════════════════════════════
          CTA BANNER
      ══════════════════════════════════════════ */}
    <section className="cta-section border-t border-white/5 py-10 md:py-12 px-5 md:px-8 max-w-[1280px] mx-auto">
      <div className="cta-banner bg-gradient-to-br from-acc/10 to-acc2/5 border border-acc/20 rounded-2xl md:rounded-3xl p-7 md:p-12 flex flex-col items-start gap-6">
        <div>
          <p className="text-acc text-[10px] font-bold uppercase tracking-[1.2px] mb-3">
            For Freelancers
          </p>
          <h2 className="font-syne font-extrabold text-2xl md:text-4xl text-t0 leading-tight mb-3">
            Ready to showcase<br />your work?
          </h2>
          <p className="text-t1 text-sm leading-relaxed max-w-sm">
            Post your portfolio and make your work discoverable to clients.
          </p>
        </div>
        <button
          onClick={() => navigate('/signup')}
          className="w-full sm:w-auto bg-acc hover:bg-acc2 text-white font-bold rounded-xl px-8 py-4 text-sm transition-all active:scale-95 hover:shadow-[0_12px_32px_rgba(0,102,255,0.35)] text-center"
        >
          Start Posting →
        </button>
      </div>
    </section>

    {/* bottom padding */}
    <div className="h-16" />
    </div>
  )
}
