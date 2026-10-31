import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { useRef, useState, useEffect } from 'react'
import { auth } from '../lib/auth'
import { Link, useNavigate } from 'react-router-dom'
import { toggleLikeDB, fetchCommentsDB, postCommentDB, deleteCommentDB, fetchProjectDB, createConversation, getMediaPreview, PLACEHOLDER_IMG } from '../lib/data'

function getProjectMedia(project) {
  const source = Array.isArray(project?.media) && project.media.length
    ? project.media
    : Array.isArray(project?.images) && project.images.length
      ? project.images
      : [{
          url: project?.coverImage || project?.imageUrl || project?.img,
          type: project?.mediaType,
          isCover: true,
        }]

  return source
    .filter((item) => typeof item?.url === 'string' && item.url)
    .map((item, index) => ({
      ...item,
      type: item.type === 'video' || item.mediaType === 'video' ||
        item.resourceType === 'video' || item.url.includes('/video/upload/') ||
        /\.(mp4|mov|webm)(?:$|[?#])/i.test(item.url)
        ? 'video'
        : 'image',
      isCover: item.isCover === true || index === 0,
    }))
    .sort((left, right) => Number(right.isCover) - Number(left.isCover))
}

function formatRelativeTime(value) {
  if (!value) return 'Just now'
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return 'Just now'
  const seconds = Math.round((timestamp - Date.now()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second')
  if (Math.abs(seconds) < 3600) return formatter.format(Math.round(seconds / 60), 'minute')
  if (Math.abs(seconds) < 86400) return formatter.format(Math.round(seconds / 3600), 'hour')
  return formatter.format(Math.round(seconds / 86400), 'day')
}

export default function ProjectDetailView({ project, onClose, relatedProjects, onOpenRelated }) {
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const user = auth.getUser()

  // --- SOCIAL STATE ---
  const [likesCount, setLikesCount] = useState(Number(project?.likesCount ?? project?.likes) || 0)
  const [isLiked, setIsLiked] = useState(project?.likedByMe === true)
  const [commentsCount, setCommentsCount] = useState(Number(project?.commentsCount) || 0)
  const [likePending, setLikePending] = useState(false)
  const [comments, setComments] = useState([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState(null)
  const [commentsError, setCommentsError] = useState('')
  const [projectError, setProjectError] = useState('')
  const [actionError, setActionError] = useState('')
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const touchStartX = useRef(null)
  const galleryMedia = getProjectMedia(project)
  const selectedMedia = galleryMedia[selectedMediaIndex] || galleryMedia[0]
  const authorName = String(project?.owner?.displayName || project?.author?.name || project?.author || 'Freelancer')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
  const authorId = project?.ownerId || project?.authorUid
  const authorFirstName = authorName.split(/\s+/)[0]
  const projectLinks = Array.isArray(project?.links) ? project.links : []
  const relatedMatches = (relatedProjects || [])
    .filter((item) => item.id !== project?.id)
    .filter((item) => {
      const sameCategory = item.category && item.category === project?.category
      const projectTags = new Set((project?.tags || []).map((tag) => tag.toLowerCase()))
      const sharesTag = (item.tags || []).some((tag) => projectTags.has(String(tag).toLowerCase()))
      return sameCategory || sharesTag
    })
    .slice(0, 5)

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.fromTo(containerRef.current, 
      { opacity: 0 },
      { opacity: 1, duration: 0.4 }
    ).fromTo(".stagger-item", 
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out' },
      "-=0.2"
    );
  }, { scope: containerRef });

  // Load comments on mount
  useEffect(() => {
    if (project?.id) {
       setLoadingComments(true);
       fetchCommentsDB(project.id).then(data => {
         setComments(data);
       }).catch(error => {
         setCommentsError(error.message)
       }).finally(() => setLoadingComments(false));
    }
  }, [project?.id]);

  useEffect(() => {
    if (!project?.id) return
    let active = true
    fetchProjectDB(project.id).then((details) => {
      if (!active) return
      setLikesCount(details.likesCount)
      setIsLiked(details.likedByMe)
      setCommentsCount(Number(details.commentsCount) || 0)
    }).catch(error => {
      if (active) setProjectError(error.message)
    })
    return () => { active = false }
  }, [project?.id])

  useEffect(() => {
    setSelectedMediaIndex(0)
    setLightboxOpen(false)
  }, [project?.id])

  useEffect(() => {
    if (galleryMedia.length < 2 && !lightboxOpen) return
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && lightboxOpen) setLightboxOpen(false)
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return
      if (galleryMedia.length < 2) return
      if (event.key === 'ArrowLeft') setSelectedMediaIndex((index) => (index - 1 + galleryMedia.length) % galleryMedia.length)
      if (event.key === 'ArrowRight') setSelectedMediaIndex((index) => (index + 1) % galleryMedia.length)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [galleryMedia.length, lightboxOpen])

  const moveGallery = (direction) => {
    setSelectedMediaIndex((index) =>
      (index + direction + galleryMedia.length) % galleryMedia.length,
    )
  }

  const handleLike = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/explore` } })
      return
    }
    if (likePending) return
    setActionError('')
    
    // Optimistic Update
    const prevLiked = isLiked;
    const prevCount = likesCount;
    
    setIsLiked(!prevLiked);
    setLikesCount(prevLiked ? prevCount - 1 : prevCount + 1);
    setLikePending(true)

    try {
      const result = await toggleLikeDB(project.id);
      // Sync with server result just in case
      setLikesCount(result.count);
      setIsLiked(result.liked);
    } catch (err) {
      // Revert on error
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
      setActionError(err.message || 'Unable to update like. Please try again.')
    } finally {
      setLikePending(false)
    }
  };

  const handleCommentSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: `/explore` } })
      return
    }
    const text = commentText.trim()
    if (!text || text.length > 1000 || submittingComment) return

    setActionError('')
    setSubmittingComment(true)

    try {
      const newComment = await postCommentDB(project.id, text);
      setComments(prev => [newComment, ...prev]);
      setCommentsCount((count) => count + 1)
      setCommentText('')
    } catch (err) {
      setActionError(err.message || 'Failed to post comment.')
    } finally {
      setSubmittingComment(false)
    }
  };

  const handleDeleteComment = async (commentId) => {
    setActionError('')
    setDeletingCommentId(commentId)
    try {
      await deleteCommentDB(project.id, commentId)
      setComments((current) => current.filter((comment) => comment.id !== commentId))
      setCommentsCount((count) => Math.max(0, count - 1))
    } catch (error) {
      setActionError(error.message || 'Unable to delete comment.')
    } finally {
      setDeletingCommentId(null)
    }
  }

  const handleMessage = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/explore` } })
      return
    }
    if (!project) return
    const otherUserId = project.ownerId || project.authorUid
    if (!otherUserId) {
      setActionError('This project does not have a valid owner.')
      return
    }
    try {
      const conversation = await createConversation(otherUserId, project.id)
      navigate(`/messages/${encodeURIComponent(conversation.id)}?context=${encodeURIComponent(project.title)}`)
    } catch (error) {
      setActionError(error.message || 'Unable to start a conversation.')
    }
  }

  if (!project) return null
  if (projectError) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center text-white">
        <h2 className="font-bold">Project details could not be loaded</h2>
        <p className="text-sm text-[#888]">{projectError}</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex flex-col w-full min-h-screen bg-[#050505] p-6 lg:p-8">
      
      {/* Refined Top Navigation */}
      <div className="flex items-center justify-between mb-8 stagger-item">
        <button 
          onClick={onClose}
          className="flex items-center gap-2.5 text-[#666] hover:text-white transition-all group py-2"
        >
          <div className="p-2 rounded-lg bg-white/5 group-hover:bg-white/10 border border-white/5 transition-colors">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <span className="font-bold text-xs uppercase tracking-widest">Back</span>
        </button>
        
        <div className="flex items-center gap-2">
           <div className="w-2 h-2 rounded-full bg-[#0066FF] animate-pulse" />
           <span className="text-[10px] font-black text-[#444] uppercase tracking-[0.2em]">Project Detail · Live</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8">
        
        {/* Main Content Area */}
        <div className="space-y-8">
          
          {/* Main Media Piece */}
          <div
            className="relative aspect-video bg-[#09090B] rounded-[32px] overflow-hidden border border-white/5 shadow-2xl group stagger-item"
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }}
            onTouchEnd={(event) => {
              const startX = touchStartX.current
              const endX = event.changedTouches[0]?.clientX
              if (galleryMedia.length > 1 && startX !== null && typeof endX === 'number' && Math.abs(endX - startX) > 50) {
                moveGallery(endX < startX ? 1 : -1)
              }
              touchStartX.current = null
            }}
          >
            {selectedMedia ? selectedMedia.type === 'video' ? (
              <video
                key={selectedMedia.url}
                src={selectedMedia.url.replace('http://', 'https://')}
                controls
                className="w-full h-full object-contain bg-black"
                poster={getMediaPreview(selectedMedia).replace('http://', 'https://')}
                preload="metadata"
                playsInline
              />
            ) : (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="h-full w-full cursor-zoom-in"
                aria-label="Open project image fullscreen"
              >
                <img
                  src={selectedMedia.url.replace('http://', 'https://')}
                  alt={project.title}
                  onError={(event) => { event.currentTarget.src = PLACEHOLDER_IMG }}
                  className="w-full h-full object-contain bg-black"
                />
              </button>
            ) : (
              <img src={PLACEHOLDER_IMG} alt="" className="w-full h-full object-contain bg-black" />
            )}
            {galleryMedia.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous project media"
                  onClick={() => moveGallery(-1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-[#0066FF]"
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next project media"
                  onClick={() => moveGallery(1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white hover:bg-[#0066FF]"
                >
                  ›
                </button>
              </>
            )}
          </div>
          {galleryMedia.length > 1 && (
            <div className="flex gap-3 overflow-x-auto py-1 stagger-item" aria-label="Project media thumbnails">
              {galleryMedia.map((item, index) => (
                <button
                  type="button"
                  key={`${item.url}-${index}`}
                  onClick={() => setSelectedMediaIndex(index)}
                  aria-label={`Show media ${index + 1}`}
                  aria-current={index === selectedMediaIndex}
                  className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2 ${index === selectedMediaIndex ? 'border-[#0066FF]' : 'border-white/10'}`}
                >
                  <img
                    src={getMediaPreview(item)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  {item.type === 'video' && <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">▶</span>}
                </button>
              ))}
            </div>
          )}

          {/* Combined Info Card - Matches Screenshot 1 Aesthetic */}
          <div className="bg-[#0D0D12] border border-white/5 rounded-[32px] p-8 space-y-8 stagger-item">
            
            {/* Author Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Link to={authorId ? `/profile/${encodeURIComponent(authorId)}` : '/profile'} className="w-14 h-14 rounded-full bg-[#1A1A20] p-1 border border-white/5 shrink-0 overflow-hidden">
                  <img
                    src={project.avatar || project.owner?.photoURL || project.author?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authorName)}`}
                    alt={authorName}
                    className="w-full h-full object-cover rounded-full"
                  />
                </Link>
                <div className="min-w-0">
                  <Link to={authorId ? `/profile/${encodeURIComponent(authorId)}` : '/profile'} className="font-syne font-black text-white text-lg leading-tight mb-1 truncate hover:text-[#0066FF]">
                    {authorName}
                  </Link>
                  <p className="text-[#666] text-xs font-bold tracking-tight">
                    {new Date(project.createdAt?.seconds ? project.createdAt.seconds * 1000 : project.createdAt || Date.now()).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {user?.uid === authorId ? (
                <button
                  type="button"
                  onClick={() => navigate(`/edit/project/${encodeURIComponent(project.id)}`)}
                  className="bg-white/10 hover:bg-white/15 text-white text-xs font-black px-6 py-2.5 rounded-xl transition-all"
                >
                  Edit Post
                </button>
              ) : (
              <button
                type="button"
                onClick={handleMessage}
                className="bg-[#0066FF] hover:bg-[#0055EE] text-white text-xs font-black px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-[0_8px_20px_rgba(0,102,255,0.15)]"
              >
                Message {authorFirstName}
              </button>
              )}
            </div>

            {/* Post Header */}
            <div>
              <h1 className="font-syne font-black text-white text-3xl sm:text-4xl leading-[1.15] mb-6 tracking-tight">
                {project.title}
              </h1>
              <div className="prose prose-invert max-w-none">
                <pre className="text-[#AAA] text-base leading-relaxed font-medium whitespace-pre-wrap font-sans">
                  {project.description}
                </pre>
              </div>
              {projectLinks.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {projectLinks.map((link, index) => (
                    <a
                      key={`${link.url}-${index}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-4 py-2 text-xs font-black text-[#60A5FA] hover:bg-[#0066FF]/20"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
              {actionError && <p role="alert" className="text-sm font-bold text-red-400">{actionError}</p>}
            </div>

            {/* Interaction Bar */}
            <div className="flex items-center gap-6 pt-6 border-t border-white/5">
              <button
                type="button"
                onClick={handleLike}
                disabled={likePending}
                aria-pressed={isLiked}
                className={`flex items-center gap-2.5 cursor-pointer transition-all group disabled:opacity-70 ${isLiked ? 'text-[#0066FF]' : 'text-[#888] hover:text-white'}`}
              >
                <svg 
                  className={`w-6 h-6 transition-transform group-active:scale-125 ${isLiked ? 'scale-110' : 'group-hover:scale-110'}`} 
                  viewBox="0 0 24 24" 
                  fill={isLiked ? "currentColor" : "none"} 
                  stroke="currentColor" 
                  strokeWidth="2.5"
                >
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                </svg>
                <span className="text-sm font-black">{likesCount}</span>
              </button>
              <div className="flex items-center gap-2.5 text-[#888] hover:text-white cursor-pointer transition-colors group">
                <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                </svg>
                <span className="text-sm font-black">{commentsCount}</span>
              </div>
            </div>
          </div>

          {/* Comments Section - In its own card */}
          <div className="bg-[#0D0D12] border border-white/5 rounded-[32px] p-8 space-y-8 stagger-item">
             <h3 className="font-syne font-black text-xl text-white">Comments ({commentsCount})</h3>
             {projectError && <p role="alert" className="text-sm font-bold text-red-400">{projectError}</p>}
             
             <form onSubmit={handleCommentSubmit} className="relative flex gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/5">
                   {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-white bg-gradient-to-br from-white/10 to-transparent">?</div>}
                </div>
                <div className="flex-1 relative">
                  <textarea 
                    value={commentText}
                    maxLength={1000}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleCommentSubmit(e); }}
                    placeholder="Add a comment..."
                    aria-label="Add a comment"
                    className="w-full bg-[#121218] border border-white/5 rounded-2xl px-6 py-4 text-white text-sm min-h-[100px] outline-none focus:border-[#0066FF]/40 transition-all resize-none"
                  />
                  <button 
                    type="submit"
                    disabled={!commentText.trim() || commentText.trim().length > 1000 || submittingComment}
                    className="absolute bottom-4 right-4 w-10 h-10 rounded-xl bg-[#0066FF] text-white flex items-center justify-center hover:scale-105 transition-all disabled:opacity-30 disabled:grayscale"
                  >
                     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                  </button>
                  <span className="absolute bottom-1 left-6 text-[10px] text-[#555]">
                    {commentText.length}/1000
                  </span>
                </div>
             </form>

             <div className="space-y-6">
                {commentsError ? (
                  <p role="alert" className="text-center text-red-400 font-bold text-sm py-8">{commentsError}</p>
                ) : comments.length > 0 ? (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex gap-4 group">
                       <div className="w-10 h-10 rounded-full overflow-hidden bg-white/5 shrink-0 border border-white/10">
                          <Link to={`/profile/${encodeURIComponent(comment.authorId)}`}>
                            <img src={comment.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(comment.userName)}`} alt={comment.userName} className="w-full h-full object-cover" />
                          </Link>
                       </div>
                       <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-3">
                             <Link to={`/profile/${encodeURIComponent(comment.authorId)}`} className="text-sm font-black text-white hover:text-[#0066FF]">{comment.userName}</Link>
                             <span className="text-[10px] font-bold text-[#444] uppercase tracking-widest">
                               {formatRelativeTime(comment.createdAt)}
                             </span>
                          </div>
                          <p className="text-[#AAA] text-sm leading-relaxed font-medium">
                             {comment.text}
                          </p>
                       </div>
                       {(user?.uid === comment.authorId || user?.uid === authorId) && (
                         <button
                           type="button"
                           onClick={() => handleDeleteComment(comment.id)}
                           disabled={deletingCommentId === comment.id}
                           className="self-start text-xs font-bold text-[#666] opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100 disabled:opacity-50"
                         >
                           {deletingCommentId === comment.id ? 'Deleting…' : 'Delete'}
                         </button>
                       )}
                    </div>
                  ))
                ) : !loadingComments && (
                  <p className="text-center text-[#444] font-bold text-sm py-8 tracking-tight italic">
                    No comments yet. Be the first to comment!
                  </p>
                )}
             </div>
          </div>
        </div>

        {/* Sidebar: Related Posts */}
        <div className="space-y-6 stagger-item">
           <h3 className="font-syne font-black text-xl text-white tracking-tight border-l-4 border-[#0066FF] pl-4">Related Posts</h3>
           <div className="flex flex-col gap-5">
              {relatedMatches.map((rp, i) => {
                const thumb = getMediaPreview(rp);
                return (
                  <button type="button" key={rp.id || i} onClick={() => onOpenRelated?.(rp)} className="group relative aspect-[3/4] bg-[#111115] rounded-[24px] overflow-hidden border border-white/5 cursor-pointer hover:border-[#0066FF]/30 transition-all text-left">
                    <img 
                      src={thumb} 
                      alt={rp.title} 
                      loading="lazy"
                      onError={(e) => { e.target.src = PLACEHOLDER_IMG }}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end">
                       <p className="text-white text-xs font-bold leading-tight line-clamp-2">{rp.title}</p>
                       <p className="text-[#0066FF] text-[9px] uppercase font-black tracking-widest mt-1">
                         {rp.category?.toLowerCase().includes('video') ? 'View Video Proof' : 'View Design'}
                       </p>
                    </div>
                  </button>
                )
              })}
              {relatedMatches.length === 0 && (
                <p className="rounded-2xl border border-white/5 bg-[#111115] p-5 text-sm font-medium text-[#666]">
                  No related posts in this category yet.
                </p>
              )}
           </div>
        </div>

      </div>

      {lightboxOpen && selectedMedia?.type !== 'video' && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            aria-label="Close fullscreen image"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-6 top-6 z-10 rounded-full bg-white/10 px-4 py-2 text-2xl text-white hover:bg-white/20"
          >
            ×
          </button>
          <img
            src={selectedMedia?.url}
            alt={project.title}
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null }}
            onTouchEnd={(event) => {
              const startX = touchStartX.current
              const endX = event.changedTouches[0]?.clientX
              if (galleryMedia.length > 1 && startX !== null && typeof endX === 'number' && Math.abs(endX - startX) > 50) {
                moveGallery(endX < startX ? 1 : -1)
              }
              touchStartX.current = null
            }}
            className="max-h-full max-w-full object-contain"
          />
          {galleryMedia.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(event) => { event.stopPropagation(); moveGallery(-1) }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-4 text-2xl text-white hover:bg-[#0066FF]"
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(event) => { event.stopPropagation(); moveGallery(1) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-4 text-2xl text-white hover:bg-[#0066FF]"
              >
                ›
              </button>
            </>
          )}
        </div>
      )}

      {/* Suggested Section Bottom */}
      <div className="mt-20 pt-16 border-t border-white/5 stagger-item">
          <h3 className="font-syne font-black text-3xl text-white mb-10 text-center tracking-tight">More to explore</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 px-2">
             {(relatedProjects || []).filter((item) => item.id !== project.id).slice(0, 8).map((rp, i) => {
                const thumb = getMediaPreview(rp);
                return (
                  <button
                    type="button"
                    key={rp.id || i}
                    onClick={() => onOpenRelated?.(rp)}
                    className="group relative aspect-[4/3] bg-[#111115] rounded-[28px] overflow-hidden border border-white/5 hover:border-[#0066FF]/30 transition-all cursor-pointer shadow-lg"
                  >
                    <img 
                      src={thumb} 
                      alt={rp.title} 
                      onError={(e) => { e.target.src = PLACEHOLDER_IMG }}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-6 text-center">
                       <span className="text-white font-black text-[10px] uppercase tracking-[0.2em] bg-white/10 backdrop-blur-xl px-5 py-2.5 rounded-full border border-white/20 shadow-2xl">View Project</span>
                    </div>
                </button>
              )
            })}
          </div>
      </div>

    </div>
  )
}
