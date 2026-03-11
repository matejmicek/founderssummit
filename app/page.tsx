"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid code");
      }

      router.push("/team");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        {/* Logo / Title */}
        <h1 className="text-4xl font-bold mb-2">
          Agent <span className="text-[var(--accent)]">Arena</span>
        </h1>
        <p className="text-[var(--muted)] mb-8 text-sm">
          Iterated Prisoner&apos;s Dilemma with Talking AI Agents
        </p>

        {/* Payoff matrix preview */}
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4 mb-8 text-xs">
          <div className="grid grid-cols-3 gap-1 text-center">
            <div />
            <div className="text-[var(--cooperate)] font-medium">They Cooperate</div>
            <div className="text-[var(--betray)] font-medium">They Betray</div>

            <div className="text-[var(--cooperate)] font-medium text-right pr-2">
              You Cooperate
            </div>
            <div className="bg-green-500/10 rounded py-1.5">+3, +3</div>
            <div className="bg-red-500/10 rounded py-1.5">+0, +5</div>

            <div className="text-[var(--betray)] font-medium text-right pr-2">
              You Betray
            </div>
            <div className="bg-red-500/10 rounded py-1.5">+5, +0</div>
            <div className="bg-orange-500/10 rounded py-1.5">+1, +1</div>
          </div>
        </div>

        {/* Join form */}
        <form onSubmit={handleJoin} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ENTER JOIN CODE"
            maxLength={4}
            className="w-full text-center text-2xl tracking-[0.3em] font-mono bg-[var(--card)] border border-[var(--card-border)] rounded-xl px-4 py-4 focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--card-border)] placeholder:text-lg placeholder:tracking-wider"
            autoFocus
          />

          <button
            type="submit"
            disabled={loading || code.length < 4}
            className="w-full py-3 bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white font-bold rounded-xl transition-colors disabled:opacity-40"
          >
            {loading ? "Joining..." : "Join Game"}
          </button>

          {error && (
            <p className="text-[var(--betray)] text-sm">{error}</p>
          )}
        </form>

        <div className="mt-8 flex gap-4 justify-center text-xs text-[var(--muted)]">
          <a href="/spectate" className="hover:text-white transition-colors">
            Spectate
          </a>
          <a href="/admin" className="hover:text-white transition-colors">
            Admin
          </a>
        </div>
      </div>
    </div>
  );
}
