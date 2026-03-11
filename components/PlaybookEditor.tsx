"use client";

import { useState, useEffect, useCallback } from "react";

interface PlaybookData {
  personality: string;
  strategy: string;
  secret_weapon: string;
}

interface Props {
  seasonId: number | null;
  secretWeaponUnlocked: boolean;
}

export default function PlaybookEditor({ seasonId, secretWeaponUnlocked }: Props) {
  const [personality, setPersonality] = useState("");
  const [strategy, setStrategy] = useState("");
  const [secretWeapon, setSecretWeapon] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/playbooks")
      .then((r) => r.json())
      .then((data) => {
        if (data.playbook) {
          setPersonality(data.playbook.personality || "");
          setStrategy(data.playbook.strategy || "");
          setSecretWeapon(data.playbook.secret_weapon || "");
        }
      })
      .catch(() => {});
  }, [seasonId]);

  // Auto-save to localStorage
  useEffect(() => {
    const key = `playbook-${seasonId}`;
    const timer = setTimeout(() => {
      localStorage.setItem(
        key,
        JSON.stringify({ personality, strategy, secretWeapon })
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [personality, strategy, secretWeapon, seasonId]);

  const save = useCallback(async () => {
    if (!seasonId) return;
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch("/api/playbooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personality,
          strategy,
          secretWeapon,
          seasonId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [personality, strategy, secretWeapon, seasonId]);

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-1.5">
          Personality & Style
          <span className="float-right tabular-nums">
            {personality.length}/200
          </span>
        </label>
        <textarea
          value={personality}
          onChange={(e) => setPersonality(e.target.value.slice(0, 200))}
          placeholder="Who is your agent? How does it talk and negotiate?"
          className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-1.5">
          Core Strategy
          <span className="float-right tabular-nums">
            {strategy.length}/300
          </span>
        </label>
        <textarea
          value={strategy}
          onChange={(e) => setStrategy(e.target.value.slice(0, 300))}
          placeholder="When to cooperate, when to betray, how to read opponents, how to handle betrayal"
          className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
          rows={4}
        />
      </div>

      <div className={secretWeaponUnlocked ? "" : "opacity-40 pointer-events-none"}>
        <label className="block text-sm font-medium text-[var(--muted)] mb-1.5">
          Secret Weapon {!secretWeaponUnlocked && "🔒 Unlocks in Season 2"}
          <span className="float-right tabular-nums">
            {secretWeapon.length}/100
          </span>
        </label>
        <textarea
          value={secretWeapon}
          onChange={(e) => setSecretWeapon(e.target.value.slice(0, 100))}
          placeholder="Your wildcard move..."
          className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
          rows={2}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || !seasonId}
          className="px-5 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Playbook"}
        </button>
        {saved && (
          <span className="text-[var(--cooperate)] text-sm">Saved!</span>
        )}
        {error && (
          <span className="text-[var(--betray)] text-sm">{error}</span>
        )}
      </div>
    </div>
  );
}
