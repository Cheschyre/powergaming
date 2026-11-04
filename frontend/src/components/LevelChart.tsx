import { CHART_INK, SERIES_COLORS } from "../chartColors";
import type { LevelRow } from "../types";
import DamageLineChart, {
  type ChartSeries,
  type LegendItem,
} from "./DamageLineChart";

interface LevelChartProps {
  rows: LevelRow[];
  acList: number[];
  /** Also draw each AC without power attack (dashed). */
  showWithoutPowerAttack: boolean;
}

/** Damage per round by level, one line per target AC (color follows the
 * AC's position in the list). */
export default function LevelChart({
  rows,
  acList,
  showWithoutPowerAttack,
}: LevelChartProps) {
  const points = rows.map((row) => {
    const point: Record<string, number> = { level: row.level };
    acList.forEach((_, i) => {
      const result = row.results[i];
      point[`ac${i}`] = result.total_had;
      if (result.total_had_without_power_attack !== null) {
        point[`noPa${i}`] = result.total_had_without_power_attack;
      }
    });
    return point;
  });

  const series: ChartSeries[] = acList.flatMap((ac, i) => [
    {
      key: `ac${i}`,
      label: `AC ${ac}`,
      color: SERIES_COLORS[i],
      endLabel: `AC ${ac}`,
    },
    ...(showWithoutPowerAttack
      ? [
          {
            key: `noPa${i}`,
            label: `AC ${ac} without power attack`,
            color: SERIES_COLORS[i],
            dashed: true,
          },
        ]
      : []),
  ]);
  const legend: LegendItem[] = [
    ...acList.map((ac, i) => ({ label: `AC ${ac}`, color: SERIES_COLORS[i] })),
    ...(showWithoutPowerAttack
      ? [
          {
            label: "Dashed: same AC without power attack",
            color: CHART_INK.secondary,
            dashed: true,
          },
        ]
      : []),
  ];

  return (
    <DamageLineChart
      title="Damage per round by level"
      ariaLabel={`Line chart of damage per round at levels 1 to 20 against AC ${acList.join(", ")}. The table below lists every value.`}
      points={points}
      xKey="level"
      xDomain={[1, 20]}
      xTicks={[1, 4, 8, 12, 16, 20]}
      xHeading={(level) => `Level ${level}`}
      series={series}
      legend={legend}
    />
  );
}
