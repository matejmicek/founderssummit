"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function JoinTeamPage() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(true);

  useEffect(() => {
    if (!code) return;

    fetch("/api/auth/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamCode: code.toUpperCase() }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to join");
        router.push(`/team/${data.team.join_code}`);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to join team");
        setJoining(false);
      });
  }, [code, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">
          Agent <span className="text-[var(--accent)]">Arena</span>
        </h1>

        {joining && !error && (
          <div className="mt-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
            <p className="text-[var(--muted)] text-sm font-mono mt-3">
              Joining team...
            </p>
          </div>
        )}

        {error && (
          <div className="mt-8 space-y-4">
            <p className="text-[var(--betray)] text-sm">{error}</p>
            <button
              onClick={() => router.push("/")}
              className="btn-ghost text-sm"
            >
              Go to Home
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
