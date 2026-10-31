import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import Sidebar from '../components/Sidebar'
import { auth } from '../lib/auth'
import {
  createConversation,
  deleteProjectDB,
  fetchCurrentProfile,
  fetchDashboard,
  fetchMyApplications,
  fetchMyJobs,
  fetchProjectsPage,
  fetchServicesPage,
} from '../lib/data'
import { fetchJobsPage } from '../lib/jobData'
import { deleteServiceDB } from '../lib/serviceData'

const icons = {
  earnings: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  listings: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5v10a2 2 0 002 2z',
  satisfaction: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  engagement: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14v8h-5l-5 5v-5z',
}

export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(false)
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [role, setRole] = useState(null)
  const [marketplaceItems, setMarketplaceItems] = useState([])
  const [myJobs, setMyJobs] = useState([])
  const [myApplications, setMyApplications] = useState([])
  const [marketplaceLoading, setMarketplaceLoading] = useState(false)
  const [marketplaceError, setMarketplaceError] = useState('')
  const [contactingUid, setContactingUid] = useState('')
  const containerRef = useRef(null)
  const user = auth.getUser()
  const navigate = useNavigate()
  const projects = dashboard?.projects || []
  const services = dashboard?.services || []

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [nextDashboard, profile] = await Promise.all([
        fetchDashboard(),
        fetchCurrentProfile(),
      ])
      setDashboard(nextDashboard)
      setRole(profile.role)
    } catch (error) {
      setDashboard(null)
      setLoadError(error.message || 'Unable to load dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard, user?.uid])

  useEffect(() => {
    if (!role || role === 'admin') {
      setMarketplaceItems([])
      return undefined
    }

    const controller = new AbortController()
    let active = true
    setMarketplaceLoading(true)
    setMarketplaceError('')

    const loadMarketplace = async () => {
      try {
        if (role === 'freelancer') {
          const [jobsResult, applicationsResult] = await Promise.all([
            fetchJobsPage({
              limit: 6,
              sort: 'newest',
              signal: controller.signal,
            }),
            fetchMyApplications({ limit: 6 }),
          ])
          if (active) {
            setMarketplaceItems(jobsResult.items)
            setMyApplications(applicationsResult.items)
            setMyJobs([])
          }
        } else {
          const [projectsPage, servicesPage, jobsPage] = await Promise.all([
            fetchProjectsPage({ limit: 6, sort: 'newest', signal: controller.signal }),
            fetchServicesPage({ limit: 6, sort: 'newest', signal: controller.signal }),
            fetchMyJobs({ limit: 6 }),
          ])
          if (active) {
            setMyJobs(jobsPage.items)
            setMyApplications([])
            setMarketplaceItems(
              [
                ...projectsPage.items.map((item) => ({ ...item, listingType: 'project' })),
                ...servicesPage.items.map((item) => ({ ...item, listingType: 'service' })),
              ]
                .filter((item) => item.ownerId !== user?.uid)
                .sort((left, right) => Date.parse(right.createdAt || 0) - Date.parse(left.createdAt || 0))
                .slice(0, 8),
            )
          }
        }
      } catch (error) {
        if (active && error.name !== 'AbortError') {
          setMarketplaceError(error.message || 'Unable to load marketplace posts.')
          setMarketplaceItems([])
          setMyJobs([])
          setMyApplications([])
        }
      } finally {
        if (active) setMarketplaceLoading(false)
      }
    }

    loadMarketplace()
    return () => {
      active = false
      controller.abort()
    }
  }, [role, user?.uid])

  useEffect(() => {
    const context = gsap.context(() => {
      gsap.from('.dash-card', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out',
      })
    }, containerRef)
    return () => context.revert()
  }, [loading])

  const handleDelete = async (type, id) => {
    if (!window.confirm('Delete this listing permanently?')) return
    try {
      if (type === 'project') await deleteProjectDB(id)
      else await deleteServiceDB(id)
      await loadDashboard()
    } catch (error) {
      window.alert(error.message || 'Delete failed')
    }
  }

  const loadMore = async () => {
    if (!dashboard?.pagination) return
    setLoadingMore(true)
    setLoadError('')
    try {
      const next = await fetchDashboard({
        limit: 50,
        projectCursor:
          dashboard.pagination.projectsNextCursor || '__done__',
        serviceCursor:
          dashboard.pagination.servicesNextCursor || '__done__',
      })
      setDashboard((current) => ({
        ...next,
        projects: [...(current?.projects || []), ...next.projects],
        services: [...(current?.services || []), ...next.services],
      }))
    } catch (error) {
      setLoadError(error.message || 'Unable to load more listings.')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleContactFreelancer = async (recipientId) => {
    setContactingUid(recipientId)
    setMarketplaceError('')
    try {
      const conversation = await createConversation(recipientId)
      navigate(`/messages/${encodeURIComponent(conversation.id)}`)
    } catch (error) {
      setMarketplaceError(error.message || 'Unable to start a conversation.')
    } finally {
      setContactingUid('')
    }
  }

  const earnings = dashboard?.earnings?.total ?? 0
  const earningsValue = dashboard?.earnings?.currency
    ? new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: dashboard.earnings.currency,
        maximumFractionDigits: 2,
      }).format(earnings)
    : String(earnings)
  const engagement = dashboard?.engagement || { likes: 0, comments: 0, views: 0 }
  const stats = [
    {
      label: 'Ledger Earnings',
      value: earningsValue,
      detail: 'Released or paid',
      icon: icons.earnings,
    },
    {
      label: 'Total Listings',
      value: String(dashboard?.counts?.listings ?? 0),
      detail: `${dashboard?.counts?.projects?.byStatus?.published ?? 0} projects · ${dashboard?.counts?.services?.byStatus?.published ?? 0} services published`,
      icon: icons.listings,
    },
    {
      label: 'Client Satisfaction',
      value:
        dashboard?.satisfaction?.ratingAvg == null
          ? '—'
          : `${dashboard.satisfaction.ratingAvg.toFixed(1)} / 5`,
      detail: `${dashboard?.satisfaction?.ratingCount ?? 0} ratings`,
      icon: icons.satisfaction,
    },
    {
      label: 'Listing Engagement',
      value: String(engagement.likes + engagement.comments + engagement.views),
      detail: `${engagement.likes} likes · ${engagement.comments} comments · ${engagement.views} views`,
      icon: icons.engagement,
    },
  ]

  return (
    <div
      className="flex h-screen bg-[#09090B] text-white overflow-hidden"
      ref={containerRef}
    >
      <div
        className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? 'w-[78px]' : 'w-[240px]'}`}
      >
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 flex flex-col p-8 overflow-y-auto">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight mb-2">
              Dashboard
            </h1>
            <p className="text-[#555] font-bold text-xs uppercase tracking-[3px]">
              Welcome back, {user?.name || 'User'}
            </p>
          </div>
          <button
            onClick={() => navigate(role === 'client' ? '/jobs/create' : '/post-work')}
            disabled={!role || role === 'admin'}
            className="bg-[#0066FF] px-6 py-2.5 rounded-xl text-xs font-black uppercase shadow-[0_10px_30px_rgba(0,102,255,0.3)] hover:scale-105 active:scale-95 transition-all"
          >
            {role === 'client' ? 'Post a Job' : role === 'freelancer' ? 'Post Work' : 'Loading…'}
          </button>
        </header>

        {loadError && (
          <div
            role="alert"
            className="mb-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300"
          >
            <p>{loadError}</p>
            <button
              onClick={loadDashboard}
              className="mt-3 font-bold underline"
            >
              Try again
            </button>
          </div>
        )}

        {role === 'freelancer' && (
          <section className="mb-10 rounded-[32px] border border-white/5 bg-[#121216] p-6 sm:p-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[3px] text-[#0066FF]">Find work</p>
                <h2 className="text-xl font-black">Client projects for you</h2>
              </div>
              <button onClick={() => navigate('/jobs')} className="text-xs font-black uppercase tracking-wider text-[#888] transition hover:text-white">Browse all jobs →</button>
            </div>
            {marketplaceError && <p role="alert" className="mb-4 text-sm text-red-300">{marketplaceError}</p>}
            {marketplaceLoading ? (
              <p className="py-8 text-sm text-[#777]">Loading client projects…</p>
            ) : marketplaceItems.length === 0 ? (
              <p className="py-8 text-sm text-[#777]">No open client projects yet. Check back soon.</p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {marketplaceItems.map((job) => (
                  <article key={job.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-black text-white">{job.title}</h3>
                        <p className="mt-1 text-xs text-[#777]">Posted by {job.owner?.displayName || 'Client'}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#0066FF]/10 px-3 py-1 text-xs font-bold text-[#5b9aff]">
                        ₹{Number(job.budgetMin || 0).toLocaleString('en-IN')}–₹{Number(job.budgetMax || 0).toLocaleString('en-IN')}
                        {job.budgetType === 'hourly' ? ' / hour' : ''}
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#999]">{job.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(job.skills || []).slice(0, 5).map((skill) => (
                        <span key={skill} className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold text-[#aaa]">{skill}</span>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#777]">
                      <span>Experience: {job.experienceLevel || 'All levels'}</span>
                      <span>Deadline: {job.deadlineDate ? new Date(`${job.deadlineDate}T00:00:00`).toLocaleDateString() : job.deadlineDays ? `${job.deadlineDays} days` : 'To be discussed'}</span>
                      {job.projectDuration && <span>Duration: {job.projectDuration}</span>}
                      {job.workMode && <span>Work mode: {job.workMode === 'onsite' ? 'On-site' : job.workMode}</span>}
                    </div>
                    <button onClick={() => navigate(`/jobs/${encodeURIComponent(job.id)}`)} className="mt-5 w-full rounded-xl bg-[#0066FF] px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#0055ee]">Apply Now</button>
                  </article>
                ))}
              </div>
            )}
            {myApplications.length > 0 && (
              <div className="mt-8 border-t border-white/[0.06] pt-6">
                <h3 className="mb-3 text-sm font-black">My applications</h3>
                <div className="space-y-2">
                  {myApplications.map(({ id, status, job }) => (
                    <button key={id} onClick={() => navigate(`/jobs/${encodeURIComponent(job?.id || id.split('_')[0])}`)} className="flex w-full items-center justify-between gap-4 rounded-xl bg-white/[0.025] px-4 py-3 text-left transition hover:bg-white/[0.05]">
                      <span className="truncate text-sm font-bold">{job?.title || 'Project application'}</span>
                      <span className="shrink-0 text-xs font-bold capitalize text-[#8bb6ff]">{status}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {role === 'client' && (
          <section className="mb-10 rounded-[32px] border border-white/5 bg-[#121216] p-6 sm:p-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[3px] text-[#0066FF]">Discover talent</p>
                <h2 className="text-xl font-black">Freelancer work and portfolios</h2>
              </div>
              <button onClick={() => navigate('/explore')} className="text-xs font-black uppercase tracking-wider text-[#888] transition hover:text-white">Explore all →</button>
            </div>
            {marketplaceError && <p role="alert" className="mb-4 text-sm text-red-300">{marketplaceError}</p>}
            {marketplaceLoading ? (
              <p className="py-8 text-sm text-[#777]">Loading freelancer portfolios…</p>
            ) : marketplaceItems.length === 0 ? (
              <p className="py-8 text-sm text-[#777]">No freelancer portfolios have been published yet.</p>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {marketplaceItems.map((item) => (
                  <article key={`${item.listingType}-${item.id}`} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                    <div className="flex items-start gap-4">
                      {item.owner?.photoURL ? (
                        <img src={item.owner.photoURL} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-[#1a1a20] object-cover" />
                      ) : (
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#0066FF]/20 font-black text-[#8bb6ff]">
                          {(item.owner?.displayName || 'F').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black">{item.owner?.displayName || 'Freelancer'}</p>
                        <p className="mt-1 text-[11px] text-[#777]">{item.owner?.headline || item.categoryLabel || item.category}</p>
                        <h3 className="mt-2 font-bold text-white">{item.title}</h3>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#999]">{item.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[...new Set([...(item.owner?.skills || []), ...(item.skills || [])])].slice(0, 6).map((skill) => (
                        <span key={skill} className="rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold text-[#aaa]">{skill}</span>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#777]">
                      <span>Experience: {item.owner?.experience?.[0]?.title || item.level || 'Profile details'}</span>
                      <span>Expected price: {Number.isFinite(item.price) ? `₹${item.price.toLocaleString('en-IN')}` : 'Contact for quote'}</span>
                    </div>
                    <div className="mt-5 flex gap-2">
                      <button onClick={() => navigate(`/profile/${encodeURIComponent(item.ownerId)}`)} className="flex-1 rounded-xl border border-white/10 px-3 py-3 text-xs font-black uppercase tracking-wider text-[#aaa] transition hover:text-white">View Profile</button>
                      <button onClick={() => handleContactFreelancer(item.ownerId)} disabled={contactingUid === item.ownerId} className="flex-1 rounded-xl bg-[#0066FF] px-3 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#0055ee] disabled:opacity-50">{contactingUid === item.ownerId ? 'Opening…' : 'Hire / Contact'}</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="mt-8 border-t border-white/[0.06] pt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-black">Your job posts</h3>
                <button onClick={() => navigate('/jobs/create')} className="text-[10px] font-black uppercase tracking-wider text-[#5b9aff]">Post another</button>
              </div>
              {myJobs.length === 0 ? (
                <p className="text-sm text-[#777]">You haven't posted a job yet.</p>
              ) : (
                <div className="space-y-2">
                  {myJobs.map((job) => (
                    <button key={job.id} onClick={() => navigate(`/jobs/${encodeURIComponent(job.id)}`)} className="flex w-full items-center justify-between gap-4 rounded-xl bg-white/[0.025] px-4 py-3 text-left transition hover:bg-white/[0.05]">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">{job.title}</span>
                        <span className="mt-1 block text-[11px] text-[#777]">{job.applicationsCount} application{job.applicationsCount === 1 ? '' : 's'} · {job.status}</span>
                      </span>
                      <span className="shrink-0 text-xs font-bold text-[#8bb6ff]">Manage →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="dash-card bg-[#121216] border border-white/5 p-6 rounded-[32px] hover:border-[#0066FF]/30 transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-[#444] group-hover:text-[#0066FF] transition-colors mb-4">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d={stat.icon} />
                </svg>
              </div>
              <h3 className="text-2xl font-black mb-1">
                {loading ? '…' : loadError && !dashboard ? '—' : stat.value}
              </h3>
              <p className="text-[10px] font-black text-[#888] uppercase tracking-widest leading-none">
                {stat.label}
              </p>
              <p className="mt-2 text-[10px] font-bold text-[#555]">
                {loadError && !dashboard ? 'Unavailable' : stat.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          <section className="dash-card lg:col-span-2 bg-[#121216] border border-white/5 p-8 rounded-[40px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-black uppercase tracking-tight">
                My Listings
              </h2>
              <span className="text-[10px] font-black py-1 px-3 bg-[#0066FF]/20 text-[#0066FF] rounded-full uppercase tabular-nums">
                {dashboard?.counts?.listings ?? 0} Total
              </span>
            </div>

            {loading ? (
              <p className="py-12 text-center text-sm text-[#555]">
                Loading your listings…
              </p>
            ) : !loadError && projects.length === 0 && services.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[40px]">
                <p className="text-[#555] font-black uppercase tracking-[3px] text-xs">
                  No listings found
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {[...projects.map((item) => ({ ...item, type: 'project' })), ...services.map((item) => ({ ...item, type: 'service' }))].map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center justify-between p-5 rounded-3xl bg-white/[0.02] border border-white/5 group hover:border-[#0066FF]/20 transition-all"
                  >
                    <div className="flex items-center gap-5 flex-1 min-w-0">
                      <img
                        src={item.imageUrl || item.image}
                        alt=""
                        className="w-14 h-14 rounded-2xl object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <h4 className="text-sm font-black mb-1 group-hover:text-[#0066FF] transition-colors truncate">
                          {item.title}
                        </h4>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#666]">
                          {item.categoryLabel || item.category} · {item.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-6">
                      {item.type === 'project' && (
                        <Link
                          to={`/project/${item.id}/matches`}
                          className="px-3 md:px-4 py-2 bg-[#0066FF]/10 text-[#0066FF] hover:bg-[#0066FF] text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl hover:text-white transition-all mr-1 whitespace-nowrap"
                        >
                          Matches
                        </Link>
                      )}
                      <Link
                        to={`/edit/${item.type}/${item.id}`}
                        className="px-3 md:px-4 py-2 bg-white/5 hover:bg-[#0066FF] text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl text-[#888] hover:text-white transition-all"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(item.type, item.id)}
                        aria-label={`Delete ${item.title}`}
                        className="p-2 hover:bg-red-500/10 text-[#444] hover:text-red-500 transition-all"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {(dashboard?.pagination?.projectsNextCursor ||
                  dashboard?.pagination?.servicesNextCursor) && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#888] transition hover:border-[#0066FF]/30 hover:text-white disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading…' : 'Load More Listings'}
                  </button>
                )}
              </div>
            )}
          </section>

          <aside className="dash-card bg-[#121216] border border-white/5 p-8 rounded-[40px]">
            <h2 className="text-lg font-black uppercase tracking-tight mb-8">
              Listing Status
            </h2>
            <div className="space-y-6">
              {[
                ['Projects', dashboard?.counts?.projects?.byStatus],
                ['Services', dashboard?.counts?.services?.byStatus],
              ].map(([label, counts]) => (
                <div key={label}>
                  <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-[#888]">
                    {label} · {counts?.published ?? 0} published
                  </h3>
                  <dl className="space-y-2 text-xs">
                    {['draft', 'archived', 'deleted', 'other'].map((status) => (
                      <div
                        key={status}
                        className="flex justify-between text-[#666]"
                      >
                        <dt className="capitalize">{status}</dt>
                        <dd className="font-bold">{counts?.[status] ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-white/5 pt-6 text-xs text-[#666]">
              Applications: {dashboard?.applications?.sent ?? 0} sent ·{' '}
              {dashboard?.applications?.received ?? 0} received
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
