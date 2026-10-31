import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { gsap } from "gsap";
import Sidebar from "../components/Sidebar";
import { auth } from "../lib/auth";
import { fetchCurrentProfile } from "../lib/data";
import { fetchJobsPage } from "../lib/jobData";

const JOBS_PER_PAGE = 6;

export default function BrowseJobs() {
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState({ items: [], meta: null });
  const [cursorStack, setCursorStack] = useState([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accountRole, setAccountRole] = useState(null);
  const [roleError, setRoleError] = useState("");
  const [refreshNonce, setRefreshNonce] = useState(0);
  const navigate = useNavigate();
  const containerRef = useRef(null);

  useEffect(() => {
    let active = true;
    const loadRole = async () => {
      const currentUser = auth.getUser();
      if (!currentUser?.uid) {
        setAccountRole(null);
        setRoleError("");
        return;
      }
      try {
        const profile = await fetchCurrentProfile();
        if (active && auth.getUser()?.uid === currentUser.uid) {
          setAccountRole(profile.role);
          setRoleError("");
        }
      } catch (requestError) {
        if (active && auth.getUser()?.uid === currentUser.uid) {
          setAccountRole(null);
          setRoleError(
            requestError.message || "Unable to determine your account role.",
          );
        }
      }
    };
    window.addEventListener("auth-change", loadRole);
    loadRole();
    return () => {
      active = false;
      window.removeEventListener("auth-change", loadRole);
    };
  }, []);

  useEffect(() => {
    if (search.trim() === searchQuery) return undefined;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      setSearchQuery(search.trim());
      setCursorStack([null]);
      setPageIndex(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, searchQuery]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetchJobsPage({
      q: searchQuery,
      sort,
      limit: JOBS_PER_PAGE,
      cursor: cursorStack[pageIndex] ?? undefined,
      signal: controller.signal,
    })
      .then((result) => {
        if (active) {
          setPage(result);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active && !controller.signal.aborted) {
          setError(requestError.message || "Unable to load jobs.");
          setPage({ items: [], meta: null });
        }
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [searchQuery, sort, cursorStack, pageIndex, refreshNonce]);

  const jobs = page.items;
  const nextCursor = page.meta?.nextCursor;

  useEffect(() => {
    const header = containerRef.current?.querySelector(".jobs-header");
    const searchArea = containerRef.current?.querySelector(".search-area");
    const cards = containerRef.current?.querySelectorAll(".job-card");
    const ctx = gsap.context(() => {
      if (header) {
        gsap.from(header, {
          y: -20,
          opacity: 0,
          duration: 0.8,
          ease: "power4.out",
        });
      }
      if (searchArea) {
        gsap.from(searchArea, {
          y: 20,
          opacity: 0,
          duration: 0.8,
          delay: 0.2,
          ease: "power4.out",
        });
      }
      if (cards?.length) {
        gsap.from(cards, {
          scale: 0.95,
          opacity: 0,
          y: 30,
          duration: 0.6,
          stagger: 0.1,
          delay: 0.4,
          ease: "power3.out",
        });
      }
    }, containerRef);
    return () => ctx.revert();
  }, [jobs.length, sort]);

  return (
    <div
      className="flex min-h-screen bg-[#09090B] text-white overflow-hidden"
      ref={containerRef}
    >
      <div
        className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? "w-[78px]" : "w-[240px]"}`}
      >
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 min-w-0 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto">
          {/* Header */}
          <div className="jobs-header flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
            <div>
              <h1 className="text-[2.5rem] font-black uppercase tracking-tight leading-tight">
                Jobs For You
              </h1>
              <p className="text-[#666] text-lg font-medium">
                {page.meta?.total !== undefined
                  ? `${page.meta.total} jobs available`
                  : "Browse open jobs"}
              </p>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 [&::-webkit-scrollbar]:hidden">
              {accountRole === "client" && (
                <button
                  type="button"
                  onClick={() => navigate("/jobs/create")}
                  className="whitespace-nowrap rounded-full bg-[#0066FF] px-5 py-2 text-[0.8rem] font-bold text-white transition hover:bg-[#0055ee]"
                >
                  Post a Job
                </button>
              )}
              {[
                ["newest", "Newest"],
                ["price_asc", "Price ↑"],
                ["price_desc", "Price ↓"],
                ["popular", "Popular"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => {
                    setLoading(true);
                    setSort(value);
                    setCursorStack([null]);
                    setPageIndex(0);
                  }}
                  className={`whitespace-nowrap px-5 py-2 rounded-full border text-[0.8rem] font-bold transition-all ${
                    sort === value
                      ? "bg-[#0066FF] border-[#0066FF] text-white shadow-[0_0_15px_rgba(0,102,255,0.3)]"
                      : "border-white/5 text-[#555] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {roleError && (
            <p
              role="alert"
              className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200"
            >
              Account role unavailable; posting actions are hidden. {roleError}
            </p>
          )}

          {/* Search Bar */}
          <div className="search-area relative mb-10">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[#555]">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCursorStack([null]);
                setPageIndex(0);
              }}
              placeholder="Search jobs by title, skills, or description..."
              className="w-full bg-[#121216] border border-white/5 rounded-2xl py-4 pl-14 pr-14 text-white text-[1rem] placeholder-[#444] outline-none focus:border-[#0066FF]/30 transition-all"
            />
          </div>

          {/* Job Grid */}
          {error ? (
            <div className="py-16 text-center" role="alert">
              <p className="text-red-400 font-bold">{error}</p>
              <button
                onClick={() => {
                  setLoading(true);
                  setRefreshNonce((value) => value + 1);
                }}
                className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="py-16 text-center text-[#777]" role="status">
              Loading jobs…
            </div>
          ) : jobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
              {jobs.map((job) => (
                <div key={job.id} className="job-card">
                  <JobCard
                    job={job}
                    isFreelancer={accountRole === "freelancer"}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    onApply={() => navigate(`/jobs/${job.id}`)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-bold">No jobs found</h3>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}

          {(pageIndex > 0 || nextCursor) && !loading && !error && (
            <div className="flex items-center justify-center gap-2 pb-10">
              <button
                disabled={pageIndex === 0 || loading}
                onClick={() => {
                  setLoading(true);
                  setPageIndex((index) => Math.max(0, index - 1));
                }}
                className="px-4 py-2 bg-[#121216] border border-white/5 rounded-lg text-xs font-black text-[#555] hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-[#555]"
              >
                Prev
              </button>
              <span className="px-3 text-xs font-bold text-[#777]">
                Page {pageIndex + 1}
              </span>
              <button
                disabled={!nextCursor || loading}
                onClick={() => {
                  setLoading(true);
                  setCursorStack((stack) => [
                    ...stack.slice(0, pageIndex + 1),
                    nextCursor,
                  ]);
                  setPageIndex((index) => index + 1);
                }}
                className="px-4 py-2 bg-[#121216] border border-white/5 rounded-lg text-xs font-black text-[#555] hover:text-white transition-colors disabled:opacity-30 disabled:hover:text-[#555]"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function JobCard({ job, isFreelancer, onClick, onApply }) {
  const budget =
    job.budgetMin === job.budgetMax
      ? formatBudget(job.budgetMin)
      : `${formatBudget(job.budgetMin)} – ${formatBudget(job.budgetMax)}`;
  const budgetUnit = job.budgetType === "hourly" ? " / hour" : "";
  const ownerName = job.owner?.displayName || "Client";
  return (
    <div
      onClick={onClick}
      className="bg-[#121216] border border-white/5 rounded-[24px] p-6 hover:border-white/10 hover:bg-[#15151A] transition-all cursor-pointer group flex flex-col h-full"
    >
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2.5">
          {job.owner?.photoURL ? (
            <img
              src={job.owner.photoURL}
              alt=""
              className="w-8 h-8 rounded-full border border-white/5 object-cover"
            />
          ) : (
            <span
              className="w-8 h-8 rounded-full border border-white/5 bg-white/10 grid place-items-center text-xs font-bold"
              aria-hidden="true"
            >
              {ownerName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="font-bold text-[0.85rem] text-white opacity-90 group-hover:opacity-100 transition-opacity">
            {ownerName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {job.applicationsCount > 0 && (
            <div className="flex items-center gap-1.5 text-[#555]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="text-xs font-bold">{job.applicationsCount}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start justify-between mb-3 gap-4">
        <h3 className="text-[1.05rem] font-bold leading-tight line-clamp-2">
          {job.title}
        </h3>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
            job.jobType === "freelance"
              ? "bg-[#0066FF]/10 text-[#0066FF]"
              : job.jobType === "full-time"
                ? "bg-blue-500/10 text-blue-400"
                : job.jobType === "internship"
                  ? "border border-gold text-gold"
                  : "bg-purple-500/10 text-purple-400"
          }`}
        >
          {job.jobType}
        </span>
      </div>

      <div className="space-y-1 mb-4">
        <div className="text-[0.9rem] font-black text-white/90">
          {budget}
          {budgetUnit}
        </div>

        <div className="flex items-center gap-2 text-[#555]">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="text-[0.7rem] font-bold">
            {formatPostedDate(job.createdAt)}
          </span>
        </div>

        {job.location && (
          <div className="flex items-center gap-2 text-[#555]">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-[0.7rem] font-bold truncate">
              {job.location}
            </span>
          </div>
        )}
        {job.projectDuration && (
          <div className="text-[0.7rem] font-bold text-[#777]">
            Duration: {job.projectDuration}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        {job.skills?.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-[8px] text-[10px] font-bold text-[#666]"
          >
            {tag}
          </span>
        ))}
        {job.skills?.length > 2 && (
          <span className="bg-white/[0.03] border border-white/5 px-2 py-1 rounded-[8px] text-[10px] font-bold text-[#666]">
            +{job.skills.length - 2} more
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          <span className="text-[#444] text-[9px] font-black uppercase">
            {job.location || "Location flexible"}
          </span>
          <div className="flex gap-1.5">
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase">
              {job.status}
            </span>
          </div>
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onApply();
          }}
          className="flex items-center gap-2 bg-[#0066FF]/20 hover:bg-[#0066FF] text-[#0066FF] hover:text-white px-4 py-2 rounded-full font-black text-[11px] transition-all group/btn"
        >
          {isFreelancer ? "Apply" : "View details"}
          <svg
            className="transition-transform group-hover/btn:translate-x-0.5"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M5 12h14m-7-7 7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function formatBudget(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPostedDate(value) {
  if (!value) return "Posting date unavailable";
  return `Posted ${new Date(value).toLocaleDateString()}`;
}
