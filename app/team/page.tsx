"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PlaybookEditor from "@/components/PlaybookEditor";
import Leaderboard from "@/components/Leaderboard";
import LiveMatchFeed from "@/components/LiveMatchFeed";

type Tab = "playbook" | "live" | "results";

export default function TeamPage() {
  const [tab, setTab] = useState<Tab>("playbook");
  const [teamName, setTeamName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [seasonNumber, setSeasonNumber] = useState(0);
  const [seasonStatus, setSeasonStatus] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Read team name from cookie
    const name = document.cookie
      .split("; ")
      .find((c) => c.startsWith("team_name="))
      ?.split("=")[1];

    if (!name) {
      router.push("/");
      return;
    }

    setTeamName(decodeURIComponent(name));

    // Read team_id from a separate fetch since it's httpOnly
    fetch("/api/playbooks")
      .then((r) => r.json())
      .then((data) => {
        if (data.seasonId) setSeasonId(data.seasonId);
        if (data.playbook?.team_id) setTeamId(data.playbook.team_id);
      })
      .catch(() => {});

    // Poll for season status
    const pollSeason = async () => {
      try {
        const res = await fetch("/api/admin/state", {
          headers: { "x-admin-secret": "" },
        });
        // This will fail for non-admins, that's ok
        // We need a public season endpoint instead
      } catch {}
    };
  }, [router]);

  // Poll for active season
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/season/current");
        const data = await res.json();
        if (data.season) {
          setSeasonId(data.season.id);
          setSeasonNumber(data.season.number);
          setSeasonStatus(data.season.status);

          // Auto-switch tabs based on game phase
          if (data.season.status === "running") {
            setTab("live");
          } else if (data.season.status === "building" || data.season.status === "tweaking") {
            setTab("playbook");
          }
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const secretWeaponUnlocked = seasonNumber >= 2;

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{teamName || "Your Team"}</h1>
            <p className="text-xs text-[var(--muted)]">
              {seasonStatus === "building"
                ? "Write your playbook"
                : seasonStatus === "running"
                ? "Matches in progress"
                : seasonStatus === "tweaking"
                ? "Update your strategy"
                : "Waiting for game to start..."}
            </p>
          </div>
          {seasonNumber > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent)]/20 text-[var(--accent)]">
              Season {seasonNumber}
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 overflow-y-auto pb-20">
        {tab === "playbook" && (
          <PlaybookEditor
            seasonId={seasonId}
            secretWeaponUnlocked={secretWeaponUnlocked}
          />
        )}
        {tab === "live" && (
          <LiveMatchFeed seasonId={seasonId} teamId={teamId} />
        )}
        {tab === "results" && (
          <Leaderboard seasonId={seasonId} />
        )}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--card)] border-t border-[var(--card-border)] px-4 py-3 max-w-lg mx-auto">
        <div className="flex justify-around">
          {(["playbook", "live", "results"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs font-medium capitalize transition-colors ${
                tab === t
                  ? "text-[var(--accent-light)]"
                  : "text-[var(--muted)]"
              }`}
            >
              {t === "playbook" ? "Playbook" : t === "live" ? "Live" : "Results"}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
