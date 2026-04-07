"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, Users, Wifi, WifiOff, CloudCheck } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";
import ArchetypeSelector from "./ArchetypeSelector";

interface Props {
  seasonId: number | null;
  teamId: string;
  roundNumber?: number;
}

export default function PlaybookEditor({
  seasonId,
  teamId,
  roundNumber = 1,
}: Props) {
  const [personality, setPersonality] = useState("");
  const [negotiationGoal, setNegotiationGoal] = useState("");
  const [secretWeapon, setSecretWeapon] = useState("");
  const [archetype, setArchetype] = useState<string | null>(null);
  // Keep legacy fields for backward compat with API
  const [cooperateStrategy, setCooperateStrategy] = useState("");
  const [betrayStrategy, setBetrayStrategy] = useState("");
  const [ready, setReady] = useState(false);
  const [togglingReady, setTogglingReady] = useState(false);
  const [isSynced, setIsSynced] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"connected" | "disconnected" | "syncing">("disconnected");
  const [remoteUpdate, setRemoteUpdate] = useState(false);

  const lastSaveTimestamp = useRef<string | null>(null);
  const isLocalSave = useRef(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const isDirty = useRef(false);

  const fieldsRef = useRef({ personality: "", cooperateStrategy: "", betrayStrategy: "", secretWeapon: "", negotiationGoal: "" });

  useEffect(() => {
    fieldsRef.current = { personality, cooperateStrategy, betrayStrategy, secretWeapon, negotiationGoal };
  }, [personality, cooperateStrategy, betrayStrategy, secretWeapon, negotiationGoal]);

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
          setNegotiationGoal(data.playbook.negotiation_goal || "");
          setArchetype(data.playbook.archetype || null);
          setReady(data.playbook.ready || false);
          setIsSynced(true);
          lastSaveTimestamp.current = data.playbook.submitted_at || null;
        }
      })
      .catch(() => {});
  }, [seasonId]);

  // Supabase Realtime — sync from teammates
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

          if (isLocalSave.current) {
            isLocalSave.current = false;
            return;
          }

          setPersonality(String(row.personality || ""));
          setCooperateStrategy(String(row.cooperate_strategy || ""));
          setBetrayStrategy(String(row.betray_strategy || ""));
          setSecretWeapon(String(row.secret_weapon || ""));
          setNegotiationGoal(String(row.negotiation_goal || ""));
          setArchetype(row.archetype ? String(row.archetype) : null);
          setReady(Boolean(row.ready));
          setIsSynced(true);
          isDirty.current = false;
          lastSaveTimestamp.current = String(row.submitted_at || "");

          setRemoteUpdate(true);
          setTimeout(() => setRemoteUpdate(false), 2000);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setSyncStatus("connected");
        else if (status === "CLOSED" || status === "CHANNEL_ERROR") setSyncStatus("disconnected");
      });

    return () => {
      supabase.removeChannel(channel);
      setSyncStatus("disconnected");
    };
  }, [seasonId, teamId]);

  // Auto-save with debounce
  // Track if fields have been modified since last save
  const hasEdited = useRef(false);

  useEffect(() => {
    hasEdited.current = true;
    setIsSynced(false);

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

    autoSaveTimer.current = setTimeout(() => {
      if (hasEdited.current && seasonId) {
        isDirty.current = true;
        autoSave();
        hasEdited.current = false;
      }
    }, 2000);

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personality, cooperateStrategy, betrayStrategy, secretWeapon, negotiationGoal]);

  // When seasonId arrives and there are pending edits, save immediately
  useEffect(() => {
    if (seasonId && hasEdited.current) {
      isDirty.current = true;
      autoSave();
      hasEdited.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonId]);

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
          negotiationGoal: fields.negotiationGoal,
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
      if (res.ok) setReady(!ready);
      else isLocalSave.current = false;
    } catch {
      isLocalSave.current = false;
    }
    setTogglingReady(false);
  }, [ready, seasonId]);

  const handleArchetypeSelect = (personalityText: string, archetypeId: string) => {
    setPersonality(personalityText);
    setArchetype(archetypeId);
  };

  const hasContent = personality.trim().length > 0;

  // Determine which fields to show based on round
  const showNegotiationOnly = true; // In human-decision mode, no need for cooperate/betray strategy

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

      {/* Archetype quick-select (shown for Round 1 or when no personality set) */}
      {(roundNumber <= 1 || !personality.trim()) && (
        <ArchetypeSelector onSelect={handleArchetypeSelect} selectedId={archetype || undefined} />
      )}

      {/* Personality — always shown, the main field */}
      <div className="card p-4">
        <label className="flex items-center justify-between text-sm font-semibold text-[var(--foreground-secondary)] mb-2">
          Agent Personality
          <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
            {personality.length}/500
          </span>
        </label>
        <textarea
          value={personality}
          onChange={(e) => setPersonality(e.target.value.slice(0, 500))}
          placeholder="Who is your agent? How does it talk, negotiate, and persuade? This defines your agent's character in negotiations."
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-glow)] transition-all placeholder:text-[var(--muted)]"
          rows={4}
        />
        <p className="text-[10px] text-[var(--muted)] mt-1.5">
          Your agent negotiates on your behalf. <strong>Your team</strong> makes the final cooperate/betray decision each turn.
        </p>
      </div>

      {/* Negotiation guidance — optional */}
      <div className="card p-4 border-l-[3px] border-l-[var(--accent)]">
        <label className="flex items-center justify-between text-sm font-semibold text-[var(--accent)] mb-2">
          Negotiation Goal
          <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
            {negotiationGoal.length}/300
          </span>
        </label>
        <textarea
          value={negotiationGoal}
          onChange={(e) => setNegotiationGoal(e.target.value.slice(0, 300))}
          placeholder="Optional: What should your agent try to achieve in negotiations? e.g., 'Build trust early, then read their intentions' or 'Intimidate them into cooperating'"
          className="w-full bg-[var(--background)] border border-[var(--border)] rounded px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-all placeholder:text-[var(--muted)]"
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
