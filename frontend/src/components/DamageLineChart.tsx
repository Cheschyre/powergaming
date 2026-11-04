import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import {
  CHART_AXIS,
  CHART_GRID,
  CHART_INK,
  CHART_SURFACE,
} from "../chartColors";

export interface ChartSeries {
  /** Key of this series' value in each point. */
  key: string;
  /** Name in the tooltip. */
  label: string;
  color: string;
  dashed?: boolean;
  /** Direct label at the line's right end (solid series only). */
  endLabel?: string;
}

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

interface DamageLineChartProps {
  title: string;
  /** Screen-reader description; the table next to the chart has the values. */
  ariaLabel: string;
  points: Record<string, number>[];
  xKey: string;
  xDomain: [number, number];
  xTicks?: number[];
  /** Tooltip heading for an x value, e.g. "Level 12" or "AC 15". */
  xHeading: (x: number) => string;
  series: ChartSeries[];
  legend: LegendItem[];
}

function LineKey({
  color,
  dashed,
  width = 16,
}: {
  color: string;
  dashed?: boolean;
  width?: number;
}) {
  return (
    <svg width={width} height="4" aria-hidden="true">
      <line
        x1="0"
        y1="2"
        x2={width}
        y2="2"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dashed ? "3 2" : undefined}
      />
    </svg>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  series,
  xHeading,
}: TooltipContentProps<number, string> & {
  series: ChartSeries[];
  xHeading: (x: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const byKey = new Map(series.map((s, i) => [s.key, { ...s, order: i }]));
  // One tooltip, every series, in the series' own order (solid before dashed).
  const rows = payload
    .map((entry) => ({ entry, meta: byKey.get(String(entry.dataKey)) }))
    .filter((r) => r.meta)
    .sort(
      (a, b) =>
        Number(!!a.meta!.dashed) - Number(!!b.meta!.dashed) ||
        a.meta!.order - b.meta!.order,
    );
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{xHeading(Number(label))}</div>
      {rows.map(({ entry, meta }) => (
        <div className="chart-tooltip-row" key={meta!.key}>
          <LineKey color={meta!.color} dashed={meta!.dashed} width={14} />
          <strong>{Number(entry.value).toFixed(2)}</strong>
          <span>{meta!.label}</span>
        </div>
      ))}
    </div>
  );
}

const CHART_HEIGHT = 280;
const PLOT_HEIGHT = CHART_HEIGHT - 40; // minus the x axis and margins
const LABEL_GAP_PX = 14;

/**
 * Which end labels fit: when lines finish close together their labels would
 * overlap, and stacking them apart detaches them from their lines -- so a
 * label only shows where it has room, top-most first. The legend, tooltip
 * and table name every line either way.
 */
function labelsWithRoom(
  points: Record<string, number>[],
  series: ChartSeries[],
): Set<string> {
  const lastPoint = points[points.length - 1];
  if (!lastPoint) return new Set();
  const top = Math.max(
    1,
    ...points.flatMap((p) => series.map((s) => p[s.key] ?? 0)),
  );
  const pxPerUnit = PLOT_HEIGHT / (top * 1.1); // the axis rounds its top up a little
  const ends = series
    .filter((s) => s.endLabel && lastPoint[s.key] !== undefined)
    .map((s) => ({ key: s.key, y: lastPoint[s.key] * pxPerUnit }))
    .sort((a, b) => b.y - a.y);
  const kept: { key: string; y: number }[] = [];
  for (const end of ends) {
    if (kept.every((k) => Math.abs(k.y - end.y) >= LABEL_GAP_PX))
      kept.push(end);
  }
  return new Set(kept.map((k) => k.key));
}

/**
 * Damage per round as lines: thin 2px lines, a legend, direct end labels,
 * a crosshair tooltip listing every series, and recessive axes. Every value
 * is also in a table next to the chart (the chart is a picture of it).
 */
export default function DamageLineChart({
  title,
  ariaLabel,
  points,
  xKey,
  xDomain,
  xTicks,
  xHeading,
  series,
  legend,
}: DamageLineChartProps) {
  const last = points.length - 1;
  const endLabelled = labelsWithRoom(points, series);
  // Dashed (comparison) lines draw first so the solid ones sit on top.
  const ordered = [...series].sort(
    (a, b) => Number(!!b.dashed) - Number(!!a.dashed),
  );

  return (
    <figure className="level-chart">
      <figcaption className="chart-legend">
        <span className="chart-legend-title">{title}</span>
        {legend.map((item) => (
          <span className="chart-legend-item" key={item.label}>
            <LineKey color={item.color} dashed={item.dashed} />
            {item.label}
          </span>
        ))}
      </figcaption>
      <div role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <LineChart
            data={points}
            margin={{ top: 12, right: 120, bottom: 4, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke={CHART_GRID} />
            <XAxis
              dataKey={xKey}
              type="number"
              domain={xDomain}
              ticks={xTicks}
              allowDecimals={false}
              stroke={CHART_AXIS}
              tick={{ fill: CHART_INK.muted, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              stroke={CHART_AXIS}
              tick={{ fill: CHART_INK.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: CHART_INK.muted, strokeWidth: 1 }}
              content={(props) => (
                <ChartTooltip
                  {...(props as TooltipContentProps<number, string>)}
                  series={series}
                  xHeading={xHeading}
                />
              )}
              isAnimationActive={false}
            />
            {ordered.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.dashed ? "4 3" : undefined}
                strokeOpacity={s.dashed ? 0.7 : 1}
                dot={false}
                activeDot={{ r: 4, stroke: CHART_SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              >
                {s.endLabel && endLabelled.has(s.key) && (
                  // Direct label at the line's end, in text ink (never the series color).
                  <LabelList
                    dataKey={s.key}
                    content={({ x, y, index }) =>
                      index === last ? (
                        <text
                          x={Number(x) + 8}
                          y={Number(y)}
                          dy={4}
                          fill={CHART_INK.secondary}
                          fontSize={12}
                        >
                          {s.endLabel}
                        </text>
                      ) : null
                    }
                  />
                )}
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
