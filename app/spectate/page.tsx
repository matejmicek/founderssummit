"use client";

import { useState, useEffect } from "react";
import Leaderboard from "@/components/Leaderboard";
import LiveMatchFeed from "@/components/LiveMatchFeed";

export default function SpectatePage() {
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(0);
  const [seasonStatus, setSeasonStatus] = useState("");
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);

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
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
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
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div>
          <h2 className="text-lg font-bold mb-3 text-[var(--muted)]">
            LEADERBOARD
          </h2>
          <Leaderboard seasonId={seasonId} />
        </div>

        {/* Live matches */}
        <div>
          <h2 className="text-lg font-bold mb-3 text-[var(--muted)]">
            MATCHES
          </h2>
          <LiveMatchFeed seasonId={seasonId} />
        </div>
      </div>
    </div>
  );
}
