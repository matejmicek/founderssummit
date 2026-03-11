"use client";

import { useState, useEffect, use } from "react";
import MatchTranscript from "@/components/MatchTranscript";
import Link from "next/link";

interface MatchData {
  id: string;
  status: string;
  round: number;
  team_a_decision: string | null;
  team_b_decision: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  team_a_reasoning: string | null;
  team_b_reasoning: string | null;
  team_a: { id: string; name: string; color: string };
  team_b: { id: string; name: string; color: string };
}

export default function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await fetch(`/api/matches/${id}`);
        const data = await res.json();
        setMatch(data.match);
      } catch {
        // Match not found
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
    // Poll while match is active
    const interval = setInterval(() => {
      fetchMatch();
    }, 2000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[var(--muted)]">Loading match...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--muted)]">Match not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <Link
        href="/spectate"
        className="text-xs text-[var(--muted)] hover:text-white mb-4 inline-block"
      >
        &larr; Back
      </Link>

      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4">
        <div className="text-xs text-[var(--muted)] mb-3">
          Round {match.round}
        </div>

        <MatchTranscript
          matchId={match.id}
          teamA={match.team_a}
          teamB={match.team_b}
          teamADecision={match.team_a_decision}
          teamBDecision={match.team_b_decision}
          teamAScore={match.team_a_score}
          teamBScore={match.team_b_score}
          status={match.status}
        />

        {/* Reasoning (shown after match completes) */}
        {match.status === "completed" && (
          <div className="mt-4 pt-4 border-t border-[var(--card-border)] space-y-3 text-xs">
            {match.team_a_reasoning && (
              <div>
                <span className="font-medium" style={{ color: match.team_a.color }}>
                  {match.team_a.name}&apos;s reasoning:
                </span>{" "}
                <span className="text-[var(--muted)]">{match.team_a_reasoning}</span>
              </div>
            )}
            {match.team_b_reasoning && (
              <div>
                <span className="font-medium" style={{ color: match.team_b.color }}>
                  {match.team_b.name}&apos;s reasoning:
                </span>{" "}
                <span className="text-[var(--muted)]">{match.team_b_reasoning}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
