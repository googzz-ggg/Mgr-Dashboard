// scripts/build-dashboard-data.mjs
//
// Regenerates lib/dashboard-data.generated.json from the two raw Excel
// reports. Run this any time you get a new sales report (MBL_Raw_Data_*.xlsx)
// or attendance report (attend_start_end_per_store_*.xlsx).
//
// Usage:
//   node scripts/build-dashboard-data.mjs <sales.xlsx> <attendance.xlsx>
//
// Requires the `xlsx` package: npm install xlsx
//
// Merge key: Sales "Shop Code" === Attendance "shop code" (case differs in
// the source files but the values are the same format, e.g. "S-0001-001").
//
// NOTE ON DATA HONESTY: this script only computes what the source data can
// actually support. There is no manager-name column in either report, so it
// does NOT invent regional manager names or fabricated audit findings.
// "Ghost visits" and "fake check-ins" are not derivable from this data shape
// (no GPS/device-ID columns) — if/when that data becomes available, extend
// the heuristics below rather than hardcoding numbers.

import xlsx from "xlsx";
import fs from "fs";
import path from "path";

const [, , salesPath, attendancePath] = process.argv;

if (!salesPath || !attendancePath) {
  console.error("Usage: node scripts/build-dashboard-data.mjs <sales.xlsx> <attendance.xlsx>");
  process.exit(1);
}

// Maps the raw "Area" values used in the sales report to the RegionKey
// values used throughout the app (EgyptMap, NexusCopilot, etc).
const AREA_TO_REGION = {
  Cairo: "Cairo",
  Delta: "Delta",
  Alex: "Alexandria",
  Upper: "Upper Egypt",
};

function readRows(filePath, sheetNameHint) {
  const wb = xlsx.readFile(filePath);
  const sheetName = wb.SheetNames.includes(sheetNameHint) ? sheetNameHint : wb.SheetNames[0];
  return xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
}

const salesRows = readRows(salesPath, "Sheet1");
const attendanceRows = readRows(attendancePath, "attend_start_end_per_store");

const shopArea = new Map();
const revenueByArea = new Map();
const unitsByArea = new Map();
const shopsByArea = new Map(); // area -> Set(shopCode)
const shopRevenue = new Map();
const brandRevenue = new Map();
const weekRevenue = new Map();

const add = (map, key, val) => map.set(key, (map.get(key) || 0) + val);
const addToSet = (map, key, val) => {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(val);
};

for (const row of salesRows) {
  const shop = row["Shop Code"];
  const area = row["Area"];
  const brand = row["Brand"];
  const week = row["W"];
  const sellout = Number(row["Sellout"]) || 0;
  const price = Number(row["Price"]) || 0;
  const revenue = sellout * price;

  if (shop) shopArea.set(shop, area);
  if (area) {
    add(revenueByArea, area, revenue);
    add(unitsByArea, area, sellout);
    addToSet(shopsByArea, area, shop);
  }
  if (shop) add(shopRevenue, shop, revenue);
  if (brand) add(brandRevenue, brand, revenue);
  if (week) add(weekRevenue, week, revenue);
}

const attendShopsByArea = new Map();
const attendRowsByArea = new Map();
const employees = new Set();
const multiStaffKey = new Map(); // (shop|date) -> Set(empCode)

for (const row of attendanceRows) {
  const shop = row["shop code"];
  const emp = row["emp_code"];
  const date = row["date"];
  const area = shopArea.get(shop);

  if (emp) employees.add(emp);
  if (area) {
    addToSet(attendShopsByArea, area, shop);
    add(attendRowsByArea, area, 1);
  }
  const key = `${shop}|${date}`;
  addToSet(multiStaffKey, key, emp);
}

let totalMultiStaffCases = 0;
const multiStaffByArea = new Map();
for (const [key, empSet] of multiStaffKey.entries()) {
  if (empSet.size > 1) {
    totalMultiStaffCases++;
    const shop = key.split("|")[0];
    const area = shopArea.get(shop);
    if (area) add(multiStaffByArea, area, 1);
  }
}

const maxRevenue = Math.max(...revenueByArea.values());
const regions = {};
let totalGapShops = 0;
let bridgedShops = 0;

for (const [area, regionKey] of Object.entries(AREA_TO_REGION)) {
  const salesShops = shopsByArea.get(area) || new Set();
  const attendShops = attendShopsByArea.get(area) || new Set();
  const gap = [...salesShops].filter((s) => !attendShops.has(s)).sort();
  const revenue = revenueByArea.get(area) || 0;

  const salesScore = Math.round((100 * revenue) / maxRevenue);
  const coverageScore = salesShops.size > 0 ? Math.round((100 * attendShops.size) / salesShops.size) : 0;
  const performance = Math.round(salesScore * 0.25 + coverageScore * 0.75);

  totalGapShops += gap.length;
  bridgedShops += attendShops.size;

  regions[regionKey] = {
    salesScore,
    coverageScore,
    performance,
    salesValueM: Math.round((revenue / 1_000_000) * 10) / 10,
    units: unitsByArea.get(area) || 0,
    shops: salesShops.size,
    shopsWithAttendance: attendShops.size,
    attendanceGap: gap.length,
    attendanceGapShopCodes: gap,
    multiStaffCases: multiStaffByArea.get(area) || 0,
    attendanceRows: attendRowsByArea.get(area) || 0,
  };
}

const output = {
  generatedAt: new Date().toISOString(),
  sourceFiles: { sales: path.basename(salesPath), attendance: path.basename(attendancePath) },
  regions,
  networkWide: {
    activeShops: bridgedShops, // shops present in BOTH sales and attendance data
    totalShopsInSalesData: [...shopArea.keys()].length,
    employees: employees.size,
    totalRevenue: [...revenueByArea.values()].reduce((a, b) => a + b, 0),
    totalUnits: [...unitsByArea.values()].reduce((a, b) => a + b, 0),
    totalMultiStaffCases,
    shopsWithSalesNoAttendance: totalGapShops,
  },
  topBrandsByRevenue: [...brandRevenue.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  weeklyRevenue: Object.fromEntries(weekRevenue),
  topShopsByRevenue: [...shopRevenue.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
};

const outPath = path.join(process.cwd(), "lib", "dashboard-data.generated.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Wrote ${outPath}`);
console.log(`Network-wide: ${output.networkWide.activeShops} bridged shops, ${output.networkWide.employees} employees, EGP ${(output.networkWide.totalRevenue / 1e6).toFixed(1)}M revenue`);
