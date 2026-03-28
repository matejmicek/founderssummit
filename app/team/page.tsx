"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Legacy /team route — redirects to /team/[code] based on cookie
export default function TeamRedirect() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    // Try to get team info from cookie and redirect to /team/[code]
    fetch("/api/team/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.team?.join_code) {
          router.replace(`/team/${data.team.join_code}`);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        setError(true);
      });
  }, [router]);

  if (error) {
    // No cookie — send to home
    router.replace("/");
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
        <p className="text-[var(--muted)] text-sm font-mono mt-3">Loading...</p>
      </div>
    </div>
  );
}
