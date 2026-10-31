import { useState, useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import Sidebar from '../components/Sidebar'
import { submitSupportTicket } from '../lib/data'

export default function Support() {
  const [collapsed, setCollapsed] = useState(false)
  const [activeFAQ, setActiveFAQ] = useState(0)
  const [form, setForm] = useState({ name: '', email: '', subject: 'Technical Support', message: '', companyWebsite: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const containerRef = useRef(null)
  const idempotencyKeyRef = useRef(crypto.randomUUID())

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.support-hero', { y: 20, opacity: 0, duration: 0.8, ease: 'power3.out' })
      gsap.from('.faq-item', { x: -20, opacity: 0, duration: 0.6, stagger: 0.1, delay: 0.3, ease: 'power2.out' })
      gsap.from('.contact-card', { x: 20, opacity: 0, duration: 0.6, delay: 0.5, ease: 'power2.out' })
    }, containerRef)
    return () => ctx.revert()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError('')
    setSubmitted(false)
    try {
      await submitSupportTicket(form, idempotencyKeyRef.current)
      idempotencyKeyRef.current = crypto.randomUUID()
      setForm({ name: '', email: '', subject: 'Technical Support', message: '', companyWebsite: '' })
      setSubmitted(true)
    } catch (error) {
      setSubmitError(error.message || 'Unable to send your message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const faqs = [
    { q: 'How do I start selling on Freelanso?', a: 'To start selling, simply click the "Add Post" button in the sidebar. Fill in your project details, set your price, and publish. Your work will immediately appear in the visual discovery feed.' },
    { q: 'What are the transaction fees?', a: 'Freelanso does not currently process marketplace payments or charge transaction fees.' },
    { q: 'How does payment protection work?', a: 'Payments and escrow are not yet available through Freelanso. Do not share sensitive payment details in messages.' },
    { q: 'Can I offer custom services?', a: 'Yes! Beyond posting pre-defined projects, clients can reach out via the "Services" tab for custom inquiries based on your published skills and portfolio.' },
  ]

  return (
    <div className="flex h-screen bg-[#09090B] text-white overflow-hidden" ref={containerRef}>
      <div className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? 'w-[78px]' : 'w-[240px]'}`}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 overflow-y-auto px-8 py-12 lg:px-20 lg:py-16">
        <div className="max-w-[1000px] mx-auto">
          
          {/* Hero Section */}
          <section className="support-hero text-center mb-20">
             <div className="w-16 h-16 rounded-[24px] bg-[#0066FF] flex items-center justify-center mx-auto mb-8 shadow-[0_10px_30px_rgba(0,102,255,0.4)]">
               <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
             </div>
             <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">Support Center</h1>
             <p className="text-[#666] font-bold text-sm tracking-widest uppercase max-w-lg mx-auto leading-relaxed">Dedicated help and resources to fuel your freelance success on India's #1 discovery platform.</p>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            {/* FAQ Section */}
            <div>
              <h2 className="text-[1.2rem] font-black uppercase tracking-widest mb-10 text-[#444]">Frequently Asked Questions</h2>
              <div className="space-y-4">
                {faqs.map((faq, i) => (
                  <div key={i} className="faq-item">
                     <button 
                       onClick={() => setActiveFAQ(activeFAQ === i ? -1 : i)}
                       className={`w-full text-left p-6 rounded-[28px] border transition-all flex items-center justify-between gap-4 ${activeFAQ === i ? 'bg-[#121216] border-[#0066FF]/30' : 'bg-transparent border-white/5 hover:border-white/10'}`}
                     >
                       <span className="font-bold text-[0.95rem]">{faq.q}</span>
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`shrink-0 transition-transform ${activeFAQ === i ? 'rotate-180 text-[#0066FF]' : 'text-[#444]'}`}>
                         <path d="m6 9 6 6 6-6" />
                       </svg>
                     </button>
                     {activeFAQ === i && (
                       <div className="px-6 py-4 text-[#888] text-[0.9rem] leading-relaxed font-medium animate-in fade-in slide-in-from-top-2 duration-300">
                         {faq.a}
                       </div>
                     )}
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Form */}
            <div className="contact-card bg-[#121216]/50 border border-white/5 rounded-[40px] p-8 md:p-10 h-fit">
               <h2 className="text-[1.2rem] font-black uppercase tracking-widest mb-2">Direct Inquiry</h2>
               <p className="text-[#555] text-[0.8rem] font-bold uppercase tracking-wider mb-8">Response typical within 2 hours</p>
               
               <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444] px-2">Your Name</label>
                    <input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} type="text" placeholder="John Doe" className="w-full bg-[#121216] border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#0066FF]/40 transition-all placeholder-[#333]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444] px-2">Your Email</label>
                    <input required maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" placeholder="you@example.com" className="w-full bg-[#121216] border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#0066FF]/40 transition-all placeholder-[#333]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444] px-2">Category</label>
                    <select value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} className="w-full bg-[#121216] border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#0066FF]/40 transition-all text-[#888]">
                       <option value="Technical Support">Technical Support</option>
                       <option value="Billing & Payments">Billing & Payments</option>
                       <option value="Profile & Account">Profile & Account</option>
                       <option value="Feedback">Feedback</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#444] px-2">Your Message</label>
                    <textarea required minLength={10} maxLength={5000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Describe how we can help..." rows="4" className="w-full bg-[#121216] border border-white/5 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#0066FF]/40 transition-all placeholder-[#333] resize-none" />
                  </div>
                  <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                    <label htmlFor="support-company-website">Leave this field empty</label>
                    <input id="support-company-website" tabIndex="-1" autoComplete="off" value={form.companyWebsite} onChange={(event) => setForm({ ...form, companyWebsite: event.target.value })} />
                  </div>
                  {submitError && <p role="alert" className="text-sm font-bold text-red-400">{submitError}</p>}
                  {submitted && <p role="status" className="text-sm font-bold text-emerald-400">Your message was sent. Our support team will be in touch.</p>}
                  <button disabled={submitting} type="submit" className="w-full py-4 bg-[#0066FF] rounded-2xl font-black text-xs uppercase tracking-[2px] shadow-[0_10px_30px_rgba(0,102,255,0.2)] hover:scale-105 active:scale-95 transition-all mt-4 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Sending...' : 'Send Message →'}</button>
               </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
