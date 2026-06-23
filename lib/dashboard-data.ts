// Single source of truth for regional performance data.
// EgyptMap, NexusCopilot, and every dashboard page import from here so they
// all stay grounded in the SAME real numbers, computed from your actual
// sales + attendance reports — not hardcoded samples.
//
// Where the numbers come from:
//   lib/dashboard-data.generated.json is produced by scripts/build-dashboard-data.mjs,
//   which reads your two source Excel reports and merges them on shop code
//   (Sales "Shop Code" === Attendance "shop code"). Regenerate it any time
//   you get a new weekly/monthly report:
//
//     node scripts/build-dashboard-data.mjs path/to/sales.xlsx path/to/attendance.xlsx
//
// HONESTY NOTE: the source reports have no manager-name or GPS/device-ID
// columns. That means this file intentionally does NOT include regional
// manager names or "ghost visit" / "fake check-in" counts — those would
// have to be fabricated without real source columns to back them. If you
// get a report that includes shop-to-manager mapping or check-in geolocation,
// extend the build script and this file together so the numbers stay real.

import generated from "./dashboard-data.generated.json";

export type RegionKey = "Cairo" | "Delta" | "Alexandria" | "Upper Egypt";

export interface RegionStat {
  performance: number; // 0-100, weighted score: 25% sales + 75% coverage/attendance
  salesScore: number; // 0-100, sales revenue relative to the top-performing region
  coverageScore: number; // 0-100, % of shops with sales that also have an attendance record
  sales: string; // display string, e.g. "EGP 890M"
  salesValueM: number; // EGP millions
  units: number; // units sold
  shops: number; // shops with sales activity
  shopsWithAttendance: number;
  attendanceGap: number; // shops with sales but zero attendance record
  attendanceGapShopCodes: string[]; // the actual shop codes, for drill-down/audit views
  multiStaffCases: number; // same shop + same day, >1 employee clocked in
  trend: "up" | "down" | "flat"; // not derivable from a single snapshot — see note below
  note: string;
}

// The network's scoring weight: 25% sales results, 75% check-in/attendance
// coverage. Coverage is weighted 3x sales deliberately — a region can post
// strong sales numbers while still having real coverage/attendance gaps,
// so the scorecard leans on the harder-to-fake attendance data.
export const SCORE_WEIGHTS = { sales: 0.25, coverage: 0.75 } as const;

export function weightedScore(salesScore: number, coverageScore: number): number {
  return Math.round(salesScore * SCORE_WEIGHTS.sales + coverageScore * SCORE_WEIGHTS.coverage);
}

type GeneratedRegion = (typeof generated.regions)[keyof typeof generated.regions];

function noteFor(r: GeneratedRegion): string {
  if (r.attendanceGap === 0) return "Full attendance coverage on every shop with sales activity this period.";
  if (r.coverageScore >= 95) return `Strong coverage — ${r.attendanceGap} shop(s) still missing an attendance record despite sales.`;
  return `${r.attendanceGap} shops have sales but no attendance record — coverage is the main drag on this region's score.`;
}

// TREND NOTE: a single snapshot (one set of weeks) can't tell you trend
// direction on its own. Once you've run the build script against two+
// periods, wire this up to compare current vs previous performance instead
// of leaving it flat. For now every region reports "flat" rather than a
// fabricated up/down arrow.
const TREND_PLACEHOLDER: RegionStat["trend"] = "flat";

export const regionData: Record<RegionKey, RegionStat> = Object.fromEntries(
  (Object.entries(generated.regions) as [RegionKey, GeneratedRegion][]).map(([region, r]) => [
    region,
    {
      performance: r.performance,
      salesScore: r.salesScore,
      coverageScore: r.coverageScore,
      sales: `EGP ${r.salesValueM}M`,
      salesValueM: r.salesValueM,
      units: r.units,
      shops: r.shops,
      shopsWithAttendance: r.shopsWithAttendance,
      attendanceGap: r.attendanceGap,
      attendanceGapShopCodes: r.attendanceGapShopCodes,
      multiStaffCases: r.multiStaffCases,
      trend: TREND_PLACEHOLDER,
      note: noteFor(r),
    } satisfies RegionStat,
  ])
) as Record<RegionKey, RegionStat>;

// Network-wide stats, computed from the same source data — mirrors the
// sidebar/toolbar in page.tsx.
export const networkStats = {
  activeShops: generated.networkWide.activeShops, // shops present in BOTH sales and attendance data
  totalShopsInSalesData: generated.networkWide.totalShopsInSalesData,
  employees: generated.networkWide.employees,
  totalRevenueM: Math.round(generated.networkWide.totalRevenue / 100_000) / 10,
  totalUnits: generated.networkWide.totalUnits,
  totalMultiStaffCases: generated.networkWide.totalMultiStaffCases,
  shopsWithSalesNoAttendance: generated.networkWide.shopsWithSalesNoAttendance,
  generatedAt: generated.generatedAt,
  sourceFiles: generated.sourceFiles,
};

export const topBrandsByRevenue = generated.topBrandsByRevenue as [string, number][];
export const topShopsByRevenue = generated.topShopsByRevenue as [string, number][];
export const weeklyRevenue = generated.weeklyRevenue as Record<string, number>;

// Governorate -> macro-region mapping with approximate centroids [lon, lat].
// Coordinates are city-level approximations for visualization, not survey-grade.
// (Unchanged — your source reports use 4 macro Areas, not individual
// governorates, so this mapping is still hand-maintained rather than derived.)
export interface Governorate {
  name: string;
  region: RegionKey;
  coordinates: [number, number];
  hub?: boolean; // the representative "anchor" city for its region, drawn larger
}

