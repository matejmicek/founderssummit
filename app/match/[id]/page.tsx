"use client";

import { useState, useEffect, use } from "react";
import MatchTranscript from "@/components/MatchTranscript";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface TurnData {
  turn: number;
  team_a_decision: string;
  team_b_decision: string;
  team_a_score: number;
  team_b_score: number;
  team_a_reasoning: string;
  team_b_reasoning: string;
}

interface MatchData {
  id: string;
  status: string;
  round: number;
  team_a_score: number | null;
  team_b_score: number | null;
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
  const [turns, setTurns] = useState<TurnData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await fetch(`/api/matches/${id}`);
        const data = await res.json();
        setMatch(data.match);
        setTurns(data.turns || []);
      } catch {}
      setLoading(false);
    };

    fetchMatch();
    const interval = setInterval(fetchMatch, 2000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[var(--muted)] font-mono text-sm">Loading match...</div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--muted)] font-mono">Match not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <Link
        href="/admin"
        className="text-xs text-[var(--muted)] hover:text-[var(--accent)] mb-4 inline-flex items-center gap-1 font-mono transition-colors"
      >
        <ArrowLeft size={12} />
        Back
      </Link>

      <div className="card p-5">
        <MatchTranscript
          matchId={match.id}
          teamA={match.team_a}
          teamB={match.team_b}
          teamAScore={match.team_a_score}
          teamBScore={match.team_b_score}
          status={match.status}
          turns={turns}
        />

        {match.status === "completed" && turns.length > 0 && (
          <div className="mt-5 pt-5 border-t border-[var(--border)] space-y-3 text-xs">
            {turns.map((t) => (
              <div key={t.turn} className="space-y-1">
                <div className="font-bold text-[var(--muted)] font-mono uppercase text-[10px] tracking-widest">
                  Turn {t.turn}
                </div>
                <div>
                  <span className="font-semibold" style={{ color: match.team_a.color }}>{match.team_a.name}:</span>{" "}
                  <span className="text-[var(--foreground-secondary)]">{t.team_a_reasoning}</span>
                </div>
                <div>
                  <span className="font-semibold" style={{ color: match.team_b.color }}>{match.team_b.name}:</span>{" "}
                  <span className="text-[var(--foreground-secondary)]">{t.team_b_reasoning}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
