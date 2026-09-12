import { Card } from "@/components/ui/card";
import { dpspCategoryValues } from "@/app/(app)/tasks/schema";
import { DPSP_CATEGORY_CONFIG } from "@/constants/dpsp-category";

const CATEGORY_FILL_CLASSNAME: Record<(typeof dpspCategoryValues)[number], string> = {
  demand: "fill-viz-1",
  product: "fill-viz-6",
  sales: "fill-viz-3",
  profit: "fill-viz-2",
};

// Clockwise from 12 o'clock — Demand -> Product -> Sales -> Profit -> back to Demand, matching
// the flywheel's own flow (a season's Sales & Profit signals feed the next season's Demand).
const SEGMENTS = dpspCategoryValues.map((category, index) => ({
  category,
  startAngle: index * 90,
  endAngle: (index + 1) * 90,
}));

const CENTER = 100;
const OUTER_RADIUS = 92;
const INNER_RADIUS = 56;
const LABEL_RADIUS = (OUTER_RADIUS + INNER_RADIUS) / 2;

function polarToCartesian(radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(angleRad), y: CENTER + radius * Math.sin(angleRad) };
}

// A quarter-donut wedge between two radii — four of these, each a quadrant, make the ring.
function donutWedgePath(startAngle: number, endAngle: number) {
  const outerStart = polarToCartesian(OUTER_RADIUS, endAngle);
  const outerEnd = polarToCartesian(OUTER_RADIUS, startAngle);
  const innerStart = polarToCartesian(INNER_RADIUS, endAngle);
  const innerEnd = polarToCartesian(INNER_RADIUS, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

export interface DpspFlywheelDiagramProps {
  /** Live deliverables currently on the board — every category summed, after the toolbar's
   *  filters (not column-visibility, which is display-only). */
  totalCount: number;
  /** Distinct seasons represented among those deliverables. */
  seasonCount: number;
  categoryCounts: Record<(typeof dpspCategoryValues)[number], number>;
}

// The left-panel explainer — a static wheel diagram (the four categories always divide the
// circle evenly; it's a concept diagram, not a chart of the counts below it) plus a short,
// mostly-fixed explanation of what the board means, with the live counts spliced in.
export function DpspFlywheelDiagram({ totalCount, seasonCount, categoryCounts }: DpspFlywheelDiagramProps) {
  return (
    <div className="flex flex-col gap-4">
      <Card className="items-center gap-0 p-6">
        <svg viewBox="0 0 200 200" className="h-48 w-48" role="img" aria-label="DPSP Flywheel diagram">
          {SEGMENTS.map(({ category, startAngle, endAngle }) => {
            const mid = (startAngle + endAngle) / 2;
            const labelPos = polarToCartesian(LABEL_RADIUS, mid);
            return (
              <g key={category}>
                <path d={donutWedgePath(startAngle, endAngle)} className={CATEGORY_FILL_CLASSNAME[category]} />
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-white text-[22px] font-semibold"
                >
                  {DPSP_CATEGORY_CONFIG[category].label.charAt(0)}
                </text>
              </g>
            );
          })}
          <circle cx={CENTER} cy={CENTER} r={INNER_RADIUS - 2} className="fill-foreground" />
          <text x={CENTER} y={CENTER - 6} textAnchor="middle" className="fill-background text-[15px] font-bold">
            DPSP
          </text>
          <text x={CENTER} y={CENTER + 12} textAnchor="middle" className="fill-background text-[10px] tracking-wide">
            FLYWHEEL
          </text>
        </svg>
      </Card>

      <Card className="gap-2 p-4">
        <p className="text-sm font-semibold text-foreground">The critical path is a conveyor; DPSP is a flywheel.</p>
        <p className="text-sm text-muted-foreground">
          The board currently shows <span className="font-medium text-foreground">{totalCount}</span> live
          deliverable{totalCount === 1 ? "" : "s"} across{" "}
          <span className="font-medium text-foreground">{seasonCount}</span> season{seasonCount === 1 ? "" : "s"} —{" "}
          <span className="font-medium text-foreground">{categoryCounts.demand}</span> in Demand,{" "}
          <span className="font-medium text-foreground">{categoryCounts.product}</span> in Product,{" "}
          <span className="font-medium text-foreground">{categoryCounts.sales}</span> in Sales and{" "}
          <span className="font-medium text-foreground">{categoryCounts.profit}</span> in Profit. The wheel only
          keeps turning if Sales &amp; Profit signals loop back into next season&apos;s Demand — this board is that
          loop, not just a list of tasks.
        </p>
      </Card>
    </div>
  );
}
