import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { auth } from '../lib/auth'
import Avatar from './Avatar'

export default function MatchScoreCard({ match, userProfile, index = 0 }) {
  const cardRef = useRef(null)
  const scoreRef = useRef(null)
  const ringRef = useRef(null)
  const [displayScore, setDisplayScore] = useState(0)

  // Determine color based on score thresholds
  const getColor = (s) => {
    if (s >= 80) return { hex: '#00FF88', tailwind: 'text-[#00FF88]', bg: 'bg-[#00FF88]', bgOpa: 'bg-[#00FF88]/20' }
    if (s >= 50) return { hex: '#F59E0B', tailwind: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]', bgOpa: 'bg-[#F59E0B]/20' }
    return { hex: '#FF3366', tailwind: 'text-[#FF3366]', bg: 'bg-[#FF3366]', bgOpa: 'bg-[#FF3366]/20' }
  }

  const color = getColor(match.matchScore)

  useGSAP(() => {
    // 1. Staggered Entrance Animation
    gsap.fromTo(cardRef.current, 
      { opacity: 0, y: 30, scale: 0.95 }, 
      { opacity: 1, y: 0, scale: 1, duration: 0.6, delay: index * 0.1, ease: 'back.out(1.2)' }
    )

    // 2. Score Counting Up
    gsap.to({ val: 0 }, {
      val: match.matchScore,
      duration: 1.5,
      delay: index * 0.1 + 0.2, // start slightly after card enters
      ease: 'power3.out',
      onUpdate: function () {
        setDisplayScore(Math.round(this.targets()[0].val))
      }
    })

    // 3. Circular Ring Fill
    if (ringRef.current) {
      const radius = 28
      const circumference = 2 * Math.PI * radius
      const offset = circumference - (match.matchScore / 100) * circumference
      
      gsap.fromTo(ringRef.current,
        { strokeDashoffset: circumference },
        { strokeDashoffset: offset, duration: 1.5, delay: index * 0.1 + 0.2, ease: 'power3.out' }
      )
    }
  }, { scope: cardRef, dependencies: [match.matchScore] })

  // Determine if viewing user is the freelancer
  const isOwnCard = auth.getUser()?.uid === match.freelancerId;
  // Calculate percentage breakdown for the bars (max points: skill 50, past 35, bio 15)
  // New talent maxes: skill 70, past 0, bio 30
  const maxSkill = match.isNewTalent ? 70 : 50;
  const maxBio = match.isNewTalent ? 30 : 15;
  const maxPast = match.isNewTalent ? 0 : 35;

  const skillPct = (match.breakdown?.skillMatch / maxSkill) * 100 || 0
  const pastPct = maxPast > 0 ? ((match.breakdown?.pastWorkRelevance / maxPast) * 100 || 0) : 0
  const bioPct = (match.breakdown?.bioRelevance / maxBio) * 100 || 0
  
  return (
    <div ref={cardRef} className="bg-[#121216] border border-white/5 hover:border-white/10 rounded-2xl p-5 sm:p-6 transition-colors shadow-lg">
      <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
        
        {/* Left: Avatar & Name */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Avatar src={userProfile?.avatar} name={userProfile?.name || 'Freelancer'} size="w-14 h-14" className="rounded-2xl" />
          <div className="min-w-0">
            <h4 className="font-syne font-black text-white text-lg truncate">
              {userProfile?.name || 'Talent Profile'}
            </h4>
            <p className="text-xs font-bold text-[#666] truncate mt-0.5">
              {userProfile?.skills?.slice(0, 3).join(' • ') || 'Creative Professional'}
            </p>
          </div>
        </div>

        {/* Center: Breakdown Bars */}
        <div className="flex-1 w-full flex flex-col gap-3 min-w-[200px]">
          <div>
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#888] mb-1">
              <span>Skills Overlap</span>
              <span className={color.tailwind}>{match.breakdown?.skillMatch || 0}/{maxSkill} pts</span>
            </div>
            <div className="h-1.5 w-full bg-[#1A1A22] rounded-full overflow-hidden">
               <div className={`h-full ${color.bg} rounded-full`} style={{ width: `${skillPct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#888] mb-1">
              <span>Category Fit</span>
              <span className={color.tailwind}>{match.breakdown?.bioRelevance || 0}/{maxBio} pts</span>
            </div>
            <div className="h-1.5 w-full bg-[#1A1A22] rounded-full overflow-hidden">
               <div className={`h-full ${color.bg} rounded-full`} style={{ width: `${bioPct}%` }} />
            </div>
          </div>
          {!match.isNewTalent ? (
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#888] mb-1">
                <span>Budget Fit</span>
                <span className={color.tailwind}>{match.breakdown?.pastWorkRelevance || 0}/{maxPast} pts</span>
              </div>
              <div className="h-1.5 w-full bg-[#1A1A22] rounded-full overflow-hidden">
                 <div className={`h-full ${color.bg} rounded-full`} style={{ width: `${pastPct}%` }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
               <span className="bg-gradient-to-r from-yellow-400 to-[#F59E0B] text-black font-black text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm">✨ New Talent</span>
               <span className="text-[10px] font-bold text-[#666]">Evaluated entirely on skills & bio</span>
            </div>
          )}
        </div>

        {/* Right: Score Ring */}
        <div className="flex items-center gap-4 shrink-0 sm:pl-4 sm:border-l border-white/5">
          <div className="relative w-[72px] h-[72px] flex items-center justify-center">
            {/* Background Track */}
            <svg className="w-full h-full -rotate-90 absolute inset-0">
              <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
              {/* Progress Ring */}
              <circle 
                ref={ringRef}
                cx="36" cy="36" r="28" fill="none" 
                stroke={color.hex} 
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 28}
                strokeDashoffset={2 * Math.PI * 28}
              />
            </svg>
            <div className="flex flex-col items-center justify-center pt-0.5">
              <span ref={scoreRef} className={`font-syne font-black text-2xl leading-none ${color.tailwind}`}>
                {displayScore}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reason Card */}
      {(match.reason || (isOwnCard && match.tip)) && (
        <div className={`mt-5 p-4 rounded-xl ${color.bgOpa} border border-white/5 flex flex-col gap-3`}>
           {match.reason && (
             <p className={`text-xs font-medium leading-relaxed ${color.tailwind}`}>
               <span className="font-black uppercase tracking-wider mr-1">Match Insight:</span>
               {match.reason}
             </p>
           )}
           
           {isOwnCard && match.tip && (
             <div className="pt-3 border-t border-white/10 flex items-start gap-3">
               <div className="mt-0.5 w-5 h-5 flex items-center justify-center bg-white/10 rounded-full shrink-0">💡</div>
               <div>
                 <span className="text-[10px] font-black uppercase tracking-widest text-white block mb-0.5">Profile Tip</span>
                 <p className="text-xs font-bold text-[#BBB] leading-relaxed">{match.tip}</p>
                 <button className="mt-2 text-[10px] font-black uppercase tracking-widest text-white hover:text-[#0066FF] flex items-center gap-1 transition-colors">
                   Improve Profile Now <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
                 </button>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  )
}
