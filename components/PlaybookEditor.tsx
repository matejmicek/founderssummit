"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Lock, Users, Wifi, WifiOff, CloudCheck } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";

interface Props {
  seasonId: number | null;
  teamId: string;
  secretWeaponUnlocked: boolean;
}

export default function PlaybookEditor({
  seasonId,
  teamId,
  secretWeaponUnlocked,
}: Props) {
  const [personality, setPersonality] = useState("");
  const [cooperateStrategy, setCooperateStrategy] = useState("");
  const [betrayStrategy, setBetrayStrategy] = useState("");
  const [secretWeapon, setSecretWeapon] = useState("");
  const [ready, setReady] = useState(false);
  const [togglingReady, setTogglingReady] = useState(false);
  const [isSynced, setIsSynced] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"connected" | "disconnected" | "syncing">("disconnected");
  const [remoteUpdate, setRemoteUpdate] = useState(false);

  // Refs to track local vs remote changes
  const lastSaveTimestamp = useRef<string | null>(null);
  const isLocalSave = useRef(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const isDirty = useRef(false);

  // Refs for current field values (to use in auto-save without stale closures)
  const fieldsRef = useRef({ personality: "", cooperateStrategy: "", betrayStrategy: "", secretWeapon: "" });

  // Keep refs in sync with state
  useEffect(() => {
    fieldsRef.current = { personality, cooperateStrategy, betrayStrategy, secretWeapon };
  }, [personality, cooperateStrategy, betrayStrategy, secretWeapon]);

  // Initial fetch
  useEffect(() => {
    fetch("/api/playbooks")
      .then((r) => r.json())
      .then((data) => {
        if (data.playbook) {
          setPersonality(data.playbook.personality || "");
          setCooperateStrategy(data.playbook.cooperate_strategy || "");
          setBetrayStrategy(data.playbook.betray_strategy || "");
          setSecretWeapon(data.playbook.secret_weapon || "");
          setReady(data.playbook.ready || false);
          setIsSynced(true);
          lastSaveTimestamp.current = data.playbook.submitted_at || null;
        }
      })
      .catch(() => {});
  }, [seasonId]);

  // Supabase Realtime subscription — sync edits from teammates
  useEffect(() => {
    if (!seasonId || !teamId) return;

    const supabase = createBrowserClient();
    const channel = supabase
      .channel(`playbook-${teamId}-${seasonId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "playbooks",
          filter: `team_id=eq.${teamId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (Number(row.season_id) !== seasonId) return;

          // Skip if this was our own save
          if (isLocalSave.current) {
            isLocalSave.current = false;
            return;
          }

          // Apply remote changes
          setPersonality(String(row.personality || ""));
          setCooperateStrategy(String(row.cooperate_strategy || ""));
          setBetrayStrategy(String(row.betray_strategy || ""));
          setSecretWeapon(String(row.secret_weapon || ""));
          setReady(Boolean(row.ready));
          setIsSynced(true);
          isDirty.current = false;
          lastSaveTimestamp.current = String(row.submitted_at || "");

          // Flash the "teammate updated" indicator
          setRemoteUpdate(true);
          setTimeout(() => setRemoteUpdate(false), 2000);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncStatus("connected");
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setSyncStatus("disconnected");
        }
      });

    return () => {
      supabase.removeChannel(channel);
      setSyncStatus("disconnected");
    };
  }, [seasonId, teamId]);

  // Auto-save with debounce (2s after last keystroke)
  useEffect(() => {
    if (!seasonId) return;

    isDirty.current = true;
    setIsSynced(false);

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      if (isDirty.current) {
        autoSave();
      }
    }, 2000);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personality, cooperateStrategy, betrayStrategy, secretWeapon, seasonId]);

  const autoSave = async () => {
    if (!seasonId) return;

    const fields = fieldsRef.current;
    setSyncStatus("syncing");
    isLocalSave.current = true;

    try {
      const res = await fetch("/api/playbooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personality: fields.personality,
          cooperateStrategy: fields.cooperateStrategy,
          betrayStrategy: fields.betrayStrategy,
          secretWeapon: fields.secretWeapon,
          seasonId,
        }),
      });

      if (res.ok) {
        isDirty.current = false;
        setReady(false);
        setIsSynced(true);
        setSyncStatus("connected");
      } else {
        isLocalSave.current = false;
        setSyncStatus("connected");
      }
    } catch {
      isLocalSave.current = false;
      setSyncStatus("connected");
    }
  };

  const toggleReady = useCallback(async () => {
    if (!seasonId) return;
    setTogglingReady(true);
    isLocalSave.current = true;
    try {
      const res = await fetch("/api/playbooks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ready: !ready, seasonId }),
      });
      if (res.ok) {
        setReady(!ready);
      } else {
        isLocalSave.current = false;
      }
    } catch {
      isLocalSave.current = false;
    }
    setTogglingReady(false);
  }, [ready, seasonId]);

  const hasContent =
    personality.trim().length > 0 ||
    cooperateStrategy.trim().length > 0 ||
    betrayStrategy.trim().length > 0;

  return (
    <div className="space-y-5">
      {/* Sync status bar */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[var(--muted)]">
        <div className="flex items-center gap-1.5">
          {syncStatus === "connected" ? (
            <Wifi size={11} className="text-[var(--cooperate)]" />
          ) : syncStatus === "syncing" ? (
            <Wifi size={11} className="text-[var(--accent)] animate-pulse" />
          ) : (
            <WifiOff size={11} />
          )}
          <span>
            {syncStatus === "connected"
              ? "Live sync on"
              : syncStatus === "syncing"
              ? "Syncing..."
              : "Connecting..."}
          </span>
        </div>
        {remoteUpdate && (
          <span className="flex items-center gap-1 text-[var(--accent)] font-semibold" style={{ animation: "fade-in 0.3s ease-out" }}>
            <Users size={11} />
            Teammate updated
          </span>
        )}
      </div>

      {/* Personality */}
      <div className="card p-4">
        <label className="flex items-center justify-between text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
          Personality & Style
          <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
            {personality.length}/500
          </span>
        </label>
        <textarea
          value={personality}
          onChange={(e) => setPersonality(e.target.value.slice(0, 500))}
          placeholder="Who is your agent? How does it talk and negotiate?"
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all placeholder:text-[var(--muted)]"
          rows={3}
        />
      </div>

      {/* Cooperate */}
      <div className="card p-4 border-l-[3px] border-l-[var(--cooperate)]">
        <label className="flex items-center justify-between text-sm font-semibold text-[var(--cooperate)] mb-2">
          When to Cooperate
          <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
            {cooperateStrategy.length}/300
          </span>
        </label>
        <textarea
          value={cooperateStrategy}
          onChange={(e) => setCooperateStrategy(e.target.value.slice(0, 300))}
          placeholder="Under what conditions should your agent cooperate?"
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--cooperate)] transition-all placeholder:text-[var(--muted)]"
          rows={3}
        />
      </div>

      {/* Betray */}
      <div className="card p-4 border-l-[3px] border-l-[var(--betray)]">
        <label className="flex items-center justify-between text-sm font-semibold text-[var(--betray)] mb-2">
          When to Betray
          <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
            {betrayStrategy.length}/300
          </span>
        </label>
        <textarea
          value={betrayStrategy}
          onChange={(e) => setBetrayStrategy(e.target.value.slice(0, 300))}
          placeholder="Under what conditions should your agent betray?"
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--betray)] transition-all placeholder:text-[var(--muted)]"
          rows={3}
        />
      </div>

      {/* Secret Weapon */}
      <div className={`card p-4 ${secretWeaponUnlocked ? "" : "opacity-50"}`}>
        <label className="flex items-center justify-between text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
          <span className="flex items-center gap-1.5">
            {!secretWeaponUnlocked && <Lock size={14} />}
            Secret Weapon {!secretWeaponUnlocked && "— Unlocks Season 2"}
          </span>
          <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
            {secretWeapon.length}/100
          </span>
        </label>
        <textarea
          value={secretWeapon}
          onChange={(e) => setSecretWeapon(e.target.value.slice(0, 100))}
          placeholder="Your wildcard move..."
          disabled={!secretWeaponUnlocked}
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-all placeholder:text-[var(--muted)] disabled:cursor-not-allowed"
          rows={2}
        />
      </div>

      {/* Action area */}
      <div className="flex items-center justify-between">
        <button
          onClick={toggleReady}
          disabled={togglingReady || !seasonId || !hasContent || !isSynced}
          className={`text-sm font-semibold rounded px-5 py-2.5 transition-all flex items-center gap-2 ${
            ready
              ? "bg-[var(--cooperate)] text-white shadow-sm"
              : "btn-ghost"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <Check size={14} />
          {ready ? "Ready!" : "Mark Ready"}
        </button>

        <div className="flex items-center gap-1.5 text-xs font-mono">
          {isSynced ? (
            <span className="flex items-center gap-1 text-[var(--cooperate)]">
              <CloudCheck size={14} />
              Saved
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[var(--muted)] animate-pulse">
              Saving...
            </span>
          )}
        </div>
      </div>

      {ready && (
        <p className="text-xs text-[var(--cooperate)] font-mono">
          You&apos;re ready! The host can see your status.
        </p>
      )}
    </div>
  );
}
