import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import Sidebar from '../components/Sidebar'
import VirtualizedProjectGrid from '../components/VirtualizedProjectGrid'
import ProjectDetailView from '../components/ProjectDetailView'
import { fetchProjectsPage, fetchSmartSearch } from '../lib/data'
import { auth } from '../lib/auth'
import useNotifications from '../lib/useNotifications'

const sortValues = {
  Relevance: 'newest',
  'Price: Low to High': 'price_asc',
  'Price: High to Low': 'price_desc',
  Popular: 'popular',
}

export default function Explore() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialQuery = searchParams.get('q') || ''
  const user = auth.getUser()
  const { unreadCount: unreadNotifications } = useNotifications(user?.uid)

  const [allProjects, setAllProjects] = useState([])
  const [relatedProjects, setRelatedProjects] = useState([])
  const [totalProjects, setTotalProjects] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [loadMoreError, setLoadMoreError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState(null)
  const [retryNonce, setRetryNonce] = useState(0)

  const [search, setSearch] = useState(initialQuery)
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery)
  const [sort, setSort] = useState('Relevance')
  const viewMode = 'grid'
  const [selectedProject, setSelectedProject] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  const [aiMode, setAiMode] = useState(false)
  const [aiResults, setAiResults] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDegraded, setAiDegraded] = useState(false)

  const containerRef = useRef(null)
  const loadMoreRef = useRef(null)
  const loadMoreLockRef = useRef(false)
  const loadMoreControllerRef = useRef(null)
  const aiSearchControllerRef = useRef(null)

  useEffect(() => {
    if (!selectedProject?.category) {
      setRelatedProjects([])
      return undefined
    }

    const controller = new AbortController()
    fetchProjectsPage({
      category: selectedProject.category,
      signal: controller.signal,
    })
      .then(({ items }) => {
        if (!controller.signal.aborted) setRelatedProjects(items)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setRelatedProjects([])
          console.error('Related projects failed to load:', error)
        }
      })

    return () => controller.abort()
  }, [selectedProject?.category, selectedProject?.id])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    aiSearchControllerRef.current?.abort()
    aiSearchControllerRef.current = null
    setAiLoading(false)
    setAiResults(null)
    setAiDegraded(false)
    return () => aiSearchControllerRef.current?.abort()
  }, [search])

  // Keep the search input responsive while avoiding a request per keystroke.
  useEffect(() => {
    const controller = new AbortController()
    loadMoreControllerRef.current?.abort()
    loadMoreLockRef.current = false
    setAllProjects([])
    setTotalProjects(null)
    setNextCursor(null)
    setLoadError('')
    setLoadMoreError('')
    setLoading(true)
    setLoadingMore(false)

    fetchProjectsPage({
      q: debouncedSearch.trim(),
      sort: sortValues[sort] || 'newest',
      signal: controller.signal,
    })
      .then(({ items, nextCursor: cursor, total }) => {
        setAllProjects(items)
        setNextCursor(cursor)
        setTotalProjects(typeof total === 'number' ? total : null)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setLoadError(error.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [debouncedSearch, sort, retryNonce])

  const loadNextPage = useCallback(async () => {
    if (!nextCursor || loading || loadMoreLockRef.current) return

    const controller = new AbortController()
    loadMoreControllerRef.current = controller
    loadMoreLockRef.current = true
    setLoadingMore(true)
    setLoadMoreError('')
    try {
      const page = await fetchProjectsPage({
        q: debouncedSearch.trim(),
        sort: sortValues[sort] || 'newest',
        cursor: nextCursor,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        setAllProjects((projects) => {
          const knownIds = new Set(projects.map(({ id }) => id))
          return [...projects, ...page.items.filter(({ id }) => !knownIds.has(id))]
        })
        setNextCursor(page.nextCursor)
      }
    } catch (error) {
      if (!controller.signal.aborted) setLoadMoreError(error.message)
    } finally {
      if (loadMoreControllerRef.current === controller) {
        loadMoreControllerRef.current = null
        loadMoreLockRef.current = false
        setLoadingMore(false)
      }
    }
  }, [debouncedSearch, loading, nextCursor, sort])

  useEffect(() => {
    const sentinel = loadMoreRef.current
    if (!sentinel || loading || loadingMore || loadMoreError || !nextCursor) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadNextPage()
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadNextPage, loading, loadingMore, loadMoreError, nextCursor])

  // Sync search state if URL param changes
  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null) setSearch(q)
  }, [searchParams])

  const handleAISearch = async () => {
    const query = search.trim()
    if (!query || aiSearchControllerRef.current) return
    aiSearchControllerRef.current?.abort()
    const controller = new AbortController()
    aiSearchControllerRef.current = controller
    setAiLoading(true);
    setAiResults(null);
    try {
      const results = await fetchSmartSearch(query, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setAiResults(results.items);
        setAiDegraded(results.meta.degraded === true);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setAiResults(null);
        setAiDegraded(true);
        console.error('Smart search failed:', err);
      }
    } finally {
      if (aiSearchControllerRef.current === controller) {
        aiSearchControllerRef.current = null
        setAiLoading(false)
      }
    }
  };

  const filtered = useMemo(() => {
    return aiMode && aiResults ? aiResults : allProjects
  }, [allProjects, aiMode, aiResults])

  // Count live (DB-sourced) projects in the current filtered set
  const liveCount = useMemo(
    () => filtered.filter((project) => project.source === 'live').length,
    [filtered],
  )

  useGSAP(() => {
    if (!selectedProject && filtered.length > 0) {
      // Small delay to ensure DOM is ready
      const cards = gsap.utils.toArray('.project-card');
      if (cards.length > 0) {
        gsap.fromTo(cards,
          { opacity: 0, y: 30, scale: 0.95 },
          {
            opacity: 1, y: 0, scale: 1,
            stagger: { each: 0.05 },
            duration: 0.8,
            ease: 'power4.out',
            clearProps: 'all'
          }
        )
      }
    }

    const header = document.querySelector('.explore-header');
    if (header) {
      gsap.fromTo(header,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.4)' }
      )
    }
  }, { scope: containerRef, dependencies: [filtered.length, viewMode, selectedProject, sort] })


  return (
    <div className="flex min-h-screen bg-[#09090B] overflow-x-hidden text-white">
      {/* Sidebar - Desktop only */}
      <div className={`hidden lg:block shrink-0 transition-all duration-300 ${collapsed ? 'w-[78px]' : 'w-[240px]'}`}>
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0" ref={containerRef}>

        {/* MOBILE TOP BAR */}
        <div className="lg:hidden sticky top-[58px] z-40 bg-[#09090B]/95 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#121216] border border-white/5 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-[#555] focus:border-[#0066FF]/40 outline-none"
            />
          </div>
        </div>

        {/* DESKTOP TOP SEARCH AREA */}
        <header className="explore-header hidden lg:flex sticky top-0 z-50 bg-[#09090B]/80 backdrop-blur-xl border-b border-white/5 px-6 py-4 items-center justify-between gap-6">
          <div className="flex-1 max-w-[800px] mx-auto flex items-center gap-3">
            <div className="flex-1 relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555] group-focus-within:text-[#0066FF] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                placeholder={aiMode ? "Describe your project demand (e.g. 'I need a 3D animator for a game trailer')..." : "Search freelance projects, designers, or categories..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full bg-[#121216] border rounded-2xl pl-12 pr-16 py-3 text-[0.9rem] text-white placeholder-[#555] outline-none transition-all ${aiMode ? 'border-[#0066FF]/40 bg-[#0066FF]/5' : 'border-white/5 focus:border-[#0066FF]/40'
                  }`}
              />
              {aiMode && (
                <button
                  onClick={handleAISearch}
                  disabled={aiLoading || !search.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#0066FF] hover:bg-[#0055DD] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  {aiLoading ? '...' : 'AI Search'}
                </button>
              )}
            </div>

            {/* AI Toggle */}
            <div
              onClick={() => {
                const NewMode = !aiMode;
                setAiMode(NewMode);
                if (!NewMode) {
                  aiSearchControllerRef.current?.abort()
                  aiSearchControllerRef.current = null
                  setAiLoading(false)
                  setAiResults(null);
                  setAiDegraded(false);
                }
              }}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl border cursor-pointer transition-all duration-300 ${aiMode
                  ? 'bg-[#0066FF]/10 border-[#0066FF]/30 text-[#0066FF]'
                  : 'bg-white/5 border-white/5 text-[#555] hover:border-white/10'
                }`}
            >
              <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${aiMode ? 'bg-[#0066FF]' : 'bg-[#222]'}`}>
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-300 ${aiMode ? 'left-4.5' : 'left-0.5'}`} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">AI Mode</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                aria-label={unreadNotifications ? `${unreadNotifications} unread notifications` : 'Notifications'}
                className="relative w-11 h-11 rounded-2xl bg-[#121216] border border-white/5 flex items-center justify-center text-[#555] hover:text-white hover:border-white/10 transition-all"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                {unreadNotifications > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#09090B] bg-[#0066FF] px-1 text-[9px] font-black text-white">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {selectedProject ? (
          <ProjectDetailView
            project={selectedProject}
            onClose={() => setSelectedProject(null)}
            relatedProjects={relatedProjects}
            onOpenRelated={setSelectedProject}
          />
        ) : (
          <div className="p-4 md:p-6">
            {/* TOP ROW - Sort & Count */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
              <div className="flex items-center gap-3">
                <span className="font-syne font-extrabold text-[#0066FF] bg-[#0066FF]/10 border border-[#0066FF]/20 px-3 py-1 rounded-lg text-sm">
                  {loading ? '...' : aiMode && aiResults ? aiResults.length : totalProjects ?? filtered.length}
                </span>
                <span className="text-[#666] text-sm font-bold uppercase tracking-wider">talents found</span>
                {!loading && liveCount > 0 && (
                  <span className="flex items-center gap-1.5 text-[#00FF88] bg-[#00FF88]/10 border border-[#00FF88]/20 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00FF88] animate-pulse" />
                    {liveCount} live
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden pb-1">
                {['Relevance', 'Price: Low to High', 'Price: High to Low', 'Popular'].map(s => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`whitespace-nowrap text-[0.75rem] font-bold px-3 py-1.5 rounded-full border transition-all ${sort === s
                      ? 'bg-[#0066FF] border-[#0066FF] text-white shadow-[0_0_15px_rgba(0,102,255,0.3)]'
                      : 'border-white/5 text-[#555] hover:text-white hover:bg-white/5 cursor-pointer'
                      }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* CONTENT GRID */}
            {aiMode && aiDegraded && (
              <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                AI ranking is temporarily unavailable. Showing deterministic search results.
              </p>
            )}
            {loading || aiLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-[#121216]/50 border border-white/5 rounded-[24px] h-[320px] animate-pulse flex flex-col items-center justify-center gap-4">
                    {aiLoading && i === 0 && (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-[#0066FF] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[10px] font-black uppercase text-[#0066FF] tracking-widest">AI Analyzing...</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="mt-20 flex flex-col items-center justify-center text-center">
                <h3 className="font-bold text-white text-lg mb-1">Projects could not be loaded</h3>
                <p className="text-[#888] text-sm mb-4">{loadError}</p>
                <button
                  onClick={() => setRetryNonce((value) => value + 1)}
                  className="bg-[#0066FF] px-4 py-2 rounded-xl text-xs font-black uppercase"
                >
                  Try again
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="mt-20 flex flex-col items-center justify-center text-center opacity-50">
                <div className="w-16 h-16 rounded-full bg-[#121216] border border-white/5 flex items-center justify-center text-2xl mb-4">🔍</div>
                <h3 className="font-bold text-white text-lg mb-1">No talents found</h3>
                <p className="text-[#666] text-sm mb-4">Try adjusting your filters or search query.</p>
                <button
                  className="text-xs font-black px-5 py-2.5 bg-[#0066FF] text-white rounded-xl hover:scale-105 transition-all"
                  onClick={() => setSearch('')}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <VirtualizedProjectGrid
                projects={filtered}
                onSelect={setSelectedProject}
              />
            )}
            {!loading && !loadError && !aiMode && nextCursor && (
              <div ref={loadMoreRef} className="h-8" aria-hidden="true" />
            )}
            {!loading && !loadError && !aiMode && (loadingMore || loadMoreError) && (
              <div className="py-5 text-center">
                {loadingMore ? (
                  <span className="text-sm text-[#888]">Loading more projects…</span>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-sm text-[#888]">{loadMoreError}</span>
                    <button
                      onClick={loadNextPage}
                      className="text-sm font-bold text-[#60A5FA] hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
