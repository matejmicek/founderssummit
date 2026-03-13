"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Volume2, Pause, ExternalLink } from "lucide-react";

interface TurnData {
  turn: number;
  team_a_decision: string;
  team_b_decision: string;
  team_a_score: number;
  team_b_score: number;
  team_a_reasoning?: string;
  team_b_reasoning?: string;
}

interface Highlight {
  id: string;
  season_id: number;
  round: number;
  match_id: string;
  title: string;
  commentary: string;
  highlight_type: string;
  ranking: number;
  voiceover_script?: string;
  voiceover_audio_base64?: string;
  turns: TurnData[];
  match?: {
    id: string;
    team_a: { id: string; name: string; color: string };
    team_b: { id: string; name: string; color: string };
    team_a_decision: string;
    team_b_decision: string;
    team_a_score: number;
    team_b_score: number;
  };
}

interface Props {
  seasonId: number;
  round?: number;
}

const TYPE_LABELS: Record<string, string> = {
  betrayal: "Betrayal",
  alliance: "Alliance",
  upset: "Upset",
  comedy: "Comedy",
  tragedy: "Tragedy",
  mindgame: "Mind Game",
  drama: "Drama",
};

export default function RoundHighlights({ seasonId, round }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchHighlights = useCallback(async () => {
    try {
      const url = round
        ? `/api/seasons/${seasonId}/highlights?round=${round}`
        : `/api/seasons/${seasonId}/highlights`;
      const res = await fetch(url);
      const data = await res.json();
      setHighlights(data.highlights || []);
    } catch {}
    setLoading(false);
  }, [seasonId, round]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playAudio = (highlightId: string, base64: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingId === highlightId) {
      setPlayingId(null);
      return;
    }

    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audioRef.current = audio;
    setPlayingId(highlightId);
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.play().catch(() => {
      setPlayingId(null);
      audioRef.current = null;
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
        <p className="text-[var(--muted)] text-sm mt-3 font-mono">Loading highlights...</p>
      </div>
    );
  }

  if (highlights.length === 0) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-extrabold tracking-tight text-center">
        Match Highlights
      </h2>

      {highlights.map((h) => {
        const match = h.match;
        const isPlaying = playingId === h.id;
        const hasAudio = !!h.voiceover_audio_base64;
        const turns = h.turns || [];
        const totalA = turns.reduce((s, t) => s + t.team_a_score, 0);
        const totalB = turns.reduce((s, t) => s + t.team_b_score, 0);

        return (
          <div key={h.id} className="card p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="font-extrabold text-lg tracking-tight leading-tight mb-1">
                  {h.title}
                </h4>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-[var(--accent-light)] text-[var(--accent)] uppercase tracking-widest">
                  {TYPE_LABELS[h.highlight_type] || h.highlight_type}
                </span>
              </div>

              {match && (
                <div className="text-right text-sm space-y-0.5">
                  <div className="flex items-center gap-1.5 justify-end">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: match.team_a?.color }} />
                    <span className="font-medium">{match.team_a?.name}</span>
                    <span className="font-extrabold tabular-nums font-mono ml-1">{totalA}</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-end">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: match.team_b?.color }} />
                    <span className="font-medium">{match.team_b?.name}</span>
                    <span className="font-extrabold tabular-nums font-mono ml-1">{totalB}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Turn columns */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3].map((turnNum) => {
                const turn = turns.find((t) => t.turn === turnNum);

                if (!turn) {
                  return (
                    <div key={turnNum} className="rounded bg-[var(--background)] border border-[var(--border)] p-3 text-center">
                      <div className="text-[10px] text-[var(--muted)] uppercase tracking-widest font-mono font-bold mb-2">
                        Turn {turnNum}
                      </div>
                      <div className="text-xs text-[var(--muted)]">&mdash;</div>
                    </div>
                  );
                }

                const aColor = turn.team_a_decision === "cooperate" ? "var(--cooperate)" : "var(--betray)";
                const bColor = turn.team_b_decision === "cooperate" ? "var(--cooperate)" : "var(--betray)";

                return (
                  <div key={turnNum} className="rounded bg-[var(--background)] border border-[var(--border)] p-3 text-center">
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-widest font-mono font-bold mb-2">
                      Turn {turnNum}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm font-bold font-mono">
                      <span style={{ color: aColor }}>
                        {turn.team_a_decision === "cooperate" ? "C" : "B"}
                      </span>
                      <span className="text-[var(--muted)] text-xs">vs</span>
                      <span style={{ color: bColor }}>
                        {turn.team_b_decision === "cooperate" ? "C" : "B"}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)] tabular-nums font-mono mt-1">
                      +{turn.team_a_score} / +{turn.team_b_score}
                    </div>
                    {turn.team_a_reasoning && (
                      <div className="mt-2 text-[9px] text-[var(--muted)] leading-tight text-left space-y-0.5">
                        <p><span style={{ color: aColor }}>&#9679;</span> {turn.team_a_reasoning}</p>
                        <p><span style={{ color: bColor }}>&#9679;</span> {turn.team_b_reasoning}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Commentary */}
            <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed mb-4">
              {h.commentary}
            </p>

            {/* Audio + link */}
            <div className="flex items-center justify-between">
              {hasAudio ? (
                <button
                  onClick={() => playAudio(h.id, h.voiceover_audio_base64!)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
                    isPlaying
                      ? "btn-accent"
                      : "btn-ghost"
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause size={14} />
                      Playing...
                    </>
                  ) : (
                    <>
                      <Volume2 size={14} />
                      Play Commentary
                    </>
                  )}
                </button>
              ) : (
                <span />
              )}

              <Link
                href={`/match/${h.match_id}`}
                className="text-xs text-[var(--accent)] hover:underline transition-all flex items-center gap-1 font-mono"
              >
                Full transcript <ExternalLink size={10} />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
