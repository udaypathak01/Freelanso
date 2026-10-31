import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/* ─── DATA ─── */
const CLIENT_STEPS = [
  {
    num: '01',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
    ),
    title: 'Browse the Feed',
    desc: 'Scroll through a visually curated, Pinterest-style discovery board of real creative work — no resumes, no guesswork. Just undeniable proof of skill.',
    color: '#0066FF',
    glow: 'rgba(0,102,255,0.25)',
    tag: 'Discovery',
  },
  {
    num: '02',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: 'Review Profiles',
    desc: 'Review a freelancer\'s public profile, portfolio, skills, and available listing details before reaching out.',
    color: '#8B5CF6',
    glow: 'rgba(139,92,246,0.25)',
    tag: 'Research',
  },
  {
    num: '03',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92V19a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.82 19.79 19.79 0 012 1.18 2 2 0 014 0h2.09a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L7.43 7.51a16 16 0 006.06 6.06l.89-.89a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
      </svg>
    ),
    title: 'Hire Instantly',
    desc: 'Use built-in messaging to discuss scope, timelines, and deliverables with a freelancer.',
    color: '#10B981',
    glow: 'rgba(16,185,129,0.25)',
    tag: 'Action',
  },
  {
    num: '04',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Pay Securely',
    desc: 'Agree on payment terms directly. Secure payments and escrow are not yet available through Freelanso.',
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.25)',
    tag: 'Security',
  },
]

const FREELANCER_STEPS = [
  {
    num: '01',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    title: 'Build Your Profile',
    desc: 'Create a stunning, portfolio-forward profile showcasing your best work. Add skills, experience, and a standout bio — your profile IS your pitch.',
    color: '#0066FF',
    glow: 'rgba(0,102,255,0.25)',
    tag: 'Setup',
  },
  {
    num: '02',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    ),
    title: 'Post Your Work',
    desc: 'Upload your project media, add a description and price, then publish it for clients to discover.',
    color: '#8B5CF6',
    glow: 'rgba(139,92,246,0.25)',
    tag: 'Publish',
  },
  {
    num: '03',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
      </svg>
    ),
    title: 'Get Discovered',
    desc: 'Clients can discover your published projects in the visual marketplace.',
    color: '#10B981',
    glow: 'rgba(16,185,129,0.25)',
    tag: 'Growth',
  },
  {
    num: '04',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
      </svg>
    ),
    title: 'Get Paid Fast',
    desc: 'Review your listing activity from the dashboard. Withdrawal requests are internal and do not initiate a payout.',
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.25)',
    tag: 'Income',
  },
]

const FAQS = [
  { q: 'Can I create an account and post work?', a: 'You can create a profile and publish project listings from your account.' },
  { q: 'How is Freelanso different from other platforms?', a: 'Freelanso is built around visual proof of skill — not just ratings and text profiles. Clients discover you through your actual work in a premium, visual feed — similar to a social platform but purpose-built for hiring.' },
  { q: 'What types of work can I post?', a: 'Any creative or digital skill — UI/UX Design, Web Development, Video Editing, Logo Design, Animation, Copywriting, Social Media, Motion Graphics, Photography, and more.' },
  { q: 'How do payments work?', a: 'Payments and escrow are not yet available through Freelanso. Do not share sensitive payment details in messages.' },
  { q: 'Can I work as both a client and a freelancer?', a: 'Yes! Your single Freelanso account can be used to both post projects as a freelancer and hire others as a client — seamlessly from the same dashboard.' },
  { q: 'How quickly can I start getting work?', a: 'Discovery and response times vary. Complete profiles and clear project listings can help clients understand your work.' },
]

