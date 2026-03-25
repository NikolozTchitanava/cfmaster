import Link from "next/link";
import { redirect } from "next/navigation";

import { BattleArena } from "@/components/BattleArena";
import { FlashNotice } from "@/components/FlashNotice";
import { ADDITIVE_CHIP_LABELS, CRUCIAL_CHIP_LABELS, getRankTier } from "@/lib/battle";
import { getBattleDashboard, getSelectedBattleForUser } from "@/lib/battle-store";
import { getCurrentUser } from "@/lib/session";
import { getSearchParam, withMessage } from "@/lib/utils";

type BattlePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function ChipSelectors({ tags, submitLabel, buttonClass = "button button-primary wide-button" }: { tags: string[]; submitLabel: string; buttonClass?: string }) {
  return (
    <div className="stack-gap">
      <label>
        <span>Crucial chip</span>
        <select name="crucialType" defaultValue="guarantee_tag" required>
          {Object.entries(CRUCIAL_CHIP_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="battle-chip-fields">
        <label>
          <span>Guarantee tag</span>
          <select name="guaranteeTag" defaultValue={tags[0]}>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Ban tag</span>
          <select name="banTag" defaultValue={tags[1] ?? tags[0]}>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Double Ban #1</span>
          <select name="doubleBanOne" defaultValue={tags[2] ?? tags[0]}>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Double Ban #2</span>
          <select name="doubleBanTwo" defaultValue={tags[3] ?? tags[1] ?? tags[0]}>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span>Additive chip</span>
        <select name="additiveType" defaultValue="precision" required>
          {Object.entries(ADDITIVE_CHIP_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <button type="submit" className={buttonClass}>
        {submitLabel}
      </button>
    </div>
  );
}

export default async function BattlePage({ searchParams }: BattlePageProps) {
  const [resolvedSearchParams, user] = await Promise.all([
    searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}),
    getCurrentUser()
  ]);
  if (!user) {
    redirect(withMessage("/", "error", "Log in to enter the battle lobby.", "auth"));
  }
  const selectedBattleId = getSearchParam(resolvedSearchParams.battle);
  let dashboard: Awaited<ReturnType<typeof getBattleDashboard>> = {
    activeBattle: null,
    pendingIncoming: [],
    pendingOutgoing: [],
    recentBattles: [],
    tagOptions: [],
    suggestedOpponents: []
  };
  let selectedBattle = null;
  let lobbyError: string | null = null;

  try {
    dashboard = await getBattleDashboard(user.id);
    selectedBattle = selectedBattleId ? await getSelectedBattleForUser(user.id, selectedBattleId) : dashboard.activeBattle;
  } catch (error) {
    lobbyError = error instanceof Error ? error.message : "Battle lobby is unavailable right now.";
  }

  const tagOptions = dashboard.tagOptions.length ? dashboard.tagOptions : ["dp", "greedy", "implementation", "math"];

  return (
    <main className="page-shell">
      <FlashNotice />

      {selectedBattle ? (
        <BattleArena room={selectedBattle} currentUserId={user.id} />
      ) : (
        <>
          <section className="arena-home-grid">
            <article className="card arena-hero-card battle-lobby-hero">
              <div className="arena-hero-header">
                <div>
                  <p className="eyebrow">Battle Lobby</p>
                  <h1>Queue ranked duels. Draft chips. Take rating.</h1>
                </div>
                <span className="status-pill status-live">Ranked Open</span>
              </div>

              <div className="arena-hero-strip">
                <article className="arena-pulse-card accent-accent">
                  <span>Platform Rating</span>
                  <strong>{user.platformRating}</strong>
                </article>
                <article className="arena-pulse-card accent-sky">
                  <span>Tier</span>
                  <strong>{getRankTier(user.platformRating)}</strong>
                </article>
                <article className="arena-pulse-card accent-success">
                  <span>Wins</span>
                  <strong>{user.battleWins}</strong>
                </article>
                <article className="arena-pulse-card accent-danger">
                  <span>Losses</span>
                  <strong>{user.battleLosses}</strong>
                </article>
              </div>

              <div className="pill-row">
                <span className="pill">Easy → low + 100~200</span>
                <span className="pill">Medium → midpoint</span>
                <span className="pill">Hard → high + 100~200</span>
                <span className="pill">Visible crucial + hidden additive</span>
              </div>

              <div className="hero-actions">
                <Link href="/leaderboards" className="button button-secondary">
                  Open Leaderboard
                </Link>
                <Link href="/profile" className="button button-ghost">
                  Open Profile
                </Link>
              </div>
            </article>

            <aside className="arena-side-column">
              <article className="card arena-side-card">
                <p className="eyebrow">Record</p>
                <div className="queue-pulse-grid">
                  <article className="mini-card queue-pulse-card">
                    <span className="eyebrow">Wins</span>
                    <strong>{user.battleWins}</strong>
                    <small>Closed duels</small>
                  </article>
                  <article className="mini-card queue-pulse-card">
                    <span className="eyebrow">Draws</span>
                    <strong>{user.battleDraws}</strong>
                    <small>Tiebreak exhausted</small>
                  </article>
                  <article className="mini-card queue-pulse-card">
                    <span className="eyebrow">Losses</span>
                    <strong>{user.battleLosses}</strong>
                    <small>Reset and re-queue</small>
                  </article>
                </div>
              </article>
            </aside>
          </section>

          {lobbyError ? <div className="flash flash-error">{lobbyError}</div> : null}
        </>
      )}

      <section className="arena-dashboard-grid battle-lobby-grid">
        <article className="card battle-form-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Challenge Console</p>
              <h2>Draft a ranked duel</h2>
            </div>
          </div>

          <form action="/battle/challenge" method="post" className="stack-form">
            <label>
              <span>Opponent handle or email</span>
              <input list="battle-opponents" name="opponentIdentity" placeholder="friend@example.com or tourist" required />
            </label>

            <datalist id="battle-opponents">
              {dashboard.suggestedOpponents.map((opponent) => (
                <option key={opponent.handle} value={opponent.handle}>
                  {opponent.platformRating} • {opponent.rankTier} • {opponent.countrySummary}
                </option>
              ))}
            </datalist>

            <ChipSelectors tags={tagOptions} submitLabel="Send battle challenge" />
          </form>
        </article>

        <article className="card battle-rules-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Scoring Core</p>
              <h2>Transparent win conditions</h2>
            </div>
          </div>
          <div className="list-column compact-list">
            <div className="list-item">
              <strong>Base scores</strong>
              <span>Easy 500 • Medium 1000 • Hard 1500</span>
            </div>
            <div className="list-item">
              <strong>Wrong attempt weights</strong>
              <span>Easy 12 • Medium 20 • Hard 28</span>
            </div>
            <div className="list-item">
              <strong>Tie-break order</strong>
              <span>Total score → solved count → earlier last accepted → fewer wrong attempts</span>
            </div>
            <div className="list-item">
              <strong>Chip variance rule</strong>
              <span>Pressure Cooker and Double Ban slightly soften rating swings.</span>
            </div>
          </div>

          <div className="battle-chip-fields">
            <article className="mini-card queue-pulse-card">
              <span className="eyebrow">Visible before start</span>
              <strong>Crucial chip</strong>
              <small>Public strategy pressure</small>
            </article>
            <article className="mini-card queue-pulse-card">
              <span className="eyebrow">Reveals later</span>
              <strong>Additive chip</strong>
              <small>Hidden scoring edge</small>
            </article>
          </div>
        </article>
      </section>

      <section className="section-grid battle-columns">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Incoming</p>
              <h2>Lock your response</h2>
            </div>
          </div>

          {dashboard.pendingIncoming.length ? (
            <div className="stack-gap">
              {dashboard.pendingIncoming.map((battle) => (
                <article key={battle.id} className="battle-request-card">
                  <div className="battle-request-head">
                    <div>
                      <span className="friend-label">Incoming</span>
                      <h3>{battle.opponentHandle}</h3>
                    </div>
                    <span className="friend-rating">{battle.opponentRating}</span>
                  </div>
                  <p className="muted-copy">
                    {battle.opponentTier} • {battle.createdAtLabel}
                  </p>
                  <div className="pill-row">
                    {battle.visibleCrucialChips.map((chip) => (
                      <span className="pill" key={chip}>
                        {chip}
                      </span>
                    ))}
                  </div>

                  <form action="/battle/respond" method="post" className="stack-form">
                    <input type="hidden" name="battleId" value={battle.id} />
                    <ChipSelectors tags={tagOptions} submitLabel="Accept and start battle" />
                  </form>

                  <form action="/battle/respond" method="post">
                    <input type="hidden" name="battleId" value={battle.id} />
                    <input type="hidden" name="decision" value="decline" />
                    <button type="submit" className="button button-secondary">
                      Decline
                    </button>
                  </form>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-plate">No incoming battle requests right now.</div>
          )}
        </article>

        <article className="card" id="history">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Queue + History</p>
              <h2>Outgoing and recent duels</h2>
            </div>
          </div>

          <div className="stack-gap">
            {dashboard.pendingOutgoing.length ? (
              dashboard.pendingOutgoing.map((battle) => (
                <article key={battle.id} className="battle-request-card">
                  <div className="battle-request-head">
                    <div>
                      <span className="friend-label">Outgoing</span>
                      <h3>{battle.opponentHandle}</h3>
                    </div>
                    <span className="friend-rating">{battle.opponentRating}</span>
                  </div>
                  <p className="muted-copy">
                    {battle.opponentTier} • {battle.createdAtLabel}
                  </p>
                  <div className="pill-row">
                    {battle.visibleCrucialChips.map((chip) => (
                      <span className="pill" key={chip}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-plate">No outgoing challenges waiting for a response.</div>
            )}

            <div className="section-heading">
              <div>
                <p className="eyebrow">Recent finished battles</p>
                <h2>Recent scorelines</h2>
              </div>
            </div>

            {dashboard.recentBattles.length ? (
              dashboard.recentBattles.map((battle) => (
                <Link href={battle.href} key={battle.id} className="friend-card">
                  <div className="friend-card-head">
                    <div>
                      <span className="friend-label">{battle.status}</span>
                      <h3>{battle.opponentHandle}</h3>
                    </div>
                    <span className="friend-rating">{battle.scoreline}</span>
                  </div>
                  <small>{battle.startedAt ? `Started ${new Date(battle.startedAt).toLocaleString()}` : "Finished battle"}</small>
                </Link>
              ))
            ) : (
              <div className="empty-plate">No finished battles yet. Start the first one from the panel on the left.</div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
