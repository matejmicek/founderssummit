"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Users, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

interface Props {
  joinCode: string;
  teamName: string;
}

export default function TeamShareCard({ joinCode, teamName }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const joinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/join/${joinCode}`
    : `/join/${joinCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="card p-4 border-l-[3px] border-l-[var(--accent)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--foreground-secondary)]">
            Invite teammates
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-widest text-[var(--accent)]">
            {joinCode}
          </span>
          {expanded ? (
            <ChevronUp size={14} className="text-[var(--muted)]" />
          ) : (
            <ChevronDown size={14} className="text-[var(--muted)]" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4" style={{ animation: "fade-in 0.2s ease-out" }}>
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded">
              <QRCodeSVG
                value={joinUrl}
                size={160}
                level="M"
                fgColor="#1A1815"
                bgColor="#FFFFFF"
              />
            </div>
          </div>

          <p className="text-xs text-center text-[var(--muted)]">
            Scan to join <span className="font-semibold text-[var(--foreground)]">{teamName}</span>
          </p>

          {/* Copy link */}
          <button
            onClick={handleCopy}
            className="btn-ghost w-full text-xs py-2 flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check size={12} className="text-[var(--cooperate)]" />
                Copied!
              </>
            ) : (
              <>
                <Copy size={12} />
                Copy invite link
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
