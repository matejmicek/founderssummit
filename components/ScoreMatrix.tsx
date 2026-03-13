"use client";

import { useEffect, useState, useCallback } from "react";

interface Team {
  id: string;
  name: string;
  color: string;
}

interface Cell {
  myScore: number;
  theirScore: number;
  myDecision: string;
  theirDecision: string;
  rounds: number;
}

interface Props {
  seasonId: number | null;
}

export default function ScoreMatrix({ seasonId }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [cells, setCells] = useState<Record<string, Record<string, Cell>>>({});

  const fetchMatrix = useCallback(async () => {
    if (!seasonId) return;
    try {
      const res = await fetch(`/api/seasons/${seasonId}/matrix`);
      const data = await res.json();
      setTeams(data.teams || []);
      setCells(data.cells || {});
    } catch {}
  }, [seasonId]);

  useEffect(() => {
    fetchMatrix();
    const interval = setInterval(fetchMatrix, 8000);
    return () => clearInterval(interval);
  }, [fetchMatrix]);

  if (teams.length === 0) {
    return (
      <div className="text-center text-[var(--muted)] py-8 text-sm font-mono">
        No data yet
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto p-1">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left text-[var(--muted)] font-mono font-normal text-[10px] uppercase tracking-widest">
              vs
            </th>
            {teams.map((t) => (
              <th key={t.id} className="p-2 text-center font-medium" style={{ minWidth: 60 }}>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                  <span className="truncate max-w-[60px] text-[10px] font-mono">
                    {t.name.split(" ")[0]}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((rowTeam) => (
            <tr key={rowTeam.id}>
              <td className="p-2 font-medium whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: rowTeam.color }} />
                  <span className="truncate max-w-[80px] text-[11px]">{rowTeam.name}</span>
                </div>
              </td>
              {teams.map((colTeam) => {
                if (rowTeam.id === colTeam.id) {
                  return (
                    <td key={colTeam.id} className="p-2 text-center bg-[var(--background)]">
                      &mdash;
                    </td>
                  );
                }

                const cell = cells[rowTeam.id]?.[colTeam.id];
                if (!cell) {
                  return (
                    <td key={colTeam.id} className="p-2 text-center text-[var(--muted)]">
                      &middot;
                    </td>
                  );
                }

                const net = cell.myScore - cell.theirScore;
                const bgColor =
                  net > 0
                    ? "var(--cooperate-bg)"
                    : net < 0
                    ? "var(--betray-bg)"
                    : "var(--accent-light)";

                return (
                  <td
                    key={colTeam.id}
                    className="p-2 text-center font-mono tabular-nums text-[11px]"
                    style={{ backgroundColor: bgColor }}
                  >
                    <span className={net > 0 ? "text-[var(--cooperate)] font-bold" : net < 0 ? "text-[var(--betray)] font-bold" : "text-[var(--muted)]"}>
                      {cell.myScore}
                    </span>
                    <span className="text-[var(--muted)]">-</span>
                    <span className="text-[var(--muted)]">{cell.theirScore}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
