import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, Check, Trophy } from "lucide-react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Sidebar from "../components/Sidebar";
import { apiRequest } from "../lib/api";

const BattleDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [battle, setBattle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userVote, setUserVote] = useState(null);
  const [votingLoading, setVotingLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  const fetchBattle = useCallback(async (signal) => {
    try {
      const payload = await apiRequest(`/battles/${encodeURIComponent(id)}`, {
        signal,
      });
      if (!payload.data) throw new Error("The server returned no battle");
      setBattle(payload.data);
      setUserVote(payload.data.userVote || null);
      setError(null);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message);
        console.error("Fetch error:", err);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    void fetchBattle(controller.signal);
    const interval = setInterval(() => void fetchBattle(controller.signal), 3000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [fetchBattle, currentUser]);

  const handleVote = async (side) => {
    if (!currentUser) {
      navigate("/login");
      return;
    }

    if (userVote) {
      alert("You have already voted on this battle!");
      return;
    }

    setVotingLoading(true);
    try {
      const payload = await apiRequest(
        `/battles/${encodeURIComponent(id)}/vote`,
        { method: "POST", body: JSON.stringify({ optionId: side }) },
        true,
      );
      if (!payload.data) throw new Error("The server returned no vote result");
      setBattle(payload.data);
      setUserVote(payload.data.userVote || side);
    } catch (err) {
      alert(err.message);
    } finally {
      setVotingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#09090B] text-white overflow-hidden">
        <div
          className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? "w-[78px]" : "w-[240px]"}`}
        >
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>
        <main className="flex-1 min-w-0 flex items-center justify-center">
          <div className="text-white">Loading battle...</div>
        </main>
      </div>
    );
  }

  if (error || !battle) {
    return (
      <div className="flex min-h-screen bg-[#09090B] text-white overflow-hidden">
        <div
          className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? "w-[78px]" : "w-[240px]"}`}
        >
          <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
        </div>
        <main className="flex-1 min-w-0 p-6 lg:p-10 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => navigate("/battles")}
              className="flex items-center gap-2 text-blue-500 hover:text-blue-400 mb-6"
            >
              <ArrowLeft size={20} />
              Back to Battles
            </button>
            <div className="text-center py-16">
              <p className="text-red-400 text-lg">
                {error || "Battle not found"}
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const { entry_A, entry_B, votes_A, votes_B, status, category } = battle;
  const totalVotes = votes_A + votes_B || 1;
  const percentageA = Math.round((votes_A / totalVotes) * 100);
  const percentageB = Math.round((votes_B / totalVotes) * 100);
  const isLive = status === "live";
  const winnerA = votes_A > votes_B;
  const isTie = votes_A === votes_B && votes_A > 0;

  return (
    <div className="flex min-h-screen bg-[#09090B] text-white overflow-hidden">
      <div
        className={`hidden lg:block shrink-0 transition-all duration-400 ${collapsed ? "w-[78px]" : "w-[240px]"}`}
      >
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      </div>

      <main className="flex-1 min-w-0 p-6 lg:p-10 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <button
            onClick={() => navigate("/battles")}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-400 mb-6 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Battles
          </button>

          {/* Title and Status */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              {isLive ? (
                <div className="flex items-center gap-2 bg-blue-500 px-4 py-2 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="font-semibold">Live</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-gray-500 px-4 py-2 rounded-full">
                  <Check size={16} />
                  <span className="font-semibold">Ended</span>
                </div>
              )}
              <span className="bg-slate-800 px-4 py-2 rounded-full text-sm font-semibold">
                {category}
              </span>
            </div>
            <h1 className="text-5xl font-black mb-2">{battle.title}</h1>
            <p className="text-slate-400">
              {totalVotes} votes • Created{" "}
              {new Date(battle.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Entry A */}
            <div
              className={`rounded-lg overflow-hidden border-2 transition-all ${
                userVote === "A"
                  ? "border-blue-500 ring-4 ring-blue-500/50"
                  : "border-slate-700"
              }`}
            >
              <div className="relative">
                <img
                  src={entry_A.image}
                  alt={entry_A.title}
                  className="w-full h-80 object-cover"
                />
                {status === "ended" && winnerA && !isTie && (
                  <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/40 to-transparent"></div>
                )}
              </div>

              <div className="p-6 bg-slate-800">
                <h3 className="text-2xl font-bold mb-2">{entry_A.title}</h3>
                <p className="text-slate-400 mb-4">{entry_A.description}</p>

                {/* Author Info */}
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-700">
                  {entry_A.authorAvatar ? (
                    <img
                      src={entry_A.authorAvatar}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold">
                      {(entry_A.author || "A").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-white font-semibold">
                      by {entry_A.author || "Anonymous"}
                    </p>
                  </div>
                </div>

                {/* Vote Stats */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-bold">{percentageA}%</span>
                    <span className="text-slate-400">{votes_A} votes</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        status === "ended" && winnerA && !isTie
                          ? "bg-yellow-400"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${percentageA}%` }}
                    ></div>
                  </div>
                </div>

                {/* Vote Button or Voted Indicator */}
                {userVote === "A" ? (
                  <button
                    disabled
                    className="w-full bg-blue-600 py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    You Voted
                  </button>
                ) : (
                  <button
                    onClick={() => handleVote("A")}
                    disabled={votingLoading || !isLive || userVote !== null}
                    className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                      !isLive || userVote !== null
                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    <Zap size={20} />
                    {votingLoading ? "Voting..." : "Vote"}
                  </button>
                )}

                {/* Winner Badge */}
                {status === "ended" && winnerA && !isTie && (
                  <div className="mt-4 flex items-center justify-center gap-2 bg-yellow-500/20 border border-yellow-500 rounded-lg py-3">
                    <Trophy size={20} className="text-yellow-400" />
                    <span className="font-bold text-yellow-400">Winner</span>
                  </div>
                )}

                {status === "ended" && isTie && (
                  <div className="mt-4 flex items-center justify-center gap-2 bg-purple-500/20 border border-purple-500 rounded-lg py-3">
                    <span className="font-bold text-purple-400">
                      It's a Draw
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Entry B */}
            <div
              className={`rounded-lg overflow-hidden border-2 transition-all ${
                userVote === "B"
                  ? "border-purple-500 ring-4 ring-purple-500/50"
                  : "border-slate-700"
              }`}
            >
              <div className="relative">
                <img
                  src={entry_B.image}
                  alt={entry_B.title}
                  className="w-full h-80 object-cover"
                />
                {status === "ended" && !winnerA && votes_B > 0 && !isTie && (
                  <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/40 to-transparent"></div>
                )}
              </div>

              <div className="p-6 bg-slate-800">
                <h3 className="text-2xl font-bold mb-2">{entry_B.title}</h3>
                <p className="text-slate-400 mb-4">{entry_B.description}</p>

                {/* Author Info */}
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-700">
                  {entry_B.authorAvatar ? (
                    <img
                      src={entry_B.authorAvatar}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-600 font-bold">
                      {(entry_B.author || "B").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-white font-semibold">
                      by {entry_B.author || "Anonymous"}
                    </p>
                  </div>
                </div>

                {/* Vote Stats */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-400 text-sm">
                      {votes_B} votes
                    </span>
                    <span className="text-lg font-bold">{percentageB}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full transition-all ml-auto ${
                        status === "ended" && !winnerA && votes_B > 0 && !isTie
                          ? "bg-yellow-400"
                          : "bg-purple-500"
                      }`}
                      style={{ width: `${percentageB}%` }}
                    ></div>
                  </div>
                </div>

                {/* Vote Button or Voted Indicator */}
                {userVote === "B" ? (
                  <button
                    disabled
                    className="w-full bg-purple-600 py-3 rounded-lg font-bold text-white flex items-center justify-center gap-2"
                  >
                    <Check size={20} />
                    You Voted
                  </button>
                ) : (
                  <button
                    onClick={() => handleVote("B")}
                    disabled={votingLoading || !isLive || userVote !== null}
                    className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                      !isLive || userVote !== null
                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-purple-600 text-white hover:bg-purple-700"
                    }`}
                  >
                    <Zap size={20} />
                    {votingLoading ? "Voting..." : "Vote"}
                  </button>
                )}

                {/* Winner Badge */}
                {status === "ended" && !winnerA && votes_B > 0 && !isTie && (
                  <div className="mt-4 flex items-center justify-center gap-2 bg-yellow-500/20 border border-yellow-500 rounded-lg py-3">
                    <Trophy size={20} className="text-yellow-400" />
                    <span className="font-bold text-yellow-400">Winner</span>
                  </div>
                )}

                {status === "ended" && isTie && (
                  <div className="mt-4 flex items-center justify-center gap-2 bg-purple-500/20 border border-purple-500 rounded-lg py-3">
                    <span className="font-bold text-purple-400">
                      It's a Draw
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400 text-sm mb-2">Total Votes</p>
              <p className="text-4xl font-black text-white">{totalVotes}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400 text-sm mb-2">State</p>
              <p className="text-4xl font-black text-white capitalize">
                {status}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <p className="text-slate-400 text-sm mb-2">Ends At</p>
              <p className="text-lg font-bold text-white">
                {new Date(battle.endTime).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BattleDetail;
