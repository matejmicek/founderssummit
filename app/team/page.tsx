"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PlaybookEditor from "@/components/PlaybookEditor";
import Leaderboard from "@/components/Leaderboard";
import LiveMatchFeed from "@/components/LiveMatchFeed";
import RoundHighlights from "@/components/RoundHighlights";
import TeamShareCard from "@/components/TeamShareCard";
import { BookOpen, Radio, Trophy, Monitor } from "lucide-react";

type Tab = "playbook" | "live" | "results";

export default function TeamPage() {
  const [tab, setTab] = useState<Tab>("playbook");
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [teamJoinCode, setTeamJoinCode] = useState("");
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(0);
  const [seasonStatus, setSeasonStatus] = useState("");
  const [roundStatus, setRoundStatus] = useState("idle");
  const [currentRound, setCurrentRound] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const name = document.cookie
      .split("; ")
      .find((c) => c.startsWith("team_name="))
      ?.split("=")[1];

    if (!name) {
      router.push("/");
      return;
    }

    setTeamName(decodeURIComponent(name));

    // Fetch team info including join code
    fetch("/api/team/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.team) {
          setTeamId(data.team.id);
          setTeamJoinCode(data.team.join_code || "");
        }
      })
      .catch(() => {});

    fetch("/api/playbooks")
      .then((r) => r.json())
      .then((data) => {
        if (data.seasonId) setSeasonId(data.seasonId);
        if (data.playbook?.team_id) setTeamId(data.playbook.team_id);
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
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
            lastStatus = data.season.status;
            if (data.season.status === "running" && newRoundStatus !== "idle") {
              setTab("live");
            } else if (
              data.season.status === "building" ||
              data.season.status === "tweaking" ||
              (data.season.status === "running" && newRoundStatus === "idle")
            ) {
              setTab("playbook");
            }
          }

          if (newRoundStatus !== lastRoundStatus) {
            lastRoundStatus = newRoundStatus;
            if (newRoundStatus === "showing_highlights") {
              setTab("results");
            }
          }
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  const secretWeaponUnlocked = seasonNumber >= 2;
  const isShowingHighlights = roundStatus === "showing_highlights";
  const isRunningMatches =
    roundStatus === "running_matches" ||
    roundStatus === "generating_highlights";

  const statusText = isShowingHighlights
    ? "Highlights are playing!"
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

  const tabs = [
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
      {isShowingHighlights && (
        <div className="mx-4 mb-2 p-4 rounded bg-[var(--accent-light)] border border-[var(--accent)] text-center"
          style={{ animation: "pulse-glow 2s ease-in-out infinite" }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Monitor size={20} className="text-[var(--accent)]" />
            <p className="text-lg font-extrabold text-[var(--accent)]">Look at the big screen!</p>
          </div>
          <p className="text-xs text-[var(--foreground-secondary)] font-mono">
            Round {currentRound} highlights are playing
          </p>
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
        {tab === "results" && (
          <div className="space-y-6">
            {isShowingHighlights && seasonId && currentRound > 0 && (
              <RoundHighlights seasonId={seasonId} round={currentRound} />
            )}
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
