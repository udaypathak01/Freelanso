import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

// Deterministic avatar bg from name
const AVATAR_COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-acc', 'bg-pink-500',
  'bg-orange-500', 'bg-green-500', 'bg-sky-500', 'bg-red-500',
]

export default function HireModal({ project, onClose }) {
  const overlayRef = useRef(null)
  const cardRef    = useRef(null)
  const [closing, setClosing] = useState(false)
  const [message, setMessage] = useState('')

  /* ── Enter animation ── */
  useEffect(() => {
    gsap.fromTo(overlayRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.3 }
    )
    gsap.fromTo(cardRef.current,
      { y: 28, scale: 0.96 },
      { y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.2)' }
    )

    // Lock body scroll while modal is open
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  /* ── Close with exit animation ── */
  const handleClose = () => {
    if (closing) return
    setClosing(true)
    gsap.to(cardRef.current, { y: 20, scale: 0.96, opacity: 0, duration: 0.25 })
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.25, onComplete: onClose })
  }

  if (!project) return null

  const authorName   = typeof project.author === 'string' ? project.author : (project.author?.name ?? 'Unknown')
  const firstName    = authorName.split(' ')[0]
  const authorInitial = authorName.charAt(0).toUpperCase()
  const price        = typeof project.price === 'number'
    ? `₹${project.price.toLocaleString()}`
    : project.price
  const avatarBg     = AVATAR_COLORS[authorName.charCodeAt(0) % AVATAR_COLORS.length]
  const catClean     = project.category?.replace(/[^\w\s/]/gi, '').trim() || 'General'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-[12px]"
      onClick={handleClose}
    >
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        className="bg-s1 border border-white/14 rounded-3xl w-full max-w-[480px] overflow-hidden shadow-2xl"
      >
        {/* ── HERO IMAGE ── */}
        <div className="h-[160px] relative overflow-hidden">
          <img
            src={project.imageUrl || project.img}
            alt={project.title}
            className="w-full h-full object-cover"
          />
          {/* Gradient fade into card bg */}
          <div className="absolute inset-0 bg-gradient-to-t from-s1 to-transparent" />

          {/* Top bar */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            <span className="bg-acc/15 border border-acc/25 text-acc text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
              {catClean}
            </span>
            <button
              onClick={handleClose}
              className="bg-bg/70 backdrop-blur-sm border border-white/9 text-t1 hover:text-t0 text-[0.72rem] font-semibold px-2.5 py-1.5 rounded-[7px] transition-all"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="p-6">
          <h2 className="font-syne text-[1.25rem] font-extrabold tracking-tight mb-1">
            {project.title}
          </h2>
          <p className="text-t1 text-[0.82rem] leading-relaxed mb-5">
            Connect directly with the freelancer to discuss the work.
          </p>

          {/* ── FREELANCER CHIP ── */}
          <div className="flex items-center gap-3 bg-s2 border border-white/9 rounded-[14px] p-3.5 mb-5">
            <div className={`w-11 h-11 rounded-xl ${avatarBg} font-syne font-extrabold text-lg text-white flex items-center justify-center shrink-0`}>
              {authorInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-syne text-[0.92rem] font-bold text-t0 truncate">{firstName}</div>
              <div className="text-t1 text-[0.72rem] mt-0.5">
                {project.skills?.length ? project.skills.join(' · ') : 'Freelancer'}
              </div>
            </div>
            <div className="ml-auto text-right shrink-0">
              <div className="font-syne font-extrabold text-acc text-[1.1rem] leading-none">{price}</div>
              <div className="text-t2 text-[10px] uppercase tracking-wider mt-1">fixed price</div>
            </div>
          </div>

          {Number.isFinite(project.owner?.ratingAvg) &&
            project.owner.ratingAvg > 0 && (
              <div className="mb-5 rounded-[10px] border border-white/5 bg-s2 p-2.5 text-center">
                <span className="font-syne font-extrabold text-[0.95rem] text-[#FFD700]">
                  {project.owner.ratingAvg.toFixed(1)}★
                </span>
                <span className="ml-2 text-t2 text-[10px] uppercase tracking-wider">
                  Rating
                </span>
              </div>
            )}

          {/* ── MESSAGE TEXTAREA ── */}
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hi! I'd love to discuss my project with you..."
            rows={3}
            className="w-full bg-s2 border border-white/9 focus:border-acc/40 rounded-xl p-3 text-t0 font-jakarta text-[0.85rem] resize-none outline-none transition-colors mb-3 placeholder:text-t2"
          />

          {/* ── ACTION ROW ── */}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button className="bg-s2 border border-white/9 text-t1 hover:text-t0 hover:border-white/14 rounded-xl py-3 text-sm font-bold transition-all">
              Save for Later
            </button>
            <button className="bg-acc hover:bg-acc2 text-white rounded-xl py-3 text-sm font-bold transition-all hover:-translate-y-0.5 shadow-[0_8px_24px_rgba(0,102,255,0.25)]">
              Send Message ✦
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
