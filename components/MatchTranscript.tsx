"use client";

import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";

interface Props {
  matchId: string;
  teamA: { id: string; name: string; color: string };
  teamB: { id: string; name: string; color: string };
  teamADecision?: string | null;
  teamBDecision?: string | null;
  teamAScore?: number | null;
  teamBScore?: number | null;
  status: string;
}

export default function MatchTranscript({
  matchId,
  teamA,
  teamB,
  teamADecision,
  teamBDecision,
  teamAScore,
  teamBScore,
  status,
}: Props) {
  const { messages } = useRealtimeMessages(matchId);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: teamA.color }}
          />
          <span className="font-medium">{teamA.name}</span>
        </div>
        <span className="text-[var(--muted)]">vs</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">{teamB.name}</span>
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: teamB.color }}
          />
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {messages.map((msg) => {
          const isTeamA = msg.team_id === teamA.id;
          const team = isTeamA ? teamA : teamB;

          return (
            <div
              key={msg.id}
              className={`flex ${isTeamA ? "justify-start" : "justify-end"}`}
            >
              <div
                className="max-w-[80%] rounded-2xl px-3.5 py-2 text-sm"
                style={{
                  backgroundColor: team.color + "20",
                  borderLeft: isTeamA ? `3px solid ${team.color}` : "none",
                  borderRight: !isTeamA ? `3px solid ${team.color}` : "none",
                }}
              >
                <div
                  className="text-[10px] font-medium mb-0.5 opacity-70"
                  style={{ color: team.color }}
                >
                  {team.name}
                </div>
                {msg.content}
              </div>
            </div>
          );
        })}

        {status === "talking" && (
          <div className="flex justify-center">
            <div className="text-xs text-[var(--muted)] animate-pulse">
              Agents are talking...
            </div>
          </div>
        )}

        {status === "deciding" && (
          <div className="flex justify-center">
            <div className="text-xs text-[var(--accent)] animate-pulse">
              Making decisions...
            </div>
          </div>
        )}
      </div>

      {/* Outcome */}
      {status === "completed" && teamADecision && teamBDecision && (
        <div className="border-t border-[var(--card-border)] pt-3 mt-3">
          <div className="flex justify-between items-center text-sm">
            <div className="text-center">
              <div
                className={`font-bold ${
                  teamADecision === "cooperate"
                    ? "text-[var(--cooperate)]"
                    : "text-[var(--betray)]"
                }`}
              >
                {teamADecision.toUpperCase()}
              </div>
              <div className="text-lg font-bold">
                +{teamAScore ?? 0}
              </div>
            </div>
            <div className="text-[var(--muted)]">vs</div>
            <div className="text-center">
              <div
                className={`font-bold ${
                  teamBDecision === "cooperate"
                    ? "text-[var(--cooperate)]"
                    : "text-[var(--betray)]"
                }`}
              >
                {teamBDecision.toUpperCase()}
              </div>
              <div className="text-lg font-bold">
                +{teamBScore ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
