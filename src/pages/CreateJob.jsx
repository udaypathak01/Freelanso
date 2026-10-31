import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { auth } from "../lib/auth";
import { createJob, fetchCurrentProfile, updateJob } from "../lib/data";
import { fetchJob } from "../lib/jobData";
import { fetchServiceCategories } from "../lib/serviceData";

const initialForm = {
  title: "",
  description: "",
  category: "",
  skills: "",
  budgetType: "fixed",
  budgetMin: "",
  budgetMax: "",
  experienceLevel: "entry",
  projectDuration: "",
  deadlineDate: "",
  workMode: "remote",
  location: "",
  jobType: "freelance",
  additionalDetails: "",
};

const durationOptions = [
  "Less than 1 week",
  "1-2 weeks",
  "2-4 weeks",
  "1-3 months",
  "3+ months",
  "Ongoing",
];

export default function CreateJob() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const [collapsed, setCollapsed] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [canPost, setCanPost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoadingProfile(true);
    setLoadingCategories(true);
    setCanPost(false);
    setError("");
    Promise.all([
      fetchCurrentProfile(),
      fetchServiceCategories(),
      id ? fetchJob(id) : Promise.resolve(null),
    ])
      .then(([profile, nextCategories, existingJob]) => {
        if (!active) return;
        const isOwner =
          existingJob && existingJob.postedBy === auth.getUser()?.uid;
        const allowed =
          profile.role === "admin" ||
          (profile.role === "client" && (!existingJob || isOwner));
        setCanPost(allowed);
        setCategories(
          existingJob &&
            !nextCategories.some(
              (category) => category.slug === existingJob.category,
            )
            ? [
                ...nextCategories,
                {
                  slug: existingJob.category,
                  label: existingJob.category.replaceAll("-", " "),
                },
              ]
            : nextCategories,
        );
        if (!allowed) {
          setError(
            existingJob
              ? "You can only edit a job posted by your account."
              : "Only client accounts can publish a job.",
          );
          return;
        }
        if (existingJob) {
          setForm({
            title: existingJob.title,
            description: existingJob.description,
            category: existingJob.category,
            skills: (existingJob.skills ?? []).join(", "),
            budgetType: existingJob.budgetType ?? "fixed",
            budgetMin: String(existingJob.budgetMin ?? ""),
            budgetMax: String(existingJob.budgetMax ?? ""),
            experienceLevel: existingJob.experienceLevel ?? "",
            projectDuration: existingJob.projectDuration ?? "",
            deadlineDate: existingJob.deadlineDate?.slice(0, 10) ?? "",
            workMode: existingJob.workMode ?? "remote",
            location: existingJob.location ?? "",
            jobType: existingJob.jobType ?? "freelance",
            additionalDetails: existingJob.additionalDetails ?? "",
          });
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.message || "Unable to load the job form.");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingProfile(false);
          setLoadingCategories(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (Number(form.budgetMin) > Number(form.budgetMax)) {
      setError("Maximum budget must be at least the minimum budget.");
      setLoading(false);
      return;
    }
    if (form.workMode !== "remote" && !form.location.trim()) {
      setError("Add a city or region for hybrid and on-site projects.");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        skills: [
          ...new Set(
            form.skills
              .split(",")
              .map((skill) => skill.trim())
              .filter(Boolean),
          ),
        ],
        budgetType: form.budgetType,
        budgetMin: Number(form.budgetMin),
        budgetMax: Number(form.budgetMax),
        jobType: form.jobType,
        experienceLevel: form.experienceLevel,
        workMode: form.workMode,
        ...(form.location.trim() ? { location: form.location.trim() } : {}),
      };
      if (isEditing) {
        payload.location = form.location.trim() || null;
        payload.projectDuration = form.projectDuration.trim() || null;
        payload.deadlineDate = form.deadlineDate || null;
        payload.deadlineDays = null;
        payload.experienceLevel = form.experienceLevel || null;
        payload.additionalDetails = form.additionalDetails.trim() || null;
      } else {
        payload.projectDuration = form.projectDuration;
        if (form.deadlineDate) payload.deadlineDate = form.deadlineDate;
        if (form.additionalDetails.trim()) {
          payload.additionalDetails = form.additionalDetails.trim();
        }
      }
      const job = isEditing
        ? await updateJob(id, payload)
        : await createJob(payload);
      navigate(`/jobs/${encodeURIComponent(job.id)}`);
    } catch (requestError) {
      setError(requestError.message || "Unable to publish this job.");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b0e] px-4 py-3 text-sm text-white outline-none transition focus:border-[#0066FF]/50";
  const today = new Date();
  const minimumDeadline = new Date(
    today.getTime() - today.getTimezoneOffset() * 60_000,
  )
    .toISOString()
    .slice(0, 10);

  return (
    <div className="flex min-h-screen bg-[#09090B] text-white">
      <div
        className={`hidden shrink-0 transition-all lg:block ${collapsed ? "w-[78px]" : "w-[240px]"}`}
      >
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>
      <main className="min-w-0 flex-1 p-5 pb-24 sm:p-8 lg:p-12">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => navigate(isEditing ? `/jobs/${encodeURIComponent(id)}` : "/dashboard")}
            className="mb-6 text-sm font-bold text-[#888] transition hover:text-white"
          >
            ← Dashboard
          </button>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#5b9aff]">
            Client
          </p>
          <h1 className="mt-2 text-3xl font-black">
            {isEditing ? "Edit Your Project" : "Post a New Project"}
          </h1>
          <p className="mt-2 text-sm text-[#888]">
            {isEditing
              ? "Update the project details freelancers see in Browse Jobs."
              : "Describe your project and find the right freelancer."}
          </p>

          {error && (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300"
            >
              {error}
              {!canPost && !loadingProfile && (
                <Link
                  to="/dashboard"
                  className="ml-2 font-bold underline underline-offset-2"
                >
                  Return to dashboard
                </Link>
              )}
            </p>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5 rounded-2xl border border-white/[0.07] bg-[#121216] p-5 sm:p-8"
          >
            <section className="space-y-5">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Project Information
              </h2>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                Project title
                <input
                  name="title"
                  value={form.title}
                  onChange={update}
                  required
                  minLength={4}
                  maxLength={120}
                  className={fieldClass}
                  placeholder="E-commerce website development"
                />
              </label>

              <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={update}
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={5}
                  className={`${fieldClass} resize-y`}
                  placeholder="Describe the work and expected deliverables."
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                  Select category
                  <select
                    name="category"
                    value={form.category}
                    onChange={update}
                    required
                    disabled={loadingCategories || categories.length === 0}
                    className={fieldClass}
                  >
                    <option value="" disabled>
                      {loadingCategories ? "Loading categories…" : "Select a category"}
                    </option>
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                  Required skills (comma separated)
                  <input
                    name="skills"
                    value={form.skills}
                    onChange={update}
                    maxLength={1200}
                    className={fieldClass}
                    placeholder="React, Node.js, UI/UX"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-5 border-t border-white/[0.07] pt-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Budget Details
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["fixed", "Fixed Price"],
                  ["hourly", "Hourly"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={form.budgetType === value}
                    onClick={() =>
                      setForm((current) => ({ ...current, budgetType: value }))
                    }
                    className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${
                      form.budgetType === value
                        ? "border-[#0066FF] bg-[#0066FF]/10 text-white"
                        : "border-white/10 text-[#888] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                  Minimum budget {form.budgetType === "hourly" ? "(₹ per hour)" : "(₹)"}
                  <input
                    name="budgetMin"
                    type="number"
                    min="0"
                    max="100000000"
                    step="0.01"
                    value={form.budgetMin}
                    onChange={update}
                    required
                    className={fieldClass}
                    placeholder="5000"
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                  Maximum budget {form.budgetType === "hourly" ? "(₹ per hour)" : "(₹)"}
                  <input
                    name="budgetMax"
                    type="number"
                    min="0"
                    max="100000000"
                    step="0.01"
                    value={form.budgetMax}
                    onChange={update}
                    required
                    className={fieldClass}
                    placeholder="10000"
                  />
                </label>
              </div>
            </section>

            <section className="space-y-5 border-t border-white/[0.07] pt-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Project Requirements
              </h2>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                  Experience level
                  <select
                    name="experienceLevel"
                    value={form.experienceLevel}
                    onChange={update}
                    className={fieldClass}
                  >
                    <option value="entry">Entry level</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="expert">Expert</option>
                    {isEditing && (
                      <option value="">All levels</option>
                    )}
                  </select>
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                  Project duration
                  <select
                    name="projectDuration"
                    value={form.projectDuration}
                    onChange={update}
                    required={!isEditing}
                    className={fieldClass}
                  >
                    <option value="" disabled>
                      Select a duration
                    </option>
                    {durationOptions.map((duration) => (
                      <option key={duration} value={duration}>
                        {duration}
                      </option>
                    ))}
                    {isEditing &&
                      form.projectDuration &&
                      !durationOptions.includes(form.projectDuration) && (
                        <option value={form.projectDuration}>
                          {form.projectDuration}
                        </option>
                      )}
                  </select>
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                  Project deadline (optional)
                  <input
                    name="deadlineDate"
                    type="date"
                    min={isEditing ? undefined : minimumDeadline}
                    value={form.deadlineDate}
                    onChange={update}
                    className={fieldClass}
                  />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                  Work mode
                  <select
                    name="workMode"
                    value={form.workMode}
                    onChange={update}
                    className={fieldClass}
                  >
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-site</option>
                  </select>
                </label>
                {form.workMode !== "remote" && (
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#999] sm:col-span-2">
                    City or region
                    <input
                      name="location"
                      value={form.location}
                      onChange={update}
                      required
                      maxLength={120}
                      className={fieldClass}
                      placeholder="Pune, Maharashtra"
                    />
                  </label>
                )}
                <label className="block text-xs font-bold uppercase tracking-wider text-[#999] sm:col-span-2">
                  Engagement type
                  <select
                    name="jobType"
                    value={form.jobType}
                    onChange={update}
                    className={fieldClass}
                  >
                    <option value="freelance">Freelance</option>
                    <option value="part-time">Part-time</option>
                    <option value="full-time">Full-time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="space-y-3 border-t border-white/[0.07] pt-6">
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Additional Details
              </h2>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#999]">
                Anything else freelancers should know? (optional)
                <textarea
                  name="additionalDetails"
                  value={form.additionalDetails}
                  onChange={update}
                  maxLength={2000}
                  rows={4}
                  className={`${fieldClass} resize-y`}
                  placeholder="Share preferred communication, milestones, or other requirements."
                />
              </label>
            </section>

            <button
              type="submit"
              disabled={
                loading ||
                loadingProfile ||
                loadingCategories ||
                !canPost ||
                categories.length === 0
              }
              className="w-full rounded-xl bg-[#0066FF] px-5 py-3.5 text-sm font-black uppercase tracking-wider transition hover:bg-[#0055ee] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? isEditing
                  ? "Saving…"
                  : "Publishing…"
                : isEditing
                  ? "Save Changes"
                  : "Publish Project"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
