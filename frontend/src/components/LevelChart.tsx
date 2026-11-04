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
import type { LevelRow } from "../types";

// Categorical slots 1-3 (blue, orange, aqua), dark steps, validated
// all-pairs against the card surface #1d2026 (CVD dE >= 9.4, normal-vision
// >= 20.9, all >= 3:1). Color follows the AC's position in the list.
const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70"];

const INK = { primary: "#f0f0f0", secondary: "#aaaaaa", muted: "#898781" };
const GRID = "#2c2f36";
const AXIS = "#3a3d44";
const SURFACE = "#1d2026";

interface LevelChartProps {
  rows: LevelRow[];
  acList: number[];
  /** Also draw each AC without power attack (dashed). */
  showWithoutPowerAttack: boolean;
}

type Point = Record<string, number>;

function toPoints(rows: LevelRow[], acList: number[]): Point[] {
  return rows.map((row) => {
    const point: Point = { level: row.level };
    acList.forEach((_, i) => {
      const result = row.results[i];
      point[`ac${i}`] = result.total_had;
      if (result.total_had_without_power_attack !== null) {
        point[`noPa${i}`] = result.total_had_without_power_attack;
      }
    });
    return point;
  });
}

function LevelTooltip({
  active,
  payload,
  label,
  acList,
}: TooltipContentProps<number, string> & { acList: number[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">Level {label}</div>
      {[...payload]
        // The main lines first, then their without-power-attack versions.
        .sort(
          (a, b) =>
            Number(String(a.dataKey).startsWith("noPa")) -
            Number(String(b.dataKey).startsWith("noPa")),
        )
        .map((entry) => {
          const key = String(entry.dataKey);
          const index = Number(key.replace(/\D/g, ""));
          const name = key.startsWith("noPa")
            ? `AC ${acList[index]} without power attack`
            : `AC ${acList[index]}`;
          return (
            <div className="chart-tooltip-row" key={key}>
              <svg width="14" height="4" aria-hidden="true">
                <line
                  x1="0"
                  y1="2"
                  x2="14"
                  y2="2"
                  stroke={SERIES_COLORS[index]}
                  strokeWidth="2"
                  strokeDasharray={key.startsWith("noPa") ? "3 2" : undefined}
                />
              </svg>
              <strong>{Number(entry.value).toFixed(2)}</strong>
              <span>{name}</span>
            </div>
          );
        })}
    </div>
  );
}

/**
 * Damage per round by level, one line per target AC. The table next to it
 * carries every value, so the chart is a picture of the same numbers.
 */
export default function LevelChart({
  rows,
  acList,
  showWithoutPowerAttack,
}: LevelChartProps) {
  const points = toPoints(rows, acList);
  const last = points.length - 1;

  return (
    <figure className="level-chart">
      <figcaption className="chart-legend">
        <span className="chart-legend-title">Damage per round by level</span>
        {acList.map((ac, i) => (
          <span className="chart-legend-item" key={ac + "-" + i}>
            <svg width="16" height="4" aria-hidden="true">
              <line
                x1="0"
                y1="2"
                x2="16"
                y2="2"
                stroke={SERIES_COLORS[i]}
                strokeWidth="2"
              />
            </svg>
            AC {ac}
          </span>
        ))}
        {showWithoutPowerAttack && (
          <span className="chart-legend-item">
            <svg width="16" height="4" aria-hidden="true">
              <line
                x1="0"
                y1="2"
                x2="16"
                y2="2"
                stroke={INK.secondary}
                strokeWidth="2"
                strokeDasharray="3 2"
              />
            </svg>
            Dashed: same AC without power attack
          </span>
        )}
      </figcaption>
      <div
        role="img"
        aria-label={`Line chart of damage per round at levels 1 to 20 against AC ${acList.join(", ")}. The table below lists every value.`}
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={points}
            margin={{ top: 12, right: 56, bottom: 4, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="level"
              type="number"
              domain={[1, 20]}
              ticks={[1, 4, 8, 12, 16, 20]}
              stroke={AXIS}
              tick={{ fill: INK.muted, fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              stroke={AXIS}
              tick={{ fill: INK.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: INK.muted, strokeWidth: 1 }}
              content={(props) => (
                <LevelTooltip
                  {...(props as TooltipContentProps<number, string>)}
                  acList={acList}
                />
              )}
              isAnimationActive={false}
            />
            {showWithoutPowerAttack &&
              acList.map((_, i) => (
                <Line
                  key={`noPa${i}`}
                  dataKey={`noPa${i}`}
                  stroke={SERIES_COLORS[i]}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  strokeOpacity={0.7}
                  dot={false}
                  activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            {acList.map((ac, i) => (
              <Line
                key={`ac${i}`}
                dataKey={`ac${i}`}
                stroke={SERIES_COLORS[i]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              >
                {/* Direct label at the line's end, in text ink (never the series color). */}
                <LabelList
                  dataKey={`ac${i}`}
                  content={({ x, y, index }) =>
                    index === last ? (
                      <text
                        x={Number(x) + 8}
                        y={Number(y)}
                        dy={4}
                        fill={INK.secondary}
                        fontSize={12}
                      >
                        AC {ac}
                      </text>
                    ) : null
                  }
                />
              </Line>
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
