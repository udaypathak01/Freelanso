import { memo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { auth } from '../lib/auth'
import Avatar from './Avatar'
import { getMediaPreview, PLACEHOLDER_IMG } from '../lib/data'

function ProjectCard({ project, onHire }) {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  const user = auth.getUser()

  // Handle data variations gracefully
  const authorName = typeof project.author === 'string' ? project.author : (project.author?.name || 'Unknown User')
  const price = typeof project.price === 'number' ? `₹${project.price.toLocaleString()}` : project.price

  const isOwner = user && project.authorUid === user.uid
  const editType = project.type || 'project'

  // Determine if it's a video from mediaType field first, fallback to category/title inference
  const isVideo = project?.mediaType === 'video' ||
                  project?.type === 'video' ||
                  project?.category?.toLowerCase().includes('video') ||
                  project?.title?.toLowerCase().includes('video')

  // A project is 'live' when it came from the DB (tagged by data.js) or has an authorUid
  const isLive = project.source === 'live'

  // Ensure we use the correct image URL (prioritize thumbnailUrl, then imageUrl, then img)
  const displayImageUrl = getMediaPreview(project)
  const mainMediaUrl = project.imageUrl || project.img || displayImageUrl


  return (
    <div
      className="group relative h-[320px] bg-[#121216] border border-white/5 rounded-[20px] sm:rounded-[24px] overflow-hidden cursor-pointer hover:border-[#0066FF]/30 hover:shadow-[0_20px_60px_rgba(0,0,0,0.6)] transition-all duration-500"
      onClick={() => onHire?.(project)}
    >
      {/* AI MATCH BADGE */}
      {project.matchScore && (
        <div className="absolute top-2 right-12 sm:top-4 sm:right-14 z-20">
          <div className="relative group/ai">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-[9px] uppercase tracking-tighter shadow-2xl transition-all duration-300 ${
              project.isAIPick 
              ? 'bg-[#FFD700] text-black border-[#FFD700] shadow-[#FFD700]/20' 
              : 'bg-white/10 backdrop-blur-md text-white border-white/10'
            }`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
              {project.matchScore}% Match
            </div>
            
            {/* AI Insight Tooltip */}
            {project.aiInsight && (
              <div className="absolute top-full mt-2 right-0 w-48 p-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl opacity-0 translate-y-2 pointer-events-none group-hover/ai:opacity-100 group-hover/ai:translate-y-0 transition-all z-50 shadow-2xl">
                <p className="text-[10px] text-white/90 leading-relaxed italic">"{project.aiInsight}"</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI PICK GLOW */}
      {project.isAIPick && (
        <div className="absolute inset-0 border-2 border-[#FFD700]/20 rounded-[24px] pointer-events-none z-10 animate-pulse" />
      )}
      {/* OWNER BADGES */}
      {isOwner && (
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-20 flex flex-col gap-1.5">
          <Link
            to={`/edit/${editType}/${project.id}`}
            onClick={e => e.stopPropagation()}
            className="bg-[#0066FF] text-white text-[7px] sm:text-[8px] font-black uppercase px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md tracking-widest shadow-lg hover:scale-110 transition-transform w-fit"
          >
            Edit
          </Link>
          <Link
            to={`/project/${project.id}/matches`}
            onClick={e => e.stopPropagation()}
            className="bg-white text-[#0066FF] text-[7px] sm:text-[8px] font-black uppercase px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-md tracking-widest shadow-lg hover:scale-110 transition-transform w-fit"
          >
            Matches
          </Link>
        </div>
      )}

      {/* IMAGE/VIDEO WRAP */}
      <div className="relative h-full overflow-hidden bg-[#09090B]">
        {isVideo ? (
          <>
            <video
              src={mainMediaUrl.replace('http://', 'https://')}
              poster={displayImageUrl.replace('http://', 'https://')}
              alt={project.title}
              className="w-full h-full object-cover transform-gpu will-change-transform group-hover:scale-110 transition-transform duration-1000 ease-out"
              preload="none"
              playsInline
              crossOrigin="anonymous"
              onMouseEnter={(e) => {
                const video = e.target
                if (video) video.play().catch(() => {})
              }}
              onMouseLeave={(e) => {
                const video = e.target
                if (video) video.pause()
              }}
              onError={(e) => {
                console.error("❌ Explorer Video Error:", e.target.error);
                console.log("🔗 Failed URL:", mainMediaUrl);
              }}
            />
            {/* PLAY BUTTON OVERLAY FOR VIDEO */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:bg-[#0066FF]/60 transition-all duration-300">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="ml-1"><path d="M8 5v14l11-7z" /></svg>
              </div>
            </div>
          </>
        ) : (
          <img
            src={displayImageUrl}
            alt={project.title}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.target.src = PLACEHOLDER_IMG }}
            className="w-full h-full object-cover transform-gpu will-change-transform group-hover:scale-110 transition-transform duration-1000 ease-out"
          />
        )}

        {/* VIDEO BADGE */}
        {isVideo && (
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white/80 drop-shadow-md">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="3" ry="3" /></svg>
          </div>
        )}

        {/* TOP BADGES */}
        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 flex flex-col gap-1.5">
          {!isOwner && isLive && (
            <span className="flex items-center gap-1 bg-[#00FF88] text-black text-[7px] sm:text-[8px] font-black uppercase px-1.5 py-0.5 rounded-[4px] tracking-widest shadow-lg">
              <span className="w-1 h-1 rounded-full bg-black animate-pulse inline-block" />
              Live
            </span>
          )}
        </div>

        {/* GRADIENT OVERLAY — only visible on hover */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/95 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
      </div>

      {/* CARD INFO AREA — hidden by default, shown on hover */}
      <div className="absolute bottom-0 inset-x-0 p-3 sm:p-5 pt-0 transform-gpu z-10 antialiased [transform:translateZ(0)] opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 ease-out">
        <h3 className="font-syne font-black text-white text-[0.78rem] sm:text-[0.95rem] leading-tight mb-1.5 sm:mb-3 tracking-tight group-hover:text-[#0066FF] transition-colors line-clamp-2">
          {project.title}
        </h3>

        {project.aiInsight && (
          <p className="text-[#888] text-[9px] sm:text-[10px] italic leading-tight mb-2 line-clamp-2">
            AI Insight: {project.aiInsight}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 group/author cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${project.authorUid || project.id}`); }}>
            <Avatar 
              src={project.avatar || project.author?.avatar} 
              name={authorName} 
              size="w-4 h-4 sm:w-5 sm:h-5" 
              className="rounded-md border-none" 
            />
            <span className="text-white/80 text-[9px] sm:text-[10px] font-bold truncate max-w-[70px] sm:max-w-none group-hover/author:text-white transition-colors">{authorName}</span>
          </div>
          <span className="font-syne font-black text-white text-[0.8rem] sm:text-[1rem] tracking-tight">{price}</span>
        </div>
        <div className="mt-2 flex items-center gap-3 text-[9px] font-bold text-white/60">
          <span aria-label={`${project.likesCount ?? project.likes ?? 0} likes`}>♥ {project.likesCount ?? project.likes ?? 0}</span>
          <span aria-label={`${project.commentsCount ?? 0} comments`}>▱ {project.commentsCount ?? 0}</span>
        </div>
      </div>

      {/* SAVED BUTTON — slides in on hover */}
      <button
        onClick={(e) => { e.stopPropagation(); setSaved(!saved) }}
        className={`absolute top-2 right-2 sm:top-4 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 translate-x-12 group-hover:translate-x-0 z-20 ${saved ? 'bg-[#0066FF] text-white' : 'bg-black/50 backdrop-blur-md text-white/50 hover:text-white'}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="3">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
    </div>
  )
}

export default memo(ProjectCard)
