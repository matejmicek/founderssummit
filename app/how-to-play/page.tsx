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

        {/* The Dilemma */}
        <section className="card p-5 space-y-3">
          <h2 className="text-lg font-extrabold">The Game</h2>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            You and another team face a simple choice: <strong className="text-[var(--cooperate)]">COOPERATE</strong> or <strong className="text-[var(--betray)]">BETRAY</strong>.
            You choose at the same time. Neither team knows what the other picked until both decisions are locked in.
          </p>

          {/* Payoff matrix */}
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
                    <span className="text-[10px] text-[var(--muted)]">everybody wins</span>
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
                    <span className="text-[10px] text-[var(--muted)]">everybody loses</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* The Catch */}
        <section className="card p-5 space-y-3 border-l-[3px] border-l-[var(--accent)]">
          <h2 className="text-lg font-extrabold">The Catch</h2>
          <p className="text-sm text-[var(--foreground-secondary)] leading-relaxed">
            <strong>There is no single winning strategy.</strong> This is not a puzzle with a correct answer.
          </p>
          <ul className="text-sm text-[var(--foreground-secondary)] space-y-2 leading-relaxed">
            <li>
              <strong className="text-[var(--cooperate)]">Always cooperate?</strong> You get the best collective outcome, but anyone who betrays you scores +5 while you get nothing.
            </li>
            <li>
              <strong className="text-[var(--betray)]">Always betray?</strong> You can steal big wins, but when two betrayers meet, you both get the worst score (+1).
            </li>
            <li>
              <strong>Mirror the opponent?</strong> Works well on average, but one mistake spirals into endless revenge.
            </li>
          </ul>
          <p className="text-sm font-bold text-[var(--foreground)]">
            Whether you should cooperate or betray depends entirely on what the other team does. And you don&apos;t know what they&apos;ll do.
          </p>
        </section>

        {/* How It Works */}
        <section className="card p-5 space-y-4">
          <h2 className="text-lg font-extrabold">How Agent Arena Works</h2>

          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">1</div>
              <div>
                <p className="text-sm font-bold">Create your AI agent</p>
                <p className="text-xs text-[var(--muted)]">Write a personality for your agent. It will negotiate on your behalf — bluffing, threatening, or building trust with the opponent&apos;s agent.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">2</div>
              <div>
                <p className="text-sm font-bold">Watch them talk</p>
                <p className="text-xs text-[var(--muted)]">Your agent and the opponent&apos;s agent have a conversation. Read it carefully — what are they saying? Can you trust it?</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">3</div>
              <div>
                <p className="text-sm font-bold">You decide</p>
                <p className="text-xs text-[var(--muted)]">After the negotiation, your team has 20 seconds to click COOPERATE or BETRAY. The agents talk — but humans decide.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs">4</div>
              <div>
                <p className="text-sm font-bold">Simultaneous reveal</p>
                <p className="text-xs text-[var(--muted)]">Both decisions are revealed at the same time. Scores update. Then you do it again — 3 turns per match, 2 opponents per round.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Rounds */}
        <section className="card p-5 space-y-3">
          <h2 className="text-lg font-extrabold">The Twist: Escalating Rounds</h2>
          <p className="text-xs text-[var(--muted)]">Each round introduces a new mechanic. The game changes under your feet.</p>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--background-alt)]">
              <span className="font-mono font-bold text-[var(--accent)] w-8">R1</span>
              <span className="font-bold">First Contact</span>
              <span className="text-xs text-[var(--muted)] ml-auto">Pure instinct. No history.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--background-alt)]">
              <span className="font-mono font-bold text-[var(--accent)] w-8">R2</span>
              <span className="font-bold">Memory</span>
              <span className="text-xs text-[var(--muted)] ml-auto">Agents remember past betrayals.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--background-alt)]">
              <span className="font-mono font-bold text-[var(--accent)] w-8">R3</span>
              <span className="font-bold">Secret Weapon</span>
              <span className="text-xs text-[var(--muted)] ml-auto">Unlock a hidden tactic.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--background-alt)]">
              <span className="font-mono font-bold text-[var(--accent)] w-8">R4</span>
              <span className="font-bold">Noise</span>
              <span className="text-xs text-[var(--muted)] ml-auto">15% chance your decision gets flipped.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-[var(--background-alt)]">
              <span className="font-mono font-bold text-[var(--accent)] w-8">R5</span>
              <span className="font-bold">Endgame</span>
              <span className="text-xs text-[var(--muted)] ml-auto">2x points. Bottom teams eliminated.</span>
            </div>
          </div>
        </section>

        {/* Tips */}
        <section className="card p-5 space-y-3 border-l-[3px] border-l-[var(--betray)]">
          <h2 className="text-lg font-extrabold">Tips</h2>
          <ul className="text-sm text-[var(--foreground-secondary)] space-y-1.5 leading-relaxed">
            <li>Read what the agents are saying. Your agent&apos;s promises don&apos;t bind you — and theirs don&apos;t bind them.</li>
            <li>A team that cooperated last turn might betray this turn. People change.</li>
            <li>The leaderboard rewards total points across all matches. Consistency matters more than one big heist.</li>
            <li>When in doubt, ask yourself: what would the other team expect me to do?</li>
          </ul>
        </section>

        <p className="text-center text-xs text-[var(--muted)] font-mono pb-8">
          Based on the Prisoner&apos;s Dilemma, a game theory concept from 1950.
        </p>
      </div>
    </div>
  );
}
