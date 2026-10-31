import React, { useState, useEffect, useCallback } from "react";
import { Zap, Check } from "lucide-react";
import BattleCard from "./BattleCard";
import Sidebar from "./Sidebar";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../lib/api";

const BattlesFeed = () => {
  const [battles, setBattles] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const categories = ["UI/UX", "Branding", "Web Dev", "Mobile", "Design"];

  const fetchBattles = useCallback(async ({ cursor, append = false, signal } = {}) => {
    try {
      if (append) setLoadingMore(true);
      else setLoading(true);
      const params = new URLSearchParams({ filter, limit: "20" });
      if (selectedCategory) {
        params.set("category", selectedCategory);
      }
      if (cursor) params.set("cursor", cursor);
      const payload = await apiRequest(`/battles?${params.toString()}`, {
        signal,
      });
      if (!Array.isArray(payload.data)) {
        throw new Error("The server returned an invalid battles response");
      }
      setBattles((current) =>
        append ? [...current, ...payload.data] : payload.data,
      );
      setNextCursor(payload.meta?.nextCursor || null);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, selectedCategory]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchBattles({ signal: controller.signal });
    const interval = setInterval(
      () => void fetchBattles({ signal: controller.signal }),
      10000,
    );
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [fetchBattles]);

  const handleBattleClick = (battleId) => {
    navigate(`/battles/${battleId}`);
  };

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
          <div className="flex items-center gap-3 mb-8">
            <Zap size={28} className="text-purple-500" />
            <h1 className="text-4xl font-black">Skill Battles</h1>
          </div>
          <p className="text-slate-400 mb-8">
            Watch creators battle it out. Vote for your favorite.
          </p>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-3 mb-8">
            <button
              onClick={() => setFilter("all")}
              className={`px-6 py-2 rounded-full font-semibold transition-all ${
                filter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("live")}
              className={`px-6 py-2 rounded-full font-semibold transition-all flex items-center gap-2 ${
                filter === "live"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Zap size={16} />
              Live
            </button>
            <button
              onClick={() => setFilter("ended")}
              className={`px-6 py-2 rounded-full font-semibold transition-all flex items-center gap-2 ${
                filter === "ended"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <Check size={16} />
              Ended
            </button>
          </div>

          {/* Category Filter */}
          <div className="mb-8">
            <p className="text-slate-400 text-sm mb-3">Filter by category:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory("")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedCategory === ""
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedCategory === cat
                      ? "bg-purple-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 mb-8">
              <p className="text-red-200">{error}</p>
              <button
                onClick={() => void fetchBattles()}
                className="mt-3 rounded bg-white/10 px-3 py-2 text-sm font-bold text-white"
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "24px",
              }}
            >
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-800 rounded-lg h-96 animate-pulse"
                ></div>
              ))}
            </div>
          ) : battles.length === 0 ? (
            <div className="text-center py-16">
              <Zap size={48} className="mx-auto text-slate-600 mb-4" />
              <p className="text-slate-400 text-lg">No battles found</p>
              <p className="text-slate-500 text-sm mt-2">
                Be the first to create a battle!
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "24px",
              }}
            >
              {battles.map((battle) => (
                <BattleCard
                  key={battle.id}
                  battle={battle}
                  onClick={() => handleBattleClick(battle.id)}
                />
              ))}
            </div>
          )}
          {!loading && nextCursor && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() =>
                  fetchBattles({ cursor: nextCursor, append: true })
                }
                disabled={loadingMore}
                className="rounded-lg bg-slate-800 px-6 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load more battles"}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default BattlesFeed;
