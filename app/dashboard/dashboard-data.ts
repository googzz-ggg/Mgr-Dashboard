// Single source of truth for regional performance data.
// Both EgyptMap and NexusCopilot import from here so the copilot's answers
// stay grounded in exactly what's drawn on the dashboard — change a number
// once, it updates everywhere.

export type RegionKey = "Cairo" | "Delta" | "Alexandria" | "Upper Egypt";

export interface RegionStat {
  performance: number; // 0-100
  sales: string; // display string
  salesValueM: number; // EGP millions, for sorting/sizing
  shops: number;
  attendanceGap: number; // shops with sales but no attendance record
  trend: "up" | "down" | "flat";
  note: string; // one-line human takeaway, used as copilot grounding + tooltip
}

export const regionData: Record<RegionKey, RegionStat> = {
  Cairo: {
    performance: 92,
    sales: "EGP 890M",
    salesValueM: 890,
    shops: 1450,
    attendanceGap: 9,
    trend: "up",
    note: "Strongest region. Attendance discipline is the only drag on a near-perfect scorecard.",
  },
  Delta: {
    performance: 78,
    sales: "EGP 620M",
    salesValueM: 620,
    shops: 1120,
    attendanceGap: 14,
    trend: "up",
    note: "Solid and improving. A 15% attendance lift here could add roughly EGP 90-95M.",
  },
  Alexandria: {
    performance: 85,
    sales: "EGP 310M",
    salesValueM: 310,
    shops: 640,
    attendanceGap: 6,
    trend: "flat",
    note: "Healthy and stable, smaller footprint than Cairo or Delta.",
  },
  "Upper Egypt": {
    performance: 64,
    sales: "EGP 280M",
    salesValueM: 280,
    shops: 763,
    attendanceGap: 9,
    trend: "down",
    note: "Weakest region. Lower performance score despite real sales volume — the gap is usually attendance and ghost-visit related, not demand.",
  },
};

// Network-wide stats, mirrored from the sidebar/toolbar in page.tsx
export const networkStats = {
  activeShops: 3973,
  employees: 843,
  dataAccuracy: 99.2,
  shopsWithSalesNoAttendance: 38,
};

// Governorate -> macro-region mapping with approximate centroids [lon, lat].
// Coordinates are city-level approximations for visualization, not survey-grade.
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

// Builds a compact, model-friendly text block describing the live dashboard.
// This is what makes the copilot's answers reflect "the power of the
// displayed data" instead of generic retail chatter.
export function buildDashboardContext(selectedRegion?: RegionKey | null): string {
  const lines = Object.entries(regionData).map(
    ([name, r]) =>
      `- ${name}: ${r.performance}% performance, ${r.sales} sales, ${r.shops} shops, ${r.attendanceGap} shops with sales but no attendance, trend ${r.trend}. ${r.note}`
  );

  const focus = selectedRegion
    ? `\nThe user currently has "${selectedRegion}" selected/filtered on the dashboard — prioritize that region unless they ask about something else.`
    : "";

  return [
    `LIVE DASHBOARD SNAPSHOT (use these real numbers, do not invent different ones):`,
    `Network-wide: ${networkStats.activeShops} active shops, ${networkStats.employees} employees, ${networkStats.dataAccuracy}% data accuracy, ${networkStats.shopsWithSalesNoAttendance} shops with sales but no attendance logged.`,
    `By region:`,
    ...lines,
    focus,
  ]
    .filter(Boolean)
    .join("\n");
}