/* ─── COMPONENT ─── */
export default function HowItWorks() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('client')
  const [openFAQ, setOpenFAQ] = useState(null)
  const containerRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance
      gsap.from('.hiw-hero-eyebrow', { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out' })
      gsap.from('.hiw-hero-h1 span', { y: 60, opacity: 0, stagger: 0.12, duration: 0.8, delay: 0.1, ease: 'power4.out' })
      gsap.from('.hiw-hero-sub', { y: 20, opacity: 0, duration: 0.6, delay: 0.55, ease: 'power3.out' })
      gsap.from('.hiw-hero-cta', { y: 16, opacity: 0, stagger: 0.1, duration: 0.5, delay: 0.75 })

      // Step cards
      gsap.fromTo('.step-card',
        { y: 40, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, stagger: 0.12, duration: 0.8, ease: 'power3.out',
          scrollTrigger: { trigger: '.steps-grid', start: 'top 80%' } }
      )

      // FAQ
      gsap.fromTo('.faq-row',
        { x: -20, opacity: 0 },
        { x: 0, opacity: 1, stagger: 0.08, duration: 0.6, ease: 'power2.out',
          scrollTrigger: { trigger: '.faq-section', start: 'top 85%' } }
      )

      // CTA
      gsap.fromTo('.final-cta',
        { scale: 0.95, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: '.cta-section', start: 'top 88%' } }
      )
    }, containerRef)
    return () => ctx.revert()
  }, [])

  const steps = activeTab === 'client' ? CLIENT_STEPS : FREELANCER_STEPS

  return (
    <div className="min-h-screen bg-[#09090B] text-white" ref={containerRef}>
      <main className="overflow-y-auto pb-24 lg:pb-0">

        {/* ═══════════════ HERO ═══════════════ */}
        <section className="relative overflow-hidden pt-32 pb-24 md:pt-40 md:pb-32 px-5 md:px-12">
          
          {/* Background Elements */}
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#0066FF] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[#8B5CF6] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>

          <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row items-center gap-16 lg:gap-8">
            
            {/* Left Content */}
            <div className="w-full lg:w-[55%] flex flex-col items-center lg:items-start text-center lg:text-left z-10">
              {/* Eyebrow */}
              <div className="hiw-hero-eyebrow flex items-center gap-2 bg-white/[0.03] border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-md">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] shadow-[0_0_10px_#0066FF] animate-pulse" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[2px] text-white/70">Redefining the hustle</span>
              </div>

              {/* Headline */}
              <h1 className="hiw-hero-h1 font-syne font-black text-white leading-[1.1] tracking-[-0.03em] mb-6" style={{ fontSize: 'clamp(2.8rem, 5vw, 4.5rem)' }}>
                <span className="block">Discovery is the</span>
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#0066FF] to-[#8B5CF6]">new way to hire.</span>
              </h1>

              <p className="hiw-hero-sub text-[#A0A0B4] text-base md:text-lg leading-relaxed max-w-[540px] mb-10 font-medium">
                Freelanso connects India's top creative talent through visual proof. Browse stunning portfolios, not boring proposals. Hire in seconds, not weeks.
              </p>

              {/* CTAs */}
              <div className="hiw-hero-cta flex flex-wrap justify-center lg:justify-start gap-4">
                 <button onClick={() => navigate('/explore')} className="bg-[#0066FF] hover:bg-[#0055EE] text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow-[0_8px_20px_rgba(0,102,255,0.25)] hover:shadow-[0_12px_25px_rgba(0,102,255,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2">
                   Explore the Feed
                   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                 </button>
                 <button onClick={() => navigate('/post-work')} className="bg-white/[0.05] border border-white/10 hover:bg-white/[0.08] text-white font-bold text-sm px-8 py-3.5 rounded-xl transition-all flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0">
                   Become a Creator
                 </button>
              </div>
            </div>

            {/* Right Visual - Clean Mockup */}
            <div className="w-full lg:w-[45%] relative z-10 flex justify-center lg:justify-end">
              <div className="relative w-full max-w-[500px] aspect-square rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6 backdrop-blur-3xl shadow-2xl overflow-hidden group">
                <div className="absolute inset-0 bg-[#0066FF] opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500"></div>
                
                {/* Floating Elements mimicking a clean UI */}
                <div className="flex flex-col gap-4 h-full relative z-10">
                  {/* Mock Search/Header */}
                  <div className="flex items-center justify-between bg-[#121216]/80 border border-white/5 rounded-2xl p-4 backdrop-blur-md shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-700 ease-out">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0066FF] to-[#8B5CF6] p-[2px]">
                        <div className="w-full h-full bg-[#121216] rounded-full border-2 border-transparent relative overflow-hidden">
                          <span className="grid h-full w-full place-items-center rounded-full bg-[#1c1c25] text-sm font-bold text-white" aria-hidden="true">F</span>
                        </div>
                      </div>
                      <div>
                        <div className="h-3.5 w-24 bg-white/20 rounded-md mb-1.5"></div>
                        <div className="h-2.5 w-16 bg-white/10 rounded-md"></div>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-[#0066FF]/10 text-[#0066FF] text-[10px] font-bold tracking-wider uppercase border border-[#0066FF]/20">
                      Hire Me
                    </div>
                  </div>

                  {/* Mock Grid */}
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="bg-[#121216]/60 border border-white/5 rounded-2xl p-4 backdrop-blur-sm flex flex-col justify-between transform translate-y-8 group-hover:translate-y-0 transition-transform duration-700 delay-100 ease-out">
                      <div className="w-full aspect-[4/3] bg-white/5 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden group/img">
                         <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=400&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover/img:scale-110 transition-transform duration-700" alt="Work" />
                      </div>
                      <div className="h-3 w-3/4 bg-white/20 rounded-md mb-2"></div>
                      <div className="h-2 w-1/2 bg-white/10 rounded-md"></div>
                    </div>
                    <div className="flex flex-col gap-4 transform translate-y-12 group-hover:translate-y-0 transition-transform duration-700 delay-200 ease-out">
                      <div className="flex-1 bg-gradient-to-br from-[#8B5CF6]/20 to-transparent border border-[#8B5CF6]/30 rounded-2xl p-4 backdrop-blur-sm relative overflow-hidden flex flex-col justify-end">
                        <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#8B5CF6]/30 flex items-center justify-center">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <div className="text-white font-syne font-bold text-lg leading-tight mb-1">Instant</div>
                        <div className="text-white/60 text-xs font-medium">Marketplace & Messaging</div>
                      </div>
                      <div className="flex-1 bg-[#121216]/60 border border-white/5 rounded-2xl p-4 backdrop-blur-sm flex items-center justify-center relative overflow-hidden group/pay">
                         <div className="absolute inset-0 bg-gradient-to-t from-[#0066FF]/20 to-transparent opacity-0 group-hover/pay:opacity-100 transition-opacity duration-500"></div>
                         <div className="text-center relative z-10">
                           <div className="text-[#0066FF] font-syne font-black text-3xl mb-1">Direct</div>
                           <div className="text-white/50 text-[10px] uppercase tracking-widest font-bold">Communication</div>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decorative glowing orb behind the mock ui */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-gradient-to-br from-[#0066FF] to-[#8B5CF6] rounded-full mix-blend-screen filter blur-[80px] opacity-20 group-hover:opacity-30 transition-opacity duration-700 pointer-events-none"></div>
              </div>
            </div>

          </div>
        </section>

        {/* ═══════════════ STEPS ═══════════════ */}
        <section className="px-5 md:px-12 py-20 max-w-[1200px] mx-auto">

          {/* Tab Toggle */}
          <div className="flex flex-col items-center mb-14">
            <p className="text-[#555] text-[10px] font-black uppercase tracking-[2px] mb-4">Who are you?</p>
            <div className="flex bg-[#121216] border border-white/5 rounded-2xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('client')}
                className={`px-6 md:px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'client' ? 'bg-[#0066FF] text-white shadow-[0_4px_20px_rgba(0,102,255,0.4)]' : 'text-[#555] hover:text-white'}`}
              >
                I'm Hiring
              </button>
              <button
                onClick={() => setActiveTab('freelancer')}
                className={`px-6 md:px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'freelancer' ? 'bg-[#0066FF] text-white shadow-[0_4px_20px_rgba(0,102,255,0.4)]' : 'text-[#555] hover:text-white'}`}
              >
                I'm a Freelancer
              </button>
            </div>
          </div>

          {/* Section heading */}
          <div className="text-center mb-12">
            <h2 className="font-syne font-black text-3xl md:text-5xl text-white tracking-tight mb-3">
              {activeTab === 'client' ? 'Hire great talent in 4 steps' : 'Start earning in 4 steps'}
            </h2>
            <p className="text-[#555] font-medium max-w-md mx-auto text-sm">
              {activeTab === 'client' ? 'Visual discovery makes finding the right person faster than ever before.' : 'Your portfolio does the selling. Just post great work and get discovered.'}
            </p>
          </div>

          {/* Step Cards Grid */}
          <div className="steps-grid grid grid-cols-1 sm:grid-cols-2 gap-5">
            {steps.map((step, i) => (
              <div
                key={`${activeTab}-${i}`}
                className="step-card relative group bg-[#0F0F13] border border-white/5 rounded-[28px] p-7 md:p-8 overflow-hidden cursor-default hover:border-white/10 transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              >
                {/* Background glow on hover */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-[28px]"
                  style={{ background: `radial-gradient(circle at 20% 20%, ${step.glow} 0%, transparent 60%)` }} />

                {/* Step number — large watermark */}
                <span className="absolute top-4 right-6 font-syne font-black text-[4.5rem] leading-none select-none pointer-events-none transition-colors duration-500"
                  style={{ color: step.glow }}>
                  {step.num}
                </span>

                {/* Tag pill */}
                <span className="relative z-10 inline-flex items-center text-[9px] font-black uppercase tracking-[2px] px-3 py-1 rounded-full border mb-5"
                  style={{ color: step.color, borderColor: `${step.color}30`, backgroundColor: `${step.color}10` }}>
                  {step.tag}
                </span>

                {/* Icon */}
                <div className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 group-hover:scale-110"
                  style={{ color: step.color, backgroundColor: `${step.color}15`, border: `1px solid ${step.color}25` }}>
                  {step.icon}
                </div>

                {/* Text */}
                <div className="relative z-10">
                  <h3 className="font-syne font-black text-white text-xl md:text-2xl mb-3 tracking-tight">{step.title}</h3>
                  <p className="text-[#666] text-[0.9rem] leading-relaxed font-medium">{step.desc}</p>
                </div>

                {/* Connector dot (not on last) */}
                {i < steps.length - 1 && (
                  <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 hidden sm:flex items-center justify-center"
                    style={{ borderColor: step.color, backgroundColor: '#09090B' }}>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: step.color }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════ VISUAL COMPARISON ═══════════════ */}
        <section className="px-5 md:px-12 py-16 border-t border-white/5 bg-[#0a0a0d]">
          <div className="max-w-[1000px] mx-auto">
            <div className="text-center mb-12">
              <p className="text-[#555] text-[10px] font-black uppercase tracking-[2px] mb-3">Why Freelanso</p>
              <h2 className="font-syne font-black text-3xl md:text-4xl text-white tracking-tight">Built different. <span className="text-[#0066FF]">By design.</span></h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: '🖼',
                  title: 'Visual First',
                  desc: 'Discover freelancers through their published project work and public profile details.',
                  color: '#0066FF',
                },
                {
                  icon: '⚡',
                  title: 'Instant Hiring',
                  desc: 'Cut through the noise. No lengthy RFPs or multiple interview rounds. Just one click to hire.',
                  color: '#8B5CF6',
                },
                {
                  icon: '🛡',
                  title: 'Fully Protected',
                  desc: 'Discuss the project scope and payment terms directly. Freelanso does not yet provide escrow.',
                  color: '#10B981',
                },
              ].map((item, i) => (
                <div key={i} className="relative bg-[#0F0F13] border border-white/5 rounded-[24px] p-7 text-center group hover:border-white/10 transition-all hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
                  <div className="text-4xl mb-4">{item.icon}</div>
                  <h3 className="font-syne font-black text-white text-xl mb-3">{item.title}</h3>
                  <p className="text-[#555] text-sm leading-relaxed">{item.desc}</p>
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-0 group-hover:w-1/2 transition-all duration-500 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════ FAQ ═══════════════ */}
        <section className="faq-section px-5 md:px-12 py-20 max-w-[900px] mx-auto">
          <div className="text-center mb-12">
            <p className="text-[#555] text-[10px] font-black uppercase tracking-[2px] mb-3">Got Questions?</p>
            <h2 className="font-syne font-black text-3xl md:text-4xl text-white tracking-tight">Frequently asked.</h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="faq-row">
                <button
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  className={`w-full text-left px-6 py-5 rounded-2xl border flex items-center justify-between gap-4 transition-all ${openFAQ === i ? 'bg-[#0066FF]/5 border-[#0066FF]/30' : 'bg-[#0F0F13] border-white/5 hover:border-white/10'}`}
                >
                  <span className="font-bold text-[0.9rem] md:text-[0.95rem] text-white">{faq.q}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    className={`shrink-0 transition-all duration-300 ${openFAQ === i ? 'rotate-180 text-[#0066FF]' : 'text-[#444]'}`}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                {openFAQ === i && (
                  <div className="px-6 py-4 text-[#777] text-[0.9rem] leading-relaxed font-medium animate-in fade-in slide-in-from-top-2 duration-200">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════ FINAL CTA ═══════════════ */}
        <section className="cta-section px-5 md:px-12 py-12 pb-20">
          <div className="final-cta max-w-[900px] mx-auto relative overflow-hidden rounded-[32px] p-10 md:p-16 text-center"
            style={{ background: 'linear-gradient(135deg, #0a1930 0%, #111827 50%, #0a0a0d 100%)', border: '1px solid rgba(0,102,255,0.2)' }}>

            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(circle at 50% 0%, rgba(0,102,255,0.12) 0%, transparent 60%)' }} />

            <div className="relative z-10">
              <p className="text-[#60A5FA] text-[10px] font-black uppercase tracking-[3px] mb-4">Ready to start?</p>
              <h2 className="font-syne font-black text-white mb-4 tracking-tight" style={{ fontSize: 'clamp(2rem,5vw,3.5rem)' }}>
                India's best creative work<br />is one scroll away.
              </h2>
              <p className="text-[#666] text-sm md:text-base leading-relaxed max-w-md mx-auto mb-10 font-medium">
                Explore published portfolios and connect with freelancers through the marketplace.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button onClick={() => navigate('/explore')}
                  className="w-full sm:w-auto bg-[#0066FF] text-white font-black text-sm px-10 py-4 rounded-2xl shadow-[0_8px_32px_rgba(0,102,255,0.45)] hover:scale-[1.03] active:scale-95 transition-all">
                  Browse Talent →
                </button>
                <button onClick={() => navigate('/signup')}
                  className="w-full sm:w-auto bg-white/5 border border-white/10 text-white font-black text-sm px-10 py-4 rounded-2xl hover:bg-white/10 active:scale-95 transition-all">
                  Post Your Work Free
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
