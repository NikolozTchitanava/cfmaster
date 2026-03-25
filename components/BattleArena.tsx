"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ADDITIVE_CHIP_LABELS, CRUCIAL_CHIP_LABELS, getRankTier } from "@/lib/battle";
import type { BattleParticipantState, BattleRoom } from "@/lib/types";

type BattleArenaProps = {
  room: BattleRoom;
  currentUserId: string;
};

function formatCountdown(value: number): string {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;

  return [hours, minutes, seconds].map((part) => part.toString().padStart(2, "0")).join(":");
}

function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function participantCountry(participant: BattleParticipantState): string {
  if (participant.country && participant.continent) {
    return `${participant.country} • ${participant.continent}`;
  }

  return participant.country || participant.continent || "Country not set";
}

export function BattleArena({ room, currentUserId }: BattleArenaProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [selectedProblemKey, setSelectedProblemKey] = useState(() => room.problems[0]?.problemKey ?? "");

  useEffect(() => {
    if (!room.problems.some((problem) => problem.problemKey === selectedProblemKey)) {
      setSelectedProblemKey(room.problems[0]?.problemKey ?? "");
    }
  }, [room.problems, selectedProblemKey]);

  useEffect(() => {
    if (room.status !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    const refresher = window.setInterval(() => {
      startTransition(() => {
        router.refresh();
      });
    }, 20000);

    return () => {
      window.clearInterval(timer);
      window.clearInterval(refresher);
    };
  }, [room.status, router]);

  const me = useMemo(() => room.participants.find((participant) => participant.userId === currentUserId) ?? room.participants[0], [currentUserId, room.participants]);
  const opponent = useMemo(
    () => room.participants.find((participant) => participant.userId !== currentUserId) ?? room.participants[1],
    [currentUserId, room.participants]
  );
  const myScore = room.scores[me.userId];
  const opponentScore = room.scores[opponent.userId];
  const remainingSeconds = room.endsAt ? Math.max(0, Math.floor((new Date(room.endsAt).getTime() - now) / 1000)) : 0;
  const selectedProblem = room.problems.find((problem) => problem.problemKey === selectedProblemKey) ?? room.problems[0];
  const myBreakdown = selectedProblem ? myScore.breakdown.find((entry) => entry.problemKey === selectedProblem.problemKey) : null;
  const opponentBreakdown = selectedProblem ? opponentScore.breakdown.find((entry) => entry.problemKey === selectedProblem.problemKey) : null;
  const myAccepted = typeof myBreakdown?.acceptedMinute === "number";
  const urgent = room.status === "active" && remainingSeconds <= 600;

  return (
    <section className="battle-space">
      <div className="arena-score-ribbon">
        <div className="battle-topline">
          <div>
            <p className="eyebrow">Live Duel</p>
            <h1>Battle Arena</h1>
            <div className="pill-row">
              <span className="pill">3 problem slots</span>
              <span className="pill">Visible chips</span>
              <span className="pill">Transparent scoring</span>
            </div>
          </div>
          <div className={`battle-timer-card${room.status === "finished" ? " is-finished" : ""}${urgent ? " is-urgent" : ""}`}>
            <span>Match Timer</span>
            <strong>{room.status === "active" ? formatCountdown(remainingSeconds) : room.status === "finished" ? "Battle Ended" : "Waiting"}</strong>
            <small>{isPending ? "Syncing live battle state..." : urgent ? "Final phase. Pressure is rising." : "Live refresh running during battle."}</small>
          </div>
        </div>

        <div className="arena-score-rack">
          {[me, opponent].map((participant) => {
            const score = room.scores[participant.userId];
            const isCurrent = participant.userId === currentUserId;
            const solvedProblems = score.breakdown.filter((entry) => typeof entry.acceptedMinute === "number").length;

            return (
              <article key={participant.userId} className={`battle-competitor arena-score-card${isCurrent ? " is-current" : ""}`}>
                <div className="battle-competitor-head">
                  <div>
                    <span className="friend-label">{isCurrent ? "You" : "Opponent"}</span>
                    <h2>{participant.handle}</h2>
                    <p className="muted-copy">{participantCountry(participant)}</p>
                  </div>
                  <div className="battle-rating-pill">
                    <strong>{participant.platformRating}</strong>
                    <span>{getRankTier(participant.platformRating)}</span>
                  </div>
                </div>
                <div className="battle-score-metrics">
                  <div>
                    <span>Score</span>
                    <strong>{formatScore(score.totalScore)}</strong>
                  </div>
                  <div>
                    <span>Solved</span>
                    <strong>{solvedProblems}/3</strong>
                  </div>
                  <div>
                    <span>WA</span>
                    <strong>{score.wrongAttempts}</strong>
                  </div>
                  <div>
                    <span>Bonus</span>
                    <strong>{score.bonusMultiplier.toFixed(2)}x</strong>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="arena-battle-layout">
        <aside className="battle-lane battle-lane-problems">
          <article className="card battle-side-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Problem Rail</p>
                <h2>Choose your lane</h2>
              </div>
            </div>

            <div className="problem-tab-list">
              {room.problems.map((problem) => {
                const breakdown = myScore.breakdown.find((entry) => entry.problemKey === problem.problemKey);
                return (
                  <button
                    key={problem.problemKey}
                    type="button"
                    className={`problem-tab-card${problem.problemKey === selectedProblem.problemKey ? " is-active" : ""}`}
                    onClick={() => setSelectedProblemKey(problem.problemKey)}
                  >
                    <span className={`difficulty-pill difficulty-${problem.slot}`}>{problem.targetLabel}</span>
                    <strong>{problem.name}</strong>
                    <small>
                      {typeof breakdown?.acceptedMinute === "number"
                        ? `Solved at ${breakdown.acceptedMinute}m`
                        : `${breakdown?.wrongAttempts ?? 0} WA • ${formatScore(breakdown?.potentialScoreNow ?? 0)} now`}
                    </small>
                  </button>
                );
              })}
            </div>
          </article>

          {selectedProblem ? (
            <article className="card battle-problem-card battle-problem-intel">
              <div className="battle-problem-head">
                <div>
                  <span className={`difficulty-pill difficulty-${selectedProblem.slot}`}>{selectedProblem.targetLabel}</span>
                  <h3>{selectedProblem.name}</h3>
                </div>
                <span className="task-rating">{selectedProblem.rating}</span>
              </div>
              <div className="problem-intel-grid">
                <div className="mini-stat-card">
                  <span>Target band</span>
                  <strong>
                    {selectedProblem.targetMin} - {selectedProblem.targetMax}
                  </strong>
                </div>
                <div className="mini-stat-card">
                  <span>Your score now</span>
                  <strong>{formatScore(myBreakdown?.potentialScoreNow ?? myBreakdown?.score ?? 0)}</strong>
                </div>
              </div>
              <div className="pill-row">
                {selectedProblem.tags.length ? (
                  selectedProblem.tags.map((tag) => (
                    <span className="pill" key={tag}>
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="pill">No tags listed</span>
                )}
              </div>
            </article>
          ) : null}
        </aside>

        <section className="battle-lane battle-lane-editor">
          {selectedProblem ? (
            <article className="card editor-shell">
              <div className="editor-topbar">
                <div>
                  <span className="eyebrow">Code Editor</span>
                  <strong>{selectedProblem.name}</strong>
                </div>
                <div className="editor-status-pills">
                  <span className="status-pill">{myAccepted ? "Accepted" : "In Progress"}</span>
                  <span className="status-pill">{myBreakdown?.wrongAttempts ?? 0} WA</span>
                </div>
              </div>

              <div className="editor-window">
                <div className="editor-gutter">
                  {Array.from({ length: 10 }, (_, index) => (
                    <span key={index}>{index + 1}</span>
                  ))}
                </div>
                <div className="editor-code">
                  <span className="editor-comment">// Arena editor is a focus shell for the current duel.</span>
                  <span>solve({selectedProblem.index})</span>
                  <span>  .withPrecision({myBreakdown?.wrongAttempts ?? 0})</span>
                  <span>  .raceAgainst(&quot;{opponent.handle}&quot;);</span>
                  <span className="editor-muted">// Open the original problem, submit on Codeforces, then lock result here.</span>
                </div>
              </div>

              <div className="battle-problem-actions editor-actions">
                <a href={selectedProblem.link} target="_blank" rel="noreferrer" className="button button-secondary">
                  Open Statement
                </a>

                {room.status === "active" ? (
                  <div className="battle-action-buttons">
                    <form action="/battle/wa" method="post">
                      <input type="hidden" name="battleId" value={room.id} />
                      <input type="hidden" name="problemKey" value={selectedProblem.problemKey} />
                      <button type="submit" className="button button-ghost" disabled={myAccepted}>
                        Record WA
                      </button>
                    </form>
                    <form action="/battle/solve" method="post">
                      <input type="hidden" name="battleId" value={room.id} />
                      <input type="hidden" name="problemKey" value={selectedProblem.problemKey} />
                      <button type="submit" className="button button-primary" disabled={myAccepted}>
                        Mark Accepted
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className="status-pill is-done">Battle locked</span>
                )}
              </div>
            </article>
          ) : null}

          {selectedProblem ? (
            <div className="submission-panel-grid">
              <article className="mini-card submission-signal-card">
                <span className="eyebrow">Your Pressure</span>
                <strong>{myAccepted ? `${formatScore(myBreakdown?.score ?? 0)} pts locked` : `${formatScore(myBreakdown?.potentialScoreNow ?? 0)} pts if solved now`}</strong>
                <small>
                  WA {myBreakdown?.wrongAttempts ?? 0}
                  {" • "}
                  {myAccepted ? `Accepted at ${myBreakdown?.acceptedMinute}m` : "Penalty preview live"}
                </small>
              </article>
              <article className="mini-card submission-signal-card opponent">
                <span className="eyebrow">{opponent.handle}</span>
                <strong>
                  {typeof opponentBreakdown?.acceptedMinute === "number"
                    ? `${formatScore(opponentBreakdown.score)} pts locked`
                    : `${formatScore(opponentBreakdown?.potentialScoreNow ?? 0)} pts if solved now`}
                </strong>
                <small>
                  WA {opponentBreakdown?.wrongAttempts ?? 0}
                  {" • "}
                  {typeof opponentBreakdown?.acceptedMinute === "number" ? `Accepted at ${opponentBreakdown.acceptedMinute}m` : "Still contesting"}
                </small>
              </article>
            </div>
          ) : null}

          {room.status === "finished" ? (
            <div className="battle-end-card">
              <p className="eyebrow">Battle Result</p>
              <h2>{room.resultLabel}</h2>
              <p className="muted-copy">{room.resultReason ? `Decided by ${room.resultReason}.` : "Final review complete."}</p>
              <div className="battle-end-grid">
                {[me, opponent].map((participant) => {
                  const score = room.scores[participant.userId];
                  return (
                    <article key={participant.userId} className="battle-end-column">
                      <h3>{participant.handle}</h3>
                      <p>
                        Score {formatScore(score.totalScore)} • Solved {score.solvedCount} • WA {score.wrongAttempts}
                      </p>
                      <strong>
                        Rating {participant.platformRating}
                        {participant.ratingDelta ? ` ${participant.ratingDelta >= 0 ? "+" : ""}${participant.ratingDelta}` : " +0"}
                        {" → "}
                        {participant.ratingAfter ?? participant.platformRating}
                      </strong>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="battle-lane battle-lane-opponent">
          <article className="card battle-side-panel battle-presence-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Opponent Status</p>
                <h2>{opponent.handle}</h2>
              </div>
            </div>
            <div className="presence-indicator">
              <span className={`signal-dot${room.status === "active" ? " is-live" : ""}`} />
              <div>
                <strong>{room.status === "active" ? "Solving live" : "Battle archived"}</strong>
                <small>{room.status === "active" ? "Typing indicator active. Watch the score bar and timer." : "Results locked for review."}</small>
              </div>
            </div>

            <div className="battle-chip-stack">
              {[me, opponent].map((participant) => (
                <div className="battle-chip-block" key={participant.userId}>
                  <span className="eyebrow">{participant.userId === currentUserId ? "Your loadout" : "Opponent loadout"}</span>
                  <strong>{CRUCIAL_CHIP_LABELS[participant.crucialChip.type]}</strong>
                  {"tag" in participant.crucialChip && participant.crucialChip.tag ? <small>{participant.crucialChip.tag}</small> : null}
                  {"tags" in participant.crucialChip && participant.crucialChip.tags?.length ? (
                    <small>{participant.crucialChip.tags.join(", ")}</small>
                  ) : null}
                  <div className="chip-subline">
                    <span>Additive</span>
                    <strong>
                      {participant.userId === currentUserId || participant.additiveRevealed || room.status === "finished"
                        ? ADDITIVE_CHIP_LABELS[participant.additiveChip.type]
                        : "Hidden"}
                    </strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="list-column compact-list">
              <div className="list-item">
                <strong>Result priority</strong>
                <span>Score → solves → speed → WA</span>
              </div>
              <div className="list-item">
                <strong>Your live edge</strong>
                <span>{myScore.totalScore >= opponentScore.totalScore ? "You lead on points" : "Opponent leads on points"}</span>
              </div>
              <div className="list-item">
                <strong>Pressure note</strong>
                <span>{urgent ? "Final 10 minutes. Every WA matters." : "Use chip math and timing to control the duel."}</span>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
