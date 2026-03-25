import Link from "next/link";

import { BattleArena } from "@/components/BattleArena";
import { FlashNotice } from "@/components/FlashNotice";
import { ADDITIVE_CHIP_LABELS, CRUCIAL_CHIP_LABELS } from "@/lib/battle";
import { getBattleDashboard, getSelectedBattleForUser } from "@/lib/battle-store";
import { getCurrentUser } from "@/lib/session";
import { getSearchParam, withMessage } from "@/lib/utils";
import { redirect } from "next/navigation";

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
  const dashboard = await getBattleDashboard(user.id);
  const selectedBattle = selectedBattleId ? await getSelectedBattleForUser(user.id, selectedBattleId) : dashboard.activeBattle;
  const tagOptions = dashboard.tagOptions.length ? dashboard.tagOptions : ["dp", "greedy", "implementation", "math"];

  return (
    <main className="page-shell">
      <FlashNotice />

      {selectedBattle ? (
        <BattleArena room={selectedBattle} currentUserId={user.id} />
      ) : (
        <section className="hero-grid card">
          <div className="hero-copy">
            <p className="eyebrow">Battle lobby</p>
            <h1>Esports-ready 1v1 battles with visible strategy and transparent scoring.</h1>
            <p className="lead">
              Every duel runs for 60 minutes with 3 rating-aware problems, Codeforces-style penalty scoring, visible crucial chips, hidden additive chips, and platform rating on the line.
            </p>

            <div className="pill-row">
              <span className="pill">Easy: low + 100~200</span>
              <span className="pill">Medium: midpoint target</span>
              <span className="pill">Hard: high + 100~200</span>
              <span className="pill">Winner by score, solves, speed, then WA</span>
            </div>

            <div className="hero-actions">
              <Link href="/leaderboards" className="button button-secondary">
                Open leaderboards
              </Link>
            </div>
          </div>

          <div className="hero-side stack-gap">
            <article className="mini-card spotlight-card">
              <span className="eyebrow">Platform rating</span>
              <strong>
                {user.platformRating} • {user.handle}
              </strong>
            </article>
            <article className="mini-card">
              <span className="eyebrow">Battle record</span>
              <p>
                {user.battleWins} wins • {user.battleLosses} losses • {user.battleDraws} draws
              </p>
            </article>
          </div>
        </section>
      )}

      <section className="section-grid">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Create battle</p>
              <h2>Challenge a registered player</h2>
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

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Rules snapshot</p>
              <h2>Scoring and tie-breaks</h2>
            </div>
          </div>
          <div className="list-column">
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
        </article>
      </section>

      <section className="section-grid battle-columns">
        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Incoming challenges</p>
              <h2>Lock in your chips</h2>
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

        <article className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Queue status</p>
              <h2>Outgoing + recent</h2>
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
