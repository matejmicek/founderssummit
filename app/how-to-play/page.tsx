export default function HowToPlay() {
  return (
    <div className="min-h-screen flex justify-center px-4 py-8">
      <div className="max-w-xl w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight">
            Agent <span className="text-[var(--accent)]">Arena</span>
          </h1>
          <p className="text-[var(--muted)] text-sm mt-1 font-mono">How to play</p>
        </div>

        {/* 1. What is the Prisoner's Dilemma */}
        <section className="card p-5 space-y-3">
          <h2 className="text-lg font-extrabold">The Prisoner&apos;s Dilemma</h2>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            Two people are arrested for the same crime and put in separate rooms. Each has two choices: stay silent (cooperate with each other) or snitch (betray the other). The catch? You make your choice without knowing what the other person picked.
          </p>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            If you both stay silent, you both get a light sentence. If you both snitch, you both get a harsh sentence. But if only one of you snitches, that person walks free while the other gets the worst sentence possible.
          </p>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            This is one of the most studied problems in game theory. It shows up everywhere — in business negotiations, international politics, even evolution. The question it asks is simple: <strong>can you trust the other side?</strong>
          </p>
        </section>

        {/* 2. The Payoff Matrix */}
        <section className="card p-5 space-y-3">
          <h2 className="text-lg font-extrabold">The Scoring</h2>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            In our version, each turn you pick <strong className="text-[var(--cooperate)]">COOPERATE</strong> or <strong className="text-[var(--betray)]">BETRAY</strong>. Both teams reveal at the same time. Here&apos;s how points work:
          </p>

          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--background-alt)]">
                  <th className="p-3 text-left font-mono text-xs text-[var(--muted)]"></th>
                  <th className="p-3 text-center font-mono text-xs">They Cooperate</th>
                  <th className="p-3 text-center font-mono text-xs">They Betray</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--border)]">
                  <td className="p-3 font-bold text-xs">You Cooperate</td>
                  <td className="p-3 text-center bg-[var(--cooperate-bg)]">
                    <span className="font-extrabold text-[var(--cooperate)]">+3 / +3</span>
                    <br />
                    <span className="text-[10px] text-[var(--muted)]">best collective outcome</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className="font-extrabold text-[var(--betray)]">+0 / +5</span>
                    <br />
                    <span className="text-[10px] text-[var(--muted)]">you get burned</span>
                  </td>
                </tr>
                <tr className="border-t border-[var(--border)]">
                  <td className="p-3 font-bold text-xs">You Betray</td>
                  <td className="p-3 text-center">
                    <span className="font-extrabold text-[var(--betray)]">+5 / +0</span>
                    <br />
                    <span className="text-[10px] text-[var(--muted)]">you burn them</span>
                  </td>
                  <td className="p-3 text-center bg-[var(--background-alt)]">
                    <span className="font-extrabold text-[var(--muted)]">+1 / +1</span>
                    <br />
                    <span className="text-[10px] text-[var(--muted)]">worst for both</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. What happens at the extremes */}
        <section className="card p-5 space-y-3 border-l-[3px] border-l-[var(--accent)]">
          <h2 className="text-lg font-extrabold">Why It&apos;s a Dilemma</h2>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            <strong className="text-[var(--cooperate)]">If everybody cooperates</strong> — the whole room scores +3 per turn. That&apos;s the maximum total. Everyone wins. Sounds easy, right?
          </p>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            <strong className="text-[var(--betray)]">If everybody betrays</strong> — everyone scores +1 per turn. The minimum. Nobody gets ahead and everyone suffers. This is the trap: when trust collapses, everyone loses.
          </p>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            The temptation is to betray — because if the other team cooperates while you betray, you get <strong>+5</strong> and they get <strong>nothing</strong>. But if they&apos;re thinking the same thing, you both end up with +1. Worse than if you&apos;d both just cooperated.
          </p>
          <p className="text-sm font-bold text-[var(--foreground)]">
            There is no &quot;correct&quot; strategy. The best move depends entirely on what the other team does — and you don&apos;t know until it&apos;s too late.
          </p>
        </section>

        {/* 4. How Agent Arena works */}
        <section className="card p-5 space-y-4">
          <h2 className="text-lg font-extrabold">How Agent Arena Works</h2>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            Agent Arena adds a twist to the classic dilemma: <strong>AI agents negotiate on your behalf</strong> before you make your decision.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">1</div>
              <div>
                <p className="text-sm font-bold">Form a team and create your AI agent</p>
                <p className="text-xs text-[var(--muted)]">Your team writes a personality for an AI agent. This defines how it talks — is it friendly? Aggressive? Manipulative? The agent negotiates on your behalf, but it doesn&apos;t make the final call.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">2</div>
              <div>
                <p className="text-sm font-bold">Watch the agents negotiate</p>
                <p className="text-xs text-[var(--muted)]">Before each decision, your agent and the opponent&apos;s agent have a short conversation. They might promise cooperation, threaten revenge, or try to bluff. Read carefully — but remember, what the agent says and what the team does can be two very different things.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">3</div>
              <div>
                <p className="text-sm font-bold">Your team decides: cooperate or betray</p>
                <p className="text-xs text-[var(--muted)]">After the negotiation, your team clicks COOPERATE or BETRAY. The agents talk, but humans decide. This is where the real game happens — discuss with your teammates, read the opponent, make the call.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">4</div>
              <div>
                <p className="text-sm font-bold">Both decisions revealed simultaneously</p>
                <p className="text-xs text-[var(--muted)]">A countdown, then both decisions flip at the same time. Scores update. You play 3 turns per match, and face 2 different opponents each round.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Game flow — seasons and rounds */}
        <section className="card p-5 space-y-4">
          <h2 className="text-lg font-extrabold">Game Flow</h2>

          <div className="space-y-3 text-sm text-[var(--foreground-secondary)] leading-relaxed">
            <p>
              The game is organized into <strong>seasons</strong>. Each season has multiple <strong>rounds</strong>. Here&apos;s how a typical session plays out:
            </p>

            <div className="space-y-2">
              <div className="flex gap-3 items-start p-3 rounded bg-[var(--background-alt)]">
                <span className="font-mono font-bold text-[var(--accent)] shrink-0">Setup</span>
                <span>Teams join the tournament, pick a name, and write their agent&apos;s personality. Everyone marks &quot;ready&quot; when done.</span>
              </div>
              <div className="flex gap-3 items-start p-3 rounded bg-[var(--background-alt)]">
                <span className="font-mono font-bold text-[var(--accent)] shrink-0">Round</span>
                <span>The host starts a round. You&apos;re paired with 2 opponents. For each opponent: agents negotiate 3 turns, and you decide cooperate/betray each turn. That&apos;s 6 decisions per round.</span>
              </div>
              <div className="flex gap-3 items-start p-3 rounded bg-[var(--background-alt)]">
                <span className="font-mono font-bold text-[var(--accent)] shrink-0">Review</span>
                <span>After the round, everyone sees the results: highlights of the most dramatic matches, updated leaderboard, and your head-to-head record.</span>
              </div>
              <div className="flex gap-3 items-start p-3 rounded bg-[var(--background-alt)]">
                <span className="font-mono font-bold text-[var(--accent)] shrink-0">Repeat</span>
                <span>Between rounds you can tweak your agent&apos;s personality based on what you learned. Then a new round starts with new pairings. The game evolves as players adapt.</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest font-mono">Escalating rounds</p>
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--background-alt)]">
              <span className="font-mono font-bold text-[var(--accent)] w-8">R1</span>
              <span className="font-bold">First Contact</span>
              <span className="text-xs text-[var(--muted)] ml-auto">No history. Pure instinct.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--background-alt)]">
              <span className="font-mono font-bold text-[var(--accent)] w-8">R2</span>
              <span className="font-bold">Memory</span>
              <span className="text-xs text-[var(--muted)] ml-auto">Agents remember what happened last round.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--background-alt)]">
              <span className="font-mono font-bold text-[var(--accent)] w-8">R3</span>
              <span className="font-bold">High Stakes</span>
              <span className="text-xs text-[var(--muted)] ml-auto">All points doubled.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--background-alt)]">
              <span className="font-mono font-bold text-[var(--accent)] w-8">R4</span>
              <span className="font-bold">Endgame</span>
              <span className="text-xs text-[var(--muted)] ml-auto">Points doubled. Bottom teams eliminated.</span>
            </div>
          </div>
        </section>

        {/* 6. What happens — the outcome */}
        <section className="card p-5 space-y-3 border-l-[3px] border-l-[var(--betray)]">
          <h2 className="text-lg font-extrabold">How You Win</h2>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            Your total score across all matches determines your rank on the leaderboard. The team with the most points at the end of the season wins.
          </p>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            But here&apos;s what makes it interesting: consistently cooperating with trustworthy partners racks up +3 per turn. One big betrayal gives you +5 once, but burns a bridge — that team will remember, and so will their agent.
          </p>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            The best players aren&apos;t the ones who betray the most or cooperate blindly. They&apos;re the ones who <strong>read the room</strong> — who can be trusted, who can&apos;t, and when it&apos;s worth taking the risk.
          </p>
        </section>

        <p className="text-center text-xs text-[var(--muted)] font-mono pb-8">
          Based on the Prisoner&apos;s Dilemma — a game theory concept studied since 1950.
        </p>
      </div>
    </div>
  );
}
