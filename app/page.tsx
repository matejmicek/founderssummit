"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords, Users, Zap, Plus, UserPlus } from "lucide-react";

type Mode = "choose" | "create" | "join";

export default function LandingPage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [code, setCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !teamName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentCode: code.trim(),
          teamName: teamName.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team");

      router.push(`/team/${data.team.join_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamCode.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamCode: teamCode.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join team");

      router.push(`/team/${data.team.join_code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold tracking-tight mb-2">
            Agent <span className="text-[var(--accent)]">Arena</span>
          </h1>
          <p className="text-[var(--muted)] text-sm font-mono">
            Prisoner&apos;s Dilemma with AI Agents
          </p>
        </div>

        {/* Payoff matrix */}
        <div className="card p-4 mb-8">
          <div className="grid grid-cols-3 gap-1 text-center text-xs">
            <div />
            <div className="text-[var(--cooperate)] font-semibold font-mono uppercase text-[10px] tracking-wider pb-1">
              They Cooperate
            </div>
            <div className="text-[var(--betray)] font-semibold font-mono uppercase text-[10px] tracking-wider pb-1">
              They Betray
            </div>
            <div className="text-[var(--cooperate)] font-semibold text-right pr-3 font-mono uppercase text-[10px] tracking-wider">
              You Cooperate
            </div>
            <div className="rounded py-2 font-mono font-bold" style={{ background: "var(--cooperate-bg)" }}>
              +3, +3
            </div>
            <div className="rounded py-2 font-mono font-bold" style={{ background: "var(--betray-bg)" }}>
              +0, +5
            </div>
            <div className="text-[var(--betray)] font-semibold text-right pr-3 font-mono uppercase text-[10px] tracking-wider">
              You Betray
            </div>
            <div className="rounded py-2 font-mono font-bold" style={{ background: "var(--betray-bg)" }}>
              +5, +0
            </div>
            <div className="rounded py-2 font-mono font-bold" style={{ background: "var(--accent-light)" }}>
              +1, +1
            </div>
          </div>
        </div>

        {/* Mode chooser */}
        {mode === "choose" && (
          <div className="space-y-3" style={{ animation: "fade-in 0.3s ease-out" }}>
            <button
              onClick={() => setMode("create")}
              className="btn-accent w-full py-3.5 text-base rounded flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              Create a Team
            </button>
            <button
              onClick={() => setMode("join")}
              className="btn-ghost w-full py-3.5 text-base rounded flex items-center justify-center gap-2"
            >
              <UserPlus size={18} />
              Join a Team
            </button>
          </div>
        )}

        {/* Create team form */}
        {mode === "create" && (
          <form onSubmit={handleCreate} className="space-y-3" style={{ animation: "fade-in 0.3s ease-out" }}>
            <p className="text-xs text-[var(--muted)] text-center font-mono uppercase tracking-wider mb-1">
              Create a new team
            </p>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="TOURNAMENT CODE"
              maxLength={5}
              className="w-full text-center text-2xl tracking-[0.3em] font-mono font-bold bg-[var(--surface)] border border-[var(--border)] rounded px-4 py-4 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all placeholder:text-[var(--border-strong)] placeholder:text-lg placeholder:tracking-wider"
              autoFocus
            />
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Your team name"
              maxLength={30}
              className="w-full text-center text-lg bg-[var(--surface)] border border-[var(--border)] rounded px-4 py-3 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all placeholder:text-[var(--border-strong)]"
            />
            <button
              type="submit"
              disabled={loading || code.length < 3 || teamName.trim().length < 1}
              className="btn-accent w-full py-3.5 text-base rounded"
            >
              {loading ? "Creating..." : "Create Team"}
            </button>
            {error && <p className="text-[var(--betray)] text-sm text-center">{error}</p>}
            <button
              type="button"
              onClick={() => { setMode("choose"); setError(""); }}
              className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors font-mono"
            >
              Back
            </button>
          </form>
        )}

        {/* Join team form */}
        {mode === "join" && (
          <form onSubmit={handleJoin} className="space-y-3" style={{ animation: "fade-in 0.3s ease-out" }}>
            <p className="text-xs text-[var(--muted)] text-center font-mono uppercase tracking-wider mb-1">
              Join your teammates
            </p>
            <input
              type="text"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
              placeholder="TEAM CODE"
              maxLength={5}
              className="w-full text-center text-2xl tracking-[0.3em] font-mono font-bold bg-[var(--surface)] border border-[var(--border)] rounded px-4 py-4 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all placeholder:text-[var(--border-strong)] placeholder:text-lg placeholder:tracking-wider"
              autoFocus
            />
            <p className="text-xs text-[var(--muted)] text-center">
              Ask your teammate for the code or scan their QR
            </p>
            <button
              type="submit"
              disabled={loading || teamCode.trim().length < 3}
              className="btn-accent w-full py-3.5 text-base rounded"
            >
              {loading ? "Joining..." : "Join Team"}
            </button>
            {error && <p className="text-[var(--betray)] text-sm text-center">{error}</p>}
            <button
              type="button"
              onClick={() => { setMode("choose"); setError(""); }}
              className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors font-mono"
            >
              Back
            </button>
          </form>
        )}

        {/* Features */}
        <div className="mt-10 grid grid-cols-3 gap-3 text-center">
          <div className="space-y-1">
            <div className="mx-auto w-8 h-8 rounded bg-[var(--accent-light)] flex items-center justify-center">
              <Swords size={16} className="text-[var(--accent)]" />
            </div>
            <p className="text-[10px] font-medium text-[var(--muted)]">3 turns per match</p>
          </div>
          <div className="space-y-1">
            <div className="mx-auto w-8 h-8 rounded bg-[var(--accent-light)] flex items-center justify-center">
              <Users size={16} className="text-[var(--accent)]" />
            </div>
            <p className="text-[10px] font-medium text-[var(--muted)]">AI agents negotiate</p>
          </div>
          <div className="space-y-1">
            <div className="mx-auto w-8 h-8 rounded bg-[var(--accent-light)] flex items-center justify-center">
              <Zap size={16} className="text-[var(--accent)]" />
            </div>
            <p className="text-[10px] font-medium text-[var(--muted)]">Voice highlights</p>
          </div>
        </div>

        <div className="mt-8 flex gap-4 justify-center text-xs text-[var(--muted)]">
          <a href="/admin" className="hover:text-[var(--accent)] transition-colors font-mono">
            Admin
          </a>
        </div>
      </div>
    </div>
  );
}
