import type { CalendarView } from "@/lib/types";

type HeatmapProps = {
  calendar: CalendarView;
};

export function Heatmap({ calendar }: HeatmapProps) {
  return (
    <div className="heatmap-shell">
      <div className="heatmap-months" aria-hidden="true">
        {calendar.monthLabels.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>

      <div className="heatmap-body">
        <div className="heatmap-weekdays" aria-hidden="true">
          {calendar.weekdayLabels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>

        <div className="heatmap-grid" role="img" aria-label={`Activity heatmap from ${calendar.startLabel} to ${calendar.endLabel}`}>
          {calendar.weeks.map((week, weekIndex) => (
            <div className="heatmap-column" key={`week-${weekIndex}`}>
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`heatmap-cell level-${day.level}${day.isToday ? " is-today" : ""}`}
                  title={`${day.date}: ${day.count} solved`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
