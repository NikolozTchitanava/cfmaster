import type { RatingPoint } from "@/lib/types";

type RatingSparklineProps = {
  rating: RatingPoint[];
};

function buildPath(rating: RatingPoint[], width: number, height: number): string {
  if (!rating.length) {
    return "";
  }

  const values = rating.map((point) => point.newRating);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  return rating
    .map((point, index) => {
      const x = (index / Math.max(rating.length - 1, 1)) * width;
      const y = height - ((point.newRating - min) / spread) * height;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export function RatingSparkline({ rating }: RatingSparklineProps) {
  const latest = rating[rating.length - 1]?.newRating ?? null;
  const earliest = rating[0]?.newRating ?? null;
  const delta = latest !== null && earliest !== null ? latest - earliest : null;
  const gradientId = `sparkline-fill-${rating[0]?.time ?? "empty"}-${rating.length}`;

  return (
    <div className="chart-card">
      <div className="chart-copy">
        <p className="eyebrow">Rating path</p>
        <h3>Codeforces contest trend</h3>
        <p>{delta === null ? "No rated contests yet." : `${delta >= 0 ? "+" : ""}${delta} overall change across recorded contests.`}</p>
      </div>

      {rating.length ? (
        <svg viewBox="0 0 300 120" className="sparkline" aria-label="Codeforces rating trend">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 184, 108, 0.55)" />
              <stop offset="100%" stopColor="rgba(255, 184, 108, 0.02)" />
            </linearGradient>
          </defs>
          <path d={`${buildPath(rating, 300, 108)} L 300 120 L 0 120 Z`} fill={`url(#${gradientId})`} />
          <path d={buildPath(rating, 300, 108)} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      ) : (
        <div className="empty-plate">No rating data yet.</div>
      )}
    </div>
  );
}
