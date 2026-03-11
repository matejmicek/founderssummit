"use client";

import { useState } from "react";
import AdminControls from "@/components/AdminControls";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full">
          <h1 className="text-2xl font-bold mb-4 text-center">Admin Panel</h1>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (secret.trim()) setAuthenticated(true);
            }}
            className="space-y-3"
          >
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Admin secret"
              className="w-full bg-[var(--card)] border border-[var(--card-border)] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white font-medium rounded-lg text-sm transition-colors"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          Agent Arena <span className="text-[var(--muted)] text-sm font-normal">Admin</span>
        </h1>
        <div className="flex gap-2 text-xs">
          <a href="/spectate" className="text-[var(--muted)] hover:text-white">
            Spectate
          </a>
          <a href="/" className="text-[var(--muted)] hover:text-white">
            Home
          </a>
        </div>
      </div>

      <AdminControls adminSecret={secret} />
    </div>
  );
}
