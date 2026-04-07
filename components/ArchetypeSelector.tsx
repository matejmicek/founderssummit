"use client";

import { useState } from "react";
import { ARCHETYPES } from "@/lib/engine/rounds";

interface Props {
  onSelect: (personality: string, archetypeId: string) => void;
  selectedId?: string;
}

export default function ArchetypeSelector({ onSelect, selectedId }: Props) {
  const [selected, setSelected] = useState<string | null>(selectedId || null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--foreground-secondary)]">
          Quick Start: Pick an Archetype
        </h3>
        <span className="text-[10px] font-mono text-[var(--muted)]">
          or write your own below
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ARCHETYPES.map((arch) => (
          <button
            key={arch.id}
            onClick={() => {
              setSelected(arch.id);
              onSelect(arch.personality, arch.id);
            }}
            className={`card p-3 text-left transition-all active:scale-[0.98] ${
              selected === arch.id
                ? "border-2 shadow-md"
                : "hover:border-[var(--border-strong)]"
            }`}
            style={
              selected === arch.id
                ? { borderColor: arch.color, backgroundColor: `${arch.color}10` }
                : undefined
            }
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{arch.emoji}</span>
              <span className="font-bold text-xs" style={{ color: arch.color }}>
                {arch.name}
              </span>
            </div>
            <p className="text-[10px] text-[var(--muted)] leading-tight line-clamp-2">
              {arch.personality.slice(0, 80)}...
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
