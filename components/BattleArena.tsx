"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ADDITIVE_CHIP_LABELS, CRUCIAL_CHIP_LABELS, getRankTier } from "@/lib/battle";
import type { BattleParticipantState, BattleRoom, StoredUser } from "@/lib/types";

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

  return (
    <section className="battle-space stack-gap">
      <div className="battle-topline">
        <div>
          <p className="eyebrow">Competitive 1v1</p>
          <h1>Battle arena</h1>
          <p className="lead">
            Rating-aware 3-problem duel with visible crucial chips, hidden additive chips, Codeforces-style penalties, and platform rating stakes.
          </p>
        </div>
        <div className={`battle-timer-card${room.status === "finished" ? " is-finished" : ""}`}>
          <span>Countdown</span>
          <strong>{room.status === "active" ? formatCountdown(remainingSeconds) : room.status === "finished" ? "Battle ended" : "Waiting"}</strong>
          <small>{isPending ? "Refreshing live state…" : "Auto-refreshing while the battle is live."}</small>
        </div>
      </div>

      <div className="battle-score-grid">
        {[me, opponent].map((participant) => {
          const score = room.scores[participant.userId];
          const isCurrent = participant.userId === currentUserId;
          return (
            <article key={participant.userId} className={`battle-competitor${isCurrent ? " is-current" : ""}`}>
              <div className="battle-competitor-head">
                <div>
                  <span className="friend-label">{isCurrent ? "You" : "Opponent"}</span>
                  <h2>{participant.handle}</h2>
                </div>
                <div className="battle-rating-pill">
                  <strong>{participant.platformRating}</strong>
                  <span>{getRankTier(participant.platformRating)}</span>
                </div>
              </div>
              <p className="muted-copy">{participantCountry(participant)}</p>
              <div className="battle-score-metrics">
                <div>
                  <span>Total score</span>
                  <strong>{formatScore(score.totalScore)}</strong>
                </div>
                <div>
                  <span>Solved</span>
                  <strong>{score.solvedCount}/3</strong>
                </div>
                <div>
                  <span>Wrong attempts</span>
                  <strong>{score.wrongAttempts}</strong>
                </div>
                <div>
                  <span>Bonus</span>
                  <strong>{score.bonusMultiplier.toFixed(2)}x</strong>
                </div>
              </div>
              <div className="battle-chip-stack">
                <div className="battle-chip-block">
                  <span className="eyebrow">Crucial chip</span>
                  <strong>{CRUCIAL_CHIP_LABELS[participant.crucialChip.type]}</strong>
                  {"tag" in participant.crucialChip && participant.crucialChip.tag ? <small>{participant.crucialChip.tag}</small> : null}
                  {"tags" in participant.crucialChip && participant.crucialChip.tags?.length ? (
                    <small>{participant.crucialChip.tags.join(", ")}</small>
                  ) : null}
                </div>
                <div className="battle-chip-block">
                  <span className="eyebrow">Additive chip</span>
                  <strong>
                    {participant.userId === currentUserId || participant.additiveRevealed || room.status === "finished"
                      ? ADDITIVE_CHIP_LABELS[participant.additiveChip.type]
                      : "Hidden"}
                  </strong>
                  <small>
                    {participant.userId === currentUserId
                      ? "Only the trigger timing is hidden from your opponent."
                      : participant.additiveRevealed || room.status === "finished"
                        ? participant.additiveRevealReason || "Revealed at battle end."
                        : "Reveals when triggered or after the duel ends."}
                  </small>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="battle-problem-grid">
        {room.problems.map((problem) => {
          const myBreakdown = myScore.breakdown.find((entry) => entry.problemKey === problem.problemKey);
          const opponentBreakdown = opponentScore.breakdown.find((entry) => entry.problemKey === problem.problemKey);
          const myAccepted = typeof myBreakdown?.acceptedMinute === "number";

          return (
            <article key={problem.problemKey} className="battle-problem-card">
              <div className="battle-problem-head">
                <div>
                  <span className={`difficulty-pill difficulty-${problem.slot}`}>{problem.targetLabel}</span>
                  <h3>{problem.name}</h3>
                </div>
                <span className="task-rating">{problem.rating}</span>
              </div>

              <p className="muted-copy">{problem.tags.join(", ") || "No tags listed"}</p>

              <div className="battle-problem-gridline">
                <div className="battle-side-metric">
                  <span>Your panel</span>
                  <strong>{myAccepted ? `${formatScore(myBreakdown?.score ?? 0)} pts` : `${formatScore(myBreakdown?.potentialScoreNow ?? 0)} now`}</strong>
                  <small>
                    WA: {myBreakdown?.wrongAttempts ?? 0}
                    {" • "}
                    {myAccepted ? `Accepted at ${myBreakdown?.acceptedMinute}m` : "Penalty preview shown for a solve right now"}
                  </small>
                </div>
                <div className="battle-side-metric">
                  <span>{opponent.handle}</span>
                  <strong>
                    {typeof opponentBreakdown?.acceptedMinute === "number"
                      ? `${formatScore(opponentBreakdown.score)} pts`
                      : `${formatScore(opponentBreakdown?.potentialScoreNow ?? 0)} now`}
                  </strong>
                  <small>
                    WA: {opponentBreakdown?.wrongAttempts ?? 0}
                    {" • "}
                    {typeof opponentBreakdown?.acceptedMinute === "number"
                      ? `Accepted at ${opponentBreakdown.acceptedMinute}m`
                      : "Still unsolved"}
                  </small>
                </div>
              </div>

              <div className="battle-problem-actions">
                <a href={problem.link} target="_blank" rel="noreferrer" className="button button-secondary">
                  Open problem
                </a>
                {room.status === "active" ? (
                  <div className="battle-action-buttons">
                    <form action="/battle/wa" method="post">
                      <input type="hidden" name="battleId" value={room.id} />
                      <input type="hidden" name="problemKey" value={problem.problemKey} />
                      <button type="submit" className="button button-secondary" disabled={myAccepted}>
                        Record WA
                      </button>
                    </form>
                    <form action="/battle/solve" method="post">
                      <input type="hidden" name="battleId" value={room.id} />
                      <input type="hidden" name="problemKey" value={problem.problemKey} />
                      <button type="submit" className="button button-primary" disabled={myAccepted}>
                        Mark accepted
                      </button>
                    </form>
                  </div>
                ) : (
                  <span className="status-pill is-done">Battle locked</span>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {room.status === "finished" ? (
        <div className="battle-end-modal">
          <div className="battle-end-card">
            <p className="eyebrow">Battle result</p>
            <h2>{room.resultLabel}</h2>
            <p className="lead">
              {room.resultReason ? `Result decided by ${room.resultReason}.` : "Battle closed with a final scoreboard review."}
            </p>
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
        </div>
      ) : null}
    </section>
  );
}
