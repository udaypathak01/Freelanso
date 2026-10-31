import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth } from "../lib/auth";
import { fetchProjectDB } from "../lib/data";
import Navbar from "../components/Navbar";
import MatchScoreCard from "../components/MatchScoreCard";
import { apiRequest } from "../lib/api";

export default function ProjectMatchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rescoring, setRescoring] = useState(false);
  const [projectError, setProjectError] = useState("");

  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    fetchProjectDB(id)
      .then((data) => {
        if (active) {
          setProject(data);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setProjectError(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleRescore = async () => {
    setRescoring(true);
    try {
      if (!auth.getUser()) throw new Error("Must be logged in to rescore");
      const payload = await apiRequest(
        "/matches/score-all",
        { method: "POST", body: JSON.stringify({ projectId: id }) },
        true,
      );
      if (!Array.isArray(payload.data)) {
        throw new Error("The server returned an invalid matches response");
      }
      setMatches(payload.data);
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setRescoring(false);
    }
  };

  if (loading && !project && !projectError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] text-white">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-[#0066FF] border-t-transparent" />
        <p className="font-syne font-bold">Loading Insights...</p>
      </div>
    );
  }

  if (projectError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#050505] px-6 text-center text-white">
        <p className="font-bold">{projectError}</p>
        <button
          onClick={() => navigate("/explore")}
          className="text-xs font-black uppercase text-[#0066FF]"
        >
          Back to Explore
        </button>
      </div>
    );
  }

  const isProjectOwner = auth.getUser()?.uid === project?.authorUid;

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#050505]">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-10 px-5 py-12 md:py-20">
        <div className="flex flex-col items-start justify-between gap-6 border-b border-white/5 pb-8 md:flex-row md:items-end">
          <div className="max-w-[600px]">
            <span className="mb-4 inline-flex items-center gap-2 rounded-md bg-[#0066FF]/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-[#0066FF]">
              Project Match Scoring
            </span>
            <h1
              className="mb-2 cursor-pointer font-syne text-3xl font-black leading-[1.1] tracking-tight text-white transition-colors hover:text-[#0066FF] md:text-5xl"
              onClick={() => navigate("/")}
            >
              {project?.title || "Unknown Project"}
            </h1>
            <p className="mb-4 font-medium leading-relaxed text-[#888]">
              {project?.description?.slice(0, 100) || "No description provided."}
              ...
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {(project?.skills || project?.requiredSkills || []).map((skill) => (
                <span
                  key={skill}
                  className="rounded-md border border-white/5 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#A0A0B4]"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
          {isProjectOwner && (
            <button
              onClick={handleRescore}
              disabled={rescoring}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-bold text-white transition-all hover:bg-white/10 disabled:opacity-50"
            >
              {rescoring ? "Scoring Matches..." : "Recalculate Matches"}
            </button>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-syne text-xl font-black text-white">
              Top Candidates
            </h3>
            <span className="text-sm font-bold text-[#666]">
              {matches.length} Matches Found
            </span>
          </div>
          {matches.length ? (
            matches.map((match, index) => (
              <MatchScoreCard
                key={match.freelancerId}
                match={match}
                userProfile={match.freelancer}
                index={index}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/5 bg-[#121216] py-20 text-center">
              <span className="mb-4 block text-4xl">🔍</span>
              <h4 className="mb-2 font-syne text-lg font-black text-white">
                No Matches Yet
              </h4>
              <p className="text-sm font-medium text-[#666]">
                {isProjectOwner
                  ? 'Click "Recalculate Matches" to score freelancer profiles.'
                  : "Match results are not available for this project."}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