export const governorates: Governorate[] = [
  { name: "Cairo", region: "Cairo", coordinates: [31.24, 30.04], hub: true },
  { name: "Giza", region: "Cairo", coordinates: [31.21, 30.01] },
  { name: "Qalyubia", region: "Cairo", coordinates: [31.18, 30.46] },

  { name: "Alexandria", region: "Alexandria", coordinates: [29.92, 31.2], hub: true },
  { name: "Beheira", region: "Alexandria", coordinates: [30.47, 31.03] },
  { name: "Matrouh", region: "Alexandria", coordinates: [27.23, 31.35] },

  { name: "Dakahlia", region: "Delta", coordinates: [31.38, 31.05], hub: true },
  { name: "Sharqia", region: "Delta", coordinates: [31.5, 30.59] },
  { name: "Gharbia", region: "Delta", coordinates: [31.0, 30.78] },
  { name: "Monufia", region: "Delta", coordinates: [30.99, 30.55] },
  { name: "Kafr El Sheikh", region: "Delta", coordinates: [30.94, 31.11] },
  { name: "Damietta", region: "Delta", coordinates: [31.81, 31.42] },
  { name: "Port Said", region: "Delta", coordinates: [32.28, 31.26] },
  { name: "Ismailia", region: "Delta", coordinates: [32.27, 30.6] },
  { name: "Suez", region: "Delta", coordinates: [32.55, 29.97] },

  { name: "Faiyum", region: "Upper Egypt", coordinates: [30.84, 29.31] },
  { name: "Beni Suef", region: "Upper Egypt", coordinates: [31.1, 29.07] },
  { name: "Minya", region: "Upper Egypt", coordinates: [30.76, 28.11] },
  { name: "Asyut", region: "Upper Egypt", coordinates: [31.18, 27.18], hub: true },
  { name: "Sohag", region: "Upper Egypt", coordinates: [31.7, 26.56] },
  { name: "Qena", region: "Upper Egypt", coordinates: [32.72, 26.16] },
  { name: "Luxor", region: "Upper Egypt", coordinates: [32.64, 25.69] },
  { name: "Aswan", region: "Upper Egypt", coordinates: [32.9, 24.09] },
  { name: "Red Sea", region: "Upper Egypt", coordinates: [33.81, 27.26] },
  { name: "New Valley", region: "Upper Egypt", coordinates: [30.55, 25.45] },
  { name: "North Sinai", region: "Upper Egypt", coordinates: [33.8, 31.13] },
  { name: "South Sinai", region: "Upper Egypt", coordinates: [33.62, 28.23] },
];

// Builds a compact, model-friendly text block describing the live dashboard,
// grounded entirely in the real computed numbers above. "Data never lies":
// every figure here traces back to an actual row in your source reports.
export function buildDashboardContext(selectedRegion?: RegionKey | null): string {
  const regionLines = Object.entries(regionData).map(([name, r]) => {
    const gapPreview =
      r.attendanceGapShopCodes.length > 0
        ? `e.g. ${r.attendanceGapShopCodes.slice(0, 5).join(", ")}${r.attendanceGapShopCodes.length > 5 ? ", ..." : ""}`
        : "none";

    return [
      `- ${name}`,
      `  Weighted score: ${r.performance}% = 25% x sales score (${r.salesScore}) + 75% x coverage score (${r.coverageScore})`,
      `  Sales: ${r.sales} | Units: ${r.units.toLocaleString()} | Shops: ${r.shops} | Shops with attendance: ${r.shopsWithAttendance}`,
      `  Attendance gap: ${r.attendanceGap} shops (${gapPreview}) | Multi-staff-same-day cases: ${r.multiStaffCases}`,
      `  Takeaway: ${r.note}`,
    ].join("\n");
  });

  const focus = selectedRegion
    ? `\nThe user currently has "${selectedRegion}" selected/filtered on the dashboard — prioritize that region unless they ask about something else.`
    : "";

  return [
    `LIVE DASHBOARD SNAPSHOT — computed from real source reports (${networkStats.sourceFiles.sales}, ${networkStats.sourceFiles.attendance}), generated ${networkStats.generatedAt}. Use these real numbers, do not invent different ones.`,
    `Network-wide: ${networkStats.activeShops} shops bridged across both sales and attendance data (${networkStats.totalShopsInSalesData} total shops have sales activity), ${networkStats.employees} employees, EGP ${networkStats.totalRevenueM}M total revenue, ${networkStats.shopsWithSalesNoAttendance} shops with sales but no attendance logged, ${networkStats.totalMultiStaffCases} multi-staff-same-day cases.`,
    `Scoring model: every region's headline performance % = 25% sales score + 75% coverage score. Sales score is each region's revenue relative to the top-performing region (so the leader scores 100). Coverage score is the % of sales-active shops that also have an attendance record.`,
    `DATA LIMITATION — be upfront about this if asked: the source reports have no manager-name or GPS/device-ID columns, so individual accountable managers and "ghost visit"/"fake check-in" classifications are NOT available yet. Only report attendance gaps and multi-staff-same-day cases — do not invent manager names or fraud labels beyond what's listed here.`,
    `By region:`,
    ...regionLines,
    focus,
  ]
    .filter(Boolean)
    .join("\n");
}
