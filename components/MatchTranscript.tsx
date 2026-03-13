"use client";

import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";

interface TurnData {
  turn: number;
  team_a_decision: string;
  team_b_decision: string;
  team_a_score: number;
  team_b_score: number;
}

interface Props {
  matchId: string;
  teamA: { id: string; name: string; color: string };
  teamB: { id: string; name: string; color: string };
  teamAScore?: number | null;
  teamBScore?: number | null;
  status: string;
  turns?: TurnData[];
}

export default function MatchTranscript({
  matchId,
  teamA,
  teamB,
  teamAScore,
  teamBScore,
  status,
  turns = [],
}: Props) {
  const { messages } = useRealtimeMessages(matchId);

  const messagesByTurn: Record<number, typeof messages> = {};
  for (const msg of messages) {
    const turn = (msg as { turn?: number }).turn || 1;
    if (!messagesByTurn[turn]) messagesByTurn[turn] = [];
    messagesByTurn[turn].push(msg);
  }

  const turnNumbers = Object.keys(messagesByTurn).map(Number).sort((a, b) => a - b);
  const hasTurns = turnNumbers.length > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: teamA.color }} />
          <span className="font-semibold">{teamA.name}</span>
        </div>
        <span className="text-[var(--muted)] font-mono text-xs">vs</span>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{teamB.name}</span>
          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: teamB.color }} />
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4 max-h-[500px] overflow-y-auto">
        {hasTurns ? (
          turnNumbers.map((turnNum) => {
            const turnMsgs = messagesByTurn[turnNum] || [];
            const turnResult = turns.find((t) => t.turn === turnNum);

            return (
              <div key={turnNum}>
                <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest font-mono mb-2">
                  Turn {turnNum}
                </div>

                <div className="space-y-2 mb-2">
                  {turnMsgs.map((msg) => {
                    const isTeamA = msg.team_id === teamA.id;
                    const team = isTeamA ? teamA : teamB;

                    return (
                      <div key={msg.id} className={`flex ${isTeamA ? "justify-start" : "justify-end"}`}>
                        <div
                          className="max-w-[80%] rounded px-3.5 py-2 text-sm"
                          style={{
                            backgroundColor: team.color + "12",
                            borderLeft: isTeamA ? `3px solid ${team.color}` : "none",
                            borderRight: !isTeamA ? `3px solid ${team.color}` : "none",
                          }}
                        >
                          <div className="text-[10px] font-semibold mb-0.5 font-mono" style={{ color: team.color }}>
                            {team.name}
                          </div>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {turnResult && (
                  <div className="flex items-center justify-center gap-4 py-2 px-3 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs font-mono">
                    <span className={`font-bold ${turnResult.team_a_decision === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}`}>
                      {turnResult.team_a_decision.toUpperCase()} +{turnResult.team_a_score}
                    </span>
                    <span className="text-[var(--muted)]">|</span>
                    <span className={`font-bold ${turnResult.team_b_decision === "cooperate" ? "text-[var(--cooperate)]" : "text-[var(--betray)]"}`}>
                      +{turnResult.team_b_score} {turnResult.team_b_decision.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          messages.map((msg) => {
            const isTeamA = msg.team_id === teamA.id;
            const team = isTeamA ? teamA : teamB;

            return (
              <div key={msg.id} className={`flex ${isTeamA ? "justify-start" : "justify-end"}`}>
                <div
                  className="max-w-[80%] rounded px-3.5 py-2 text-sm"
                  style={{
                    backgroundColor: team.color + "12",
                    borderLeft: isTeamA ? `3px solid ${team.color}` : "none",
                    borderRight: !isTeamA ? `3px solid ${team.color}` : "none",
                  }}
                >
                  <div className="text-[10px] font-semibold mb-0.5 font-mono" style={{ color: team.color }}>
                    {team.name}
                  </div>
                  {msg.content}
                </div>
              </div>
            );
          })
        )}

        {status === "talking" && (
          <div className="flex justify-center">
            <div className="text-xs text-[var(--muted)] font-mono animate-pulse">
              Agents are talking...
            </div>
          </div>
        )}

        {status === "deciding" && (
          <div className="flex justify-center">
            <div className="text-xs text-[var(--accent)] font-mono animate-pulse">
              Making decisions...
            </div>
          </div>
        )}
      </div>

      {/* Final totals */}
      {status === "completed" && teamAScore != null && teamBScore != null && (
        <div className="border-t border-[var(--border)] pt-3 mt-3">
          <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-widest font-mono text-center mb-2">
            Final Score
          </div>
          <div className="flex justify-between items-center text-sm">
            <div className="text-center flex-1">
              <div className="text-3xl font-extrabold font-mono">+{teamAScore}</div>
            </div>
            <div className="text-[var(--muted)] font-mono">&ndash;</div>
            <div className="text-center flex-1">
              <div className="text-3xl font-extrabold font-mono">+{teamBScore}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
