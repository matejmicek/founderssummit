"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import PlaybookEditor from "@/components/PlaybookEditor";
import Leaderboard from "@/components/Leaderboard";
import LiveMatchFeed from "@/components/LiveMatchFeed";
import TeamPostRound from "@/components/TeamPostRound";
import TeamShareCard from "@/components/TeamShareCard";
import { BookOpen, Radio, Trophy, Monitor, ClipboardList } from "lucide-react";

type Tab = "playbook" | "live" | "results" | "review";

export default function TeamPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [tab, setTab] = useState<Tab>("playbook");
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teamJoinCode, setTeamJoinCode] = useState(code);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(0);
  const [seasonStatus, setSeasonStatus] = useState("");
  const [roundStatus, setRoundStatus] = useState("idle");
  const [currentRound, setCurrentRound] = useState(0);
  const [resolved, setResolved] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const router = useRouter();

  // Resolve team from join code and set cookies
  useEffect(() => {
    if (!code) return;

    fetch(`/api/team/resolve?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setResolveError(data.error);
          return;
        }
        if (data.team) {
          setTeamId(data.team.id);
          setTeamName(data.team.name);
          setTeamJoinCode(data.team.join_code || code);
          setResolved(true);
        }
      })
      .catch(() => {
        setResolveError("Failed to load team");
      });
  }, [code]);

  // Fetch season/playbook info once resolved
  useEffect(() => {
    if (!resolved) return;

    fetch("/api/playbooks")
      .then((r) => r.json())
      .then((data) => {
        if (data.seasonId) setSeasonId(data.seasonId);
      })
      .catch(() => {});
  }, [resolved]);

  // Poll season state
  useEffect(() => {
    if (!resolved) return;

    let lastStatus = "";
    let lastRoundStatus = "";
    const poll = async () => {
      try {
        const res = await fetch("/api/season/current");
        const data = await res.json();
        if (data.season) {
          setSeasonId(data.season.id);
          setSeasonNumber(data.season.number);
          setSeasonStatus(data.season.status);
          setCurrentRound(data.season.current_round || 0);

          const newRoundStatus = data.season.round_status || "idle";
          setRoundStatus(newRoundStatus);

          if (data.season.status !== lastStatus || newRoundStatus !== lastRoundStatus) {
            const prevStatus = lastStatus;
            lastStatus = data.season.status;

            if (data.season.status === "running" && newRoundStatus === "running_matches") {
              setTab("live");
            } else if (data.season.status === "running" && newRoundStatus === "generating_highlights") {
              setTab("live");
            } else if (
              data.season.status === "building" ||
              (data.season.status === "building" && prevStatus !== "building")
            ) {
              setTab("playbook");
            } else if (
              data.season.status === "tweaking" ||
              (data.season.status === "running" && newRoundStatus === "idle")
            ) {
              setTab("playbook");
            }
          }

          if (newRoundStatus !== lastRoundStatus) {
            lastRoundStatus = newRoundStatus;
            if (newRoundStatus === "showing_highlights") {
              setTab("review");
            }
          }
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [resolved]);

  // Error state
  if (resolveError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight">
            Agent <span className="text-[var(--accent)]">Arena</span>
          </h1>
          <p className="text-[var(--betray)] text-sm">{resolveError}</p>
          <button
            onClick={() => router.push("/")}
            className="btn-ghost text-sm"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
          <p className="text-[var(--muted)] text-sm font-mono mt-3">Loading team...</p>
        </div>
      </div>
    );
  }

  const secretWeaponUnlocked = seasonNumber >= 2;
  const isShowingHighlights = roundStatus === "showing_highlights";
  const isRunningMatches =
    roundStatus === "running_matches" ||
    roundStatus === "generating_highlights";
  const isPostRound = isShowingHighlights || (seasonStatus === "completed" && currentRound > 0);

  const statusText = isPostRound
    ? "Round complete \u2014 review your matches!"
    : isRunningMatches
    ? "Matches in progress..."
    : seasonStatus === "building"
    ? "Write your playbook"
    : seasonStatus === "running" && roundStatus === "idle"
    ? "Write your playbook"
    : seasonStatus === "running"
    ? "Waiting for next round"
    : seasonStatus === "tweaking"
    ? "Update your strategy"
    : "Waiting for game to start...";

  const tabs = isPostRound
    ? [
        { key: "review" as Tab, label: "Review", icon: ClipboardList },
        { key: "results" as Tab, label: "Standings", icon: Trophy },
        { key: "playbook" as Tab, label: "Playbook", icon: BookOpen },
      ]
    : [
        { key: "playbook" as Tab, label: "Playbook", icon: BookOpen },
        { key: "live" as Tab, label: "Live", icon: Radio },
        { key: "results" as Tab, label: "Results", icon: Trophy },
      ];

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">{teamName || "Your Team"}</h1>
            <p className="text-xs text-[var(--muted)] font-mono">{statusText}</p>
          </div>
          <div className="flex items-center gap-2">
            {currentRound > 0 && seasonStatus === "running" && (
              <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)] font-mono font-semibold">
                R{currentRound}
              </span>
            )}
            {seasonNumber > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)] font-mono font-bold">
                S{seasonNumber}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Big screen banner during highlights */}
      {isShowingHighlights && tab !== "review" && (
        <div className="mx-4 mb-2 p-3 rounded bg-[var(--accent-light)] border border-[var(--accent)] text-center"
          style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
        >
          <div className="flex items-center justify-center gap-2">
            <Monitor size={16} className="text-[var(--accent)]" />
            <p className="text-sm font-bold text-[var(--accent)]">Highlights playing on the big screen</p>
          </div>
        </div>
      )}

      {/* Running matches banner */}
      {isRunningMatches && (
        <div className="mx-4 mb-2 p-3 rounded bg-[var(--accent-light)] border border-[var(--accent)]/30 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--accent)] border-t-transparent" />
            <p className="text-sm font-semibold text-[var(--accent)]">
              {roundStatus === "generating_highlights"
                ? "AI picking best moments..."
                : "Your agent is negotiating..."}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 px-4 py-4 overflow-y-auto pb-24">
        {tab === "playbook" && (
          <div className="space-y-5">
            {teamJoinCode && (
              <TeamShareCard joinCode={teamJoinCode} teamName={teamName} />
            )}
            <PlaybookEditor
              seasonId={seasonId}
              teamId={teamId}
              secretWeaponUnlocked={secretWeaponUnlocked}
            />
          </div>
        )}
        {tab === "live" && (
          <LiveMatchFeed seasonId={seasonId} teamId={teamId} />
        )}
        {tab === "review" && seasonId && currentRound > 0 && teamId && (
          <TeamPostRound seasonId={seasonId} round={currentRound} teamId={teamId} />
        )}
        {tab === "results" && (
          <div className="space-y-6">
            <Leaderboard seasonId={seasonId} />
          </div>
        )}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--surface)] border-t border-[var(--border)] px-4 py-2.5 max-w-lg mx-auto backdrop-blur-sm">
        <div className="flex justify-around">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-col items-center gap-1 px-4 py-1 rounded transition-colors ${
                tab === key
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)]"
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] font-semibold font-mono uppercase tracking-wider">
                {label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
