"use client";

import { useState, useEffect } from "react";
import Leaderboard from "@/components/Leaderboard";
import LiveMatchFeed from "@/components/LiveMatchFeed";
import ScoreMatrix from "@/components/ScoreMatrix";
import RoundHighlights from "@/components/RoundHighlights";

type View = "leaderboard" | "matrix" | "highlights";

export default function SpectatePage() {
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(0);
  const [seasonStatus, setSeasonStatus] = useState("");
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [roundStatus, setRoundStatus] = useState("idle");
  const [view, setView] = useState<View>("leaderboard");

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/season/current");
        const data = await res.json();
        if (data.season) {
          setSeasonId(data.season.id);
          setSeasonNumber(data.season.number);
          setSeasonStatus(data.season.status);
          setCurrentRound(data.season.current_round);
          setTotalRounds(data.season.total_rounds);

          const newRoundStatus = data.season.round_status || "idle";
          // Auto-switch to highlights when they're ready
          if (
            newRoundStatus === "showing_highlights" &&
            roundStatus !== "showing_highlights"
          ) {
            setView("highlights");
          }
          setRoundStatus(newRoundStatus);
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [roundStatus]);

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-5xl font-bold mb-2">
          Agent <span className="text-[var(--accent)]">Arena</span>
        </h1>
        <div className="flex items-center justify-center gap-4 text-sm text-[var(--muted)]">
          {seasonNumber > 0 && (
            <>
              <span className="text-[var(--accent)] font-medium">
                Season {seasonNumber}
              </span>
              {seasonStatus === "running" && (
                <span>
                  Round {currentRound}/{totalRounds}
                </span>
              )}
              <span className="capitalize">{seasonStatus}</span>
            </>
          )}
          {!seasonNumber && <span>Waiting for game to start...</span>}
        </div>

        {/* Round status indicator */}
        {roundStatus === "running_matches" && (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[var(--accent)]">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--accent)] border-t-transparent" />
            Matches in progress...
          </div>
        )}
        {roundStatus === "generating_highlights" && (
          <div className="mt-3 flex items-center justify-center gap-2 text-sm text-[var(--accent-light)]">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--accent-light)] border-t-transparent" />
            AI picking the best moments...
          </div>
        )}
      </div>

      {/* View switcher */}
      <div className="flex justify-center gap-1 mb-6">
        {(["leaderboard", "matrix", "highlights"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
              view === v
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--card)] text-[var(--muted)] hover:text-white"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Content */}
      {view === "leaderboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-bold mb-3 text-[var(--muted)]">
              LEADERBOARD
            </h2>
            <Leaderboard seasonId={seasonId} />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-3 text-[var(--muted)]">
              MATCHES
            </h2>
            <LiveMatchFeed seasonId={seasonId} />
          </div>
        </div>
      )}

      {view === "matrix" && (
        <div>
          <h2 className="text-lg font-bold mb-3 text-[var(--muted)]">
            HEAD-TO-HEAD RESULTS
          </h2>
          <ScoreMatrix seasonId={seasonId} />
        </div>
      )}

      {view === "highlights" && seasonId && (
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-bold mb-4 text-[var(--muted)]">
            ROUND {currentRound} HIGHLIGHTS
          </h2>
          <RoundHighlights
            seasonId={seasonId}
            round={currentRound}
          />
        </div>
      )}
    </div>
  );
}
