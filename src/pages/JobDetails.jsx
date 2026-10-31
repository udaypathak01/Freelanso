import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { gsap } from "gsap";
import Sidebar from "../components/Sidebar";
import { applyToJob, fetchJob } from "../lib/jobData";
import { auth } from "../lib/auth";
import {
  createConversation,
  fetchJobApplications,
  updateApplicationStatus,
} from "../lib/data";

export default function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showApplication, setShowApplication] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [applicationSent, setApplicationSent] = useState(false);
  const [applications, setApplications] = useState([]);
  const [applicationsError, setApplicationsError] = useState("");
  const [updatingApplication, setUpdatingApplication] = useState("");
  const containerRef = useRef(null);
  const [user, setUser] = useState(() => auth.getUser());

  useEffect(() => {
    const syncUser = () => setUser(auth.getUser());
    window.addEventListener("auth-change", syncUser);
    window.addEventListener("storage", syncUser);
    return () => {
      window.removeEventListener("auth-change", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setShowApplication(false);
    setCoverLetter("");
    setApplicationError("");
    setApplicationSent(false);
    setApplications([]);
    setApplicationsError("");
    fetchJob(id, { signal: controller.signal })
      .then((result) => {
        if (active) {
          setJob(result);
          setProposedRate(String(result.budgetMin ?? ""));
        }
      })
      .catch((requestError) => {
        if (active && !controller.signal.aborted)
          setError(requestError.message || "Unable to load this job.");
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!job || job.postedBy !== user?.uid) {
      return undefined;
    }
    let active = true;
    fetchJobApplications(job.id, { limit: 50 })
      .then(({ items }) => {
        if (active) setApplications(items);
      })
      .catch((requestError) => {
        if (active) {
          setApplicationsError(
            requestError.message || "Unable to load applications.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [job, user?.uid]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".back-link", { x: -20, opacity: 0, duration: 0.6 });
      gsap.from(".job-title", {
        y: 20,
        opacity: 0,
        duration: 0.8,
        delay: 0.1,
        ease: "power4.out",
      });
      gsap.from(".content-left", {
        x: -30,
        opacity: 0,
        duration: 0.8,
        delay: 0.3,
        ease: "power4.out",
      });
      gsap.from(".content-right > div", {
        x: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        delay: 0.5,
        ease: "power3.out",
      });
    }, containerRef);
    return () => ctx.revert();
  }, [loading, error, job]);

  async function handleApply(event) {
    event.preventDefault();
    if (!auth.getUser()?.uid) {
      navigate("/login", { state: { from: location } });
      return;
    }
    setSubmitting(true);
    setApplicationError("");
    try {
      await applyToJob(id, {
        coverLetter,
        proposedRate: Number(proposedRate),
      });
      setApplicationSent(true);
      setJob((current) => ({
        ...current,
        applicationsCount: current.applicationsCount + 1,
      }));
    } catch (requestError) {
      setApplicationError(
        requestError.message || "Unable to submit your application.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplicationStatus(applicationId, status) {
    setUpdatingApplication(applicationId);
    setApplicationsError("");
    try {
      const updated = await updateApplicationStatus(applicationId, status);
      setApplications((current) =>
        current.map((application) =>
          application.id === applicationId
            ? { ...application, status: updated.status }
            : application,
        ),
      );
    } catch (requestError) {
      setApplicationsError(
        requestError.message || "Unable to update this application.",
      );
    } finally {
      setUpdatingApplication("");
    }
  }

  async function handleContactApplicant(applicantId) {
    setApplicationsError("");
    try {
      const conversation = await createConversation(applicantId, job.id);
      navigate(`/messages/${encodeURIComponent(conversation.id)}`);
    } catch (requestError) {
      setApplicationsError(requestError.message || "Unable to contact applicant.");
    }
  }

  const mainContent = loading ? (
    <div className="py-20 text-center text-[#777]" role="status">
      Loading job…
    </div>
  ) : error ? (
    <div className="py-20 text-center" role="alert">
      <p className="text-red-400 font-bold">{error}</p>
      <button
        onClick={() => navigate("/jobs")}
        className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold"
      >
        Back to jobs
      </button>
    </div>
  ) : job ? (
    <div className="flex flex-col lg:flex-row gap-10">
      <div className="flex-1 min-w-0 content-left">
        <h1 className="job-title text-[2.2rem] lg:text-[2.8rem] font-black leading-tight mb-10 tracking-tight">
          {job.title}
        </h1>

        <div className="bg-[#121216] border border-white/5 rounded-[24px] p-6 mb-10 flex items-center gap-4">
          {job.owner?.photoURL ? (
            <img
              src={job.owner.photoURL}
              alt=""
              className="w-14 h-14 rounded-full border border-white/5 object-cover"
            />
          ) : (
            <span
              className="w-14 h-14 rounded-full border border-white/5 bg-white/10 grid place-items-center text-xl font-bold"
              aria-hidden="true"
            >
              {(job.owner?.displayName || "C").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <span className="text-[1.3rem] font-black">
              {job.owner?.displayName || "Client"}
            </span>
            <p className="mt-1 text-xs uppercase text-[#777]">
              {job.jobType} · {job.status}
            </p>
          </div>
        </div>

        <div className="bg-[#121216] border border-white/5 rounded-[32px] p-8 lg:p-10">
          <h2 className="text-[1.6rem] font-black mb-6">Job Description</h2>
          <p className="whitespace-pre-wrap text-[#888] text-[1.05rem] leading-relaxed font-medium">
            {job.description}
          </p>
          {job.skills?.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-[#666]">
                Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold text-[#aaa]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        {job.additionalDetails && (
          <div className="rounded-[32px] border border-white/5 bg-[#121216] p-8 lg:p-10">
            <h2 className="mb-4 text-xl font-black">Additional Details</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#888]">
              {job.additionalDetails}
            </p>
          </div>
        )}
      </div>

      <div className="content-right w-full lg:w-[360px] flex flex-col gap-6">
        <div className="bg-[#121216] border border-white/5 rounded-[24px] p-8">
          <div className="flex items-center gap-2 text-[#0066FF] mb-6">
            <span className="text-[0.75rem] font-black uppercase tracking-[0.1em]">
              Budget
            </span>
          </div>
          <div className="text-[2rem] font-black text-[#0066FF]">
            {formatBudget(job.budgetMin, job.budgetMax)}
          </div>
          {job.budgetType === "hourly" && (
            <p className="mt-1 text-sm font-bold text-[#888]">per hour</p>
          )}
        </div>

        <div className="bg-[#121216] border border-white/5 rounded-[24px] p-8 space-y-5">
          <DetailRow label="Category" value={job.category} />
          <DetailRow
            label="Work mode"
            value={
              job.workMode === "onsite"
                ? "On-site"
                : job.workMode
                  ? job.workMode[0].toUpperCase() + job.workMode.slice(1)
                  : job.location
                    ? "Flexible"
                    : "Remote"
            }
          />
          <DetailRow label="Location" value={job.location || "Flexible"} />
          <DetailRow
            label="Project duration"
            value={job.projectDuration || "To be discussed"}
          />
          <DetailRow
            label="Deadline"
            value={
              job.deadlineDate
                ? new Date(`${job.deadlineDate}T00:00:00`).toLocaleDateString()
                : job.deadlineDays
                  ? `${job.deadlineDays} days`
                  : "To be discussed"
            }
          />
          <DetailRow
            label="Experience"
            value={job.experienceLevel || "All levels"}
          />
          <DetailRow
            label="Applications"
            value={String(job.applicationsCount)}
          />
          <DetailRow
            label="Posted"
            value={
              job.createdAt
                ? new Date(job.createdAt).toLocaleDateString()
                : "Unavailable"
            }
          />
        </div>

        {job.postedBy === user?.uid && (
          <section className="rounded-[24px] border border-white/5 bg-[#121216] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-wider">
                Applications ({applications.length})
              </h2>
              <button
                type="button"
                onClick={() =>
                  navigate(`/jobs/${encodeURIComponent(job.id)}/edit`)
                }
                className="rounded-lg border border-[#0066FF]/30 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#8bb6ff] transition hover:bg-[#0066FF]/10"
              >
                Edit post
              </button>
            </div>
            {applicationsError && (
              <p role="alert" className="mb-3 text-xs text-red-300">{applicationsError}</p>
            )}
            {applications.length === 0 ? (
              <p className="text-sm text-[#777]">No applications received yet.</p>
            ) : (
              <div className="space-y-4">
                {applications.map((application) => (
                  <article key={application.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{application.applicant?.displayName || "Freelancer"}</p>
                        <p className="mt-1 text-xs text-[#8bb6ff]">Proposed ₹{Number(application.proposedRate || 0).toLocaleString("en-IN")} · {application.status}</p>
                      </div>
                      {application.applicant?.id && (
                        <button onClick={() => handleContactApplicant(application.applicant.id)} className="text-xs font-bold text-[#8bb6ff]">Message</button>
                      )}
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-[#999]">{application.coverLetter}</p>
                    {application.status === "submitted" && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          ["shortlisted", "Shortlist"],
                          ["rejected", "Reject"],
                          ["hired", "Hire"],
                        ].map(([status, label]) => (
                          <button key={status} disabled={Boolean(updatingApplication)} onClick={() => handleApplicationStatus(application.id, status)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#aaa] transition hover:border-[#0066FF]/40 hover:text-white disabled:opacity-50">
                            {updatingApplication === application.id ? "Updating…" : label}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="space-y-4">
          {job.postedBy === user?.uid ? (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#121216] p-5 text-center">
              <p className="text-sm font-bold text-[#888]">
                This is your project post.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate(`/jobs/${encodeURIComponent(job.id)}/edit`)
                }
                className="w-full rounded-xl bg-[#0066FF] py-3 text-xs font-black uppercase tracking-wider transition hover:bg-[#0055ee]"
              >
                Edit post
              </button>
            </div>
          ) : job.status === "open" && !applicationSent && !user?.uid ? (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-[#121216] p-5 text-center">
              <p className="text-sm font-bold text-[#aaa]">
                Log in or create an account to apply for this job.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate("/login", { state: { from: location } })
                }
                className="w-full rounded-xl bg-[#0066FF] py-3 text-xs font-black uppercase tracking-wider transition hover:bg-[#0055ee]"
              >
                Log in to apply
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate("/signup", { state: { from: location } })
                }
                className="w-full rounded-xl border border-white/10 py-3 text-xs font-black uppercase tracking-wider text-[#aaa] transition hover:border-[#0066FF]/40 hover:text-white"
              >
                Create an account
              </button>
            </div>
          ) : job.status === "open" && !applicationSent ? (
            <>
              {!showApplication ? (
                <button
                  onClick={() => setShowApplication(true)}
                  className="w-full bg-[#0066FF] text-white font-black uppercase tracking-wider py-4 rounded-2xl text-[0.95rem] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,102,255,0.2)]"
                >
                  Apply for this Job
                </button>
              ) : (
                <form
                  onSubmit={handleApply}
                  className="space-y-4 rounded-2xl border border-white/10 bg-[#121216] p-5"
                >
                  <label className="block text-xs font-bold text-[#aaa]">
                    Cover letter
                    <textarea
                      required
                      minLength={10}
                      maxLength={2000}
                      value={coverLetter}
                      onChange={(event) => setCoverLetter(event.target.value)}
                      className="mt-2 min-h-32 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-[#0066FF]"
                    />
                  </label>
                  <label className="block text-xs font-bold text-[#aaa]">
                    Proposed rate
                    <input
                      required
                      type="number"
                      min="0"
                      max="100000000"
                      step="0.01"
                      value={proposedRate}
                      onChange={(event) => setProposedRate(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none focus:border-[#0066FF]"
                    />
                  </label>
                  {applicationError && (
                    <p className="text-sm text-red-400" role="alert">
                      {applicationError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-[#0066FF] py-3 text-sm font-black uppercase disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit application"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowApplication(false)}
                    className="w-full py-2 text-xs font-bold text-[#777]"
                  >
                    Cancel
                  </button>
                </form>
              )}
            </>
          ) : applicationSent ? (
            <p
              className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-center text-sm font-bold text-green-300"
              role="status"
            >
              Your application was submitted.
            </p>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm font-bold text-[#888]">
              This job is not accepting applications.
            </p>
          )}
        </div>
      </div>
    </div>
  ) : null;

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
        <div className="max-w-[1100px] mx-auto">
          <button
            onClick={() => navigate("/jobs")}
            className="back-link flex items-center gap-2 text-[#777] hover:text-white transition-colors mb-10 font-bold text-[0.9rem]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M19 12H5m7-7-7 7 7 7" />
            </svg>
            Back to Jobs
          </button>
          {mainContent}
        </div>
      </main>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-bold text-[#666]">{label}</span>
      <span className="text-right text-sm font-bold capitalize">{value}</span>
    </div>
  );
}

function formatBudget(minimum, maximum) {
  const format = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value || 0);
  return minimum === maximum
    ? format(minimum)
    : `${format(minimum)} – ${format(maximum)}`;
}
