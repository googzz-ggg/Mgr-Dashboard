"use client";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  Users, ShieldCheck, ShieldAlert, TrendingDown, TrendingUp,
  Layers, RefreshCw, Crown, Flag, Copy, FileWarning, Eye, Gauge,
  Zap, Clock, Target, Activity, Download, X, MapPin, Calendar,
  Building2, ChevronDown, Search, Fingerprint, BarChart3, Store,
  AlertCircle, TrendingUp as TUp, Star, Mail,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine,
  LabelList, LineChart, Line,
} from "recharts";

// ─── FILE SOURCE TYPES ───────────────────────────────────────────────────────
type FileKind =
  | "employee_summary"   // Employee_Summary.xlsx  — SPVR Name, Code, Dept, TotalReports, UniqueStores, Dates, Pending/Reviewed/Other
  | "mobile_dep"         // Mobile_Dep.xlsx        — Daily visits raw (Mobile sheet)
  | "store_coverage"     // Store_Coverage.xlsx    — Shop Code, Shop Name, Area, Gov, TotalVisits, UniqueSPVRs, Dates
  | "submission_matrix"  // Submission_Matrix.xlsx — Employee, Code, TotalReports, MissingDates, day cols
  | "weekly_summary"     // Weekly_Summary.xlsx    — Employee, Code, Dept, week day cols
  | "attendance_time"    // Attendance_time.xlsx   — system GPS/app check-in log per shop visit (ground truth)
  | "unknown";

interface LoadedFile { name: string; kind: FileKind; size: string; rows: number; }

// ─── DATA MODELS ─────────────────────────────────────────────────────────────
interface EmployeeSummaryRow {
  name: string; code: string; department: string;
  totalReports: number; uniqueStores: number;
  firstReport: string; lastReport: string;
  pending: number; reviewed: number; other: number;
}
interface VisitRow {
  date: string; spvrCode: string; spvrName: string;
  shopCode: string; shopName: string; area: string; governorate: string;
  samsungShortage: string; compShortage: string; selloutMovement: string;
  brand: string; movement: string; comment: string;
  action1: string; accountFeedback: string; action2: string;
}
interface AttendanceRow {
  id: string; empCode: string; empName: string; department: string; title: string;
  shopCode: string; shopName: string;
  startTime: string; endTime: string; lastCheckTime: string; lastCheckDateTime: string;
  duration: string; durationSec: number; date: string; // "YYYY-MM-DD"
}
interface StoreCoverageRow {
  shopCode: string; shopName: string; area: string; governorate: string;
  totalVisits: number; uniqueSPVRs: number; firstVisit: string; lastVisit: string;
}
interface SubmissionRow {
  name: string; code: string; totalReports: number; missingDates: string;
  dayMap: Map<string, string>; // "15-Apr" -> "21:22" or "–"
}
interface WeeklySummaryRow {
  name: string; code: string; department: string;
  weekTotals: number[]; // [w1,w2,w3,w4,w5]
  dayScores: Map<string, number>; // "Jun 02" -> 1|0
}

// ─── ENRICHED PROFILE ────────────────────────────────────────────────────────
interface EmployeeProfile {
  // from Employee Summary
  name: string; code: string; department: string;
  totalReports: number; uniqueStores: number;
  firstReport: string; lastReport: string;
  pending: number; reviewed: number; other: number;
  // from Submission Matrix
  submittedDays: number; totalPossibleDays: number; missingDates: string;
  submissionRate: number; // %
  timeMap: Map<string, string>;
  // from Weekly Summary
  weekTotals: number[]; // per week
  juneTotal: number; // total june visits
  // from Mobile Dep (visit analysis)
  visitCount: number;
  blankComments: number; lowInfoComments: number; templatedRepeats: number;
  unsupportedClaims: number; lateNightCount: number; fridayVisits: number; hqCheckIns: number;
  singleShopLoop: boolean; avgCommentLen: number;
  integrityScore: number; ghostScore: number;
  suspiciousFlags: string[];
  topRepeatedComment: { text: string; count: number } | null;
  uniquenessRatio: number;
  // from Store Coverage (cross-reference)
  storesInCoverage: number; // how many shops this SPVR appears in coverage file
  // from Attendance Time (system check-in ground truth)
  hasAttendanceData: boolean;
  attendanceCheckins: number;         // total system check-ins for this employee
  attendanceShops: number;            // unique shops with a system check-in
  verifiedVisits: number;             // reports that DO have a matching same-day check-in at the same shop
  unverifiedReports: number;          // reports with NO matching check-in — strongest fraud signal
  attendanceMatchRate: number;        // % of reports that are check-in verified
  silentVisits: number;               // check-ins that exist with NO matching report filed
  ghostCheckins: number;              // check-ins under 3 minutes total duration (drive-by / tap-and-leave)
  openCheckins: number;               // check-ins with no end_work_time recorded (never checked out)
  avgCheckinDurationMin: number;
  criticalIssues: number;             // No-Checkout + Ghost-Reporting count — the headline fraud-signal total
  gapHigh: number;                    // of the "Attended Not Reported" gaps, how many ran ≥30 min (High priority)
  // composite
  fieldTrust: number; // 0-100
  trustTier: "Healthy" | "Watch" | "Needs Support";
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const LOW_INFO = new Set(["ok","fine","good","done","no issue","nothing","n/a","na","-","none","good.","ok.","yes","no","daily report"]);
const fmtB = (b:number) => b>1_048_576?`${(b/1_048_576).toFixed(1)} MB`:`${(b/1024).toFixed(0)} KB`;
const pct = (a:number,b:number) => b>0?Math.round((a/b)*100):0;
const compColor = (p:number) => p>=80?"text-emerald-400":p>=50?"text-amber-400":"text-red-400";
const intgColor = (p:number) => p>=80?"text-cyan-400":p>=50?"text-amber-400":"text-red-400";
const compBg = (p:number) => p>=80?"#34d399":p>=50?"#fbbf24":"#f87171";
const ghostBadge = (s:number) => s>=60?{l:"NEEDS REVIEW",c:"bg-red-500/20 text-red-400 border-red-500/30"}:s>=30?{l:"WORTH A LOOK",c:"bg-amber-500/20 text-amber-400 border-amber-500/30"}:{l:"LOOKS GOOD",c:"bg-emerald-500/20 text-emerald-400 border-emerald-500/30"};

// ─── FILE DETECTION ──────────────────────────────────────────────────────────
function detectKind(sheetNames: string[], fileName: string): FileKind {
  const fn = fileName.toLowerCase();
  if (fn.includes("employee_summary") || fn.includes("employee summary")) return "employee_summary";
  if (fn.includes("mobile_dep") || fn.includes("mobile dep")) return "mobile_dep";
  if (fn.includes("store_coverage") || fn.includes("store coverage")) return "store_coverage";
  if (fn.includes("submission_matrix") || fn.includes("submission matrix")) return "submission_matrix";
  if (fn.includes("weekly_summary") || fn.includes("weekly summary")) return "weekly_summary";
  if (fn.includes("attendance")) return "attendance_time";
  // Fallback by sheet name
  if (sheetNames.includes("Employee Summary")) return "employee_summary";
  if (sheetNames.includes("Mobile")) return "mobile_dep";
  if (sheetNames.includes("Store Coverage")) return "store_coverage";
  if (sheetNames.includes("Submission Matrix")) return "submission_matrix";
  if (sheetNames.includes("Weekly Summary")) return "weekly_summary";
  if (sheetNames.some(s=>s.toLowerCase().includes("attendance"))) return "attendance_time";
  return "unknown";
}

// ─── PARSERS ─────────────────────────────────────────────────────────────────
function parseEmployeeSummary(rows: any[][]): EmployeeSummaryRow[] {
  return rows.slice(1).filter(r=>r[0]&&r[1]).map(r=>({
    name:String(r[0]||""), code:String(r[1]||""), department:String(r[2]||"mobile"),
    totalReports:Number(r[3]||0), uniqueStores:Number(r[4]||0),
    firstReport:String(r[5]||""), lastReport:String(r[6]||""),
    pending:Number(r[7]||0), reviewed:Number(r[8]||0), other:Number(r[9]||0),
  }));
}

function parseMobileDep(rows: any[][]): VisitRow[] {
  // Row 0,1 = merged headers; Row 2 = actual col headers; Row 3+ = data
  return rows.slice(3).filter(r=>r[1]).map(r=>({
    date:String(r[0]||""), spvrCode:String(r[1]||""), spvrName:String(r[2]||""),
    shopCode:String(r[3]||""), shopName:String(r[4]||""), area:String(r[5]||""),
    governorate:String(r[6]||""), samsungShortage:String(r[7]||""),
    compShortage:String(r[8]||""), selloutMovement:String(r[9]||""),
    brand:String(r[10]||""), movement:String(r[11]||""),
    comment:String(r[12]||"").trim(), action1:String(r[13]||""),
    accountFeedback:String(r[14]||""), action2:String(r[15]||""),
  }));
}

function parseStoreCoverage(rows: any[][]): StoreCoverageRow[] {
  return rows.slice(1).filter(r=>r[0]&&r[3]).map(r=>({
    shopCode:String(r[0]||""), shopName:String(r[1]||""),
    area:String(r[2]||""), governorate:String(r[3]||""),
    totalVisits:Number(r[4]||0), uniqueSPVRs:Number(r[5]||0),
    firstVisit:String(r[6]||""), lastVisit:String(r[7]||""),
  }));
}

function parseSubmissionMatrix(rows: any[][]): Map<string,SubmissionRow> {
  const map = new Map<string,SubmissionRow>();
  const headerRow = rows[0] || [];
  // Columns 4+ are dates: "15-Apr", "16-Apr"...
  const dateCols: string[] = [];
  for(let c=4; c<headerRow.length; c++) {
    if(headerRow[c]) dateCols.push(String(headerRow[c]));
  }
  for(const row of rows.slice(1)) {
    if(!row[0]||!row[1]) continue;
    const dayMap = new Map<string,string>();
    for(let c=0; c<dateCols.length; c++) {
      const val = row[4+c];
      if(val!==null&&val!==undefined&&val!=="") dayMap.set(dateCols[c], String(val));
    }
    const submitted = [...dayMap.values()].filter(v=>v!=="–"&&v!=="").length;
    map.set(String(row[1]), {
      name:String(row[0]), code:String(row[1]),
      totalReports:Number(row[2]||0), missingDates:String(row[3]||""),
      dayMap,
    });
  }
  return map;
}

function parseWeeklySummary(rows: any[][]): Map<string,WeeklySummaryRow> {
  const map = new Map<string,WeeklySummaryRow>();
  if(rows.length<3) return map;
  // Row 0: week headers  Row 1: day headers  Row 2+: data
  const dayHeaders = (rows[1]||[]) as any[];
  const dayCols: {idx:number;label:string;weekIdx:number}[] = [];
  const weekTotalCols: number[] = [];
  // Week total cols are at fixed positions: 7(W1T),16(W2T),25(W3T),34(W4T),39(W5T) — but actually
  // scan row1 for "Total" substrings
  for(let c=3; c<dayHeaders.length; c++) {
    const h = String(dayHeaders[c]||"");
    if(h.toLowerCase().includes("total")) weekTotalCols.push(c);
  }

  for(const row of rows.slice(2)) {
    if(!row[0]||!row[1]) continue;
    const weekTotals = weekTotalCols.map(c=>Number(row[c]||0));
    const juneTotal = weekTotals.reduce((s,v)=>s+v,0);
    const dayScores = new Map<string,number>();
    for(let c=3; c<row.length; c++) {
      const v = row[c];
      if(v!==null&&v!==undefined&&v!==""&&!String(dayHeaders[c]||"").toLowerCase().includes("total")&&!String(dayHeaders[c]||"").toLowerCase().includes("notes")) {
        dayScores.set(`col_${c}`, Number(v)||0);
      }
    }
    map.set(String(row[1]), {
      name:String(row[0]), code:String(row[1]), department:String(row[2]||"mobile"),
      weekTotals, dayScores,
    });
  }
  return map;
}

// Duration string "HH:MM:SS" -> seconds. Tolerant of missing/odd values.
function durationToSec(d:any): number {
  if(d===null||d===undefined||d==="") return 0;
  const s = String(d);
  const m = s.match(/^(\d+):(\d{2}):(\d{2})$/);
  if(!m) return 0;
  return parseInt(m[1],10)*3600+parseInt(m[2],10)*60+parseInt(m[3],10);
}
// Accepts an Excel Date object, a raw Excel serial-date NUMBER (this is what
// XLSX.utils.sheet_to_json returns for numeric date cells when the workbook
// is read without {cellDates:true}, which is how Attendance_time.xlsx's
// "date" column actually comes through — e.g. 46204, not a Date object), or
// a "YYYY-MM-DD..." string, and always returns a plain "YYYY-MM-DD" — used
// to join attendance rows to visit-report rows on the same calendar day.
// Getting this wrong silently breaks every attendance/report match, since
// the join key never lines up (this was previously the case: numeric serials
// fell through to String(46204)="46204", which matches nothing).
function toDateKey(v:any): string {
  if(v instanceof Date) {
    const y=v.getFullYear(), m=String(v.getMonth()+1).padStart(2,"0"), d=String(v.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  }
  if(typeof v==="number"&&isFinite(v)&&v>0) {
    const dc = XLSX.SSF.parse_date_code(v);
    if(dc&&dc.y) return `${dc.y}-${String(dc.m).padStart(2,"0")}-${String(dc.d).padStart(2,"0")}`;
  }
  const s = String(v||"");
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?m[1]:s.slice(0,10);
}
function fmtTimeVal(v:any): string {
  if(v instanceof Date) return v.toTimeString().slice(0,8);
  if(typeof v==="number"&&isFinite(v)) {
    // Excel time-only serial (fraction of a day) that slipped through as a number.
    const dc = XLSX.SSF.parse_date_code(v);
    if(dc) return `${String(dc.H).padStart(2,"0")}:${String(dc.M).padStart(2,"0")}:${String(Math.round(dc.S)).padStart(2,"0")}`;
  }
  return v===null||v===undefined?"":String(v);
}

// Attendance_time.xlsx — one row per system-recorded shop check-in
// (app/GPS based). Columns: id, emp_code, emp_name, department, title,
// code (shop code), name (shop name), start_work_time, end_work_time,
// last_check_time, last_check_date_time, duration, date.
function parseAttendanceTime(rows: any[][]): AttendanceRow[] {
  return rows.slice(1).filter(r=>r[1]&&r[5]).map(r=>{
    const dur = durationToSec(r[11]);
    return {
      id: String(r[0]||""), empCode: String(r[1]||"").trim(), empName: String(r[2]||""),
      department: String(r[3]||""), title: String(r[4]||""),
      shopCode: String(r[5]||"").trim(), shopName: String(r[6]||""),
      startTime: fmtTimeVal(r[7]), endTime: fmtTimeVal(r[8]),
      lastCheckTime: fmtTimeVal(r[9]), lastCheckDateTime: String(r[10]||""),
      duration: String(r[11]||"00:00:00"), durationSec: dur,
      date: toDateKey(r[12]),
    };
  });
}

function getHour(d:string): number|null {
  const m = d.match(/[T ](\d{2}):/);
  return m?parseInt(m[1],10):null;
}

// Day of week from a "YYYY-MM-DD ..." string, computed from the raw digits
// (not via new Date(str) + local timezone) so it can't drift by a day.
// 0=Sun, 1=Mon, ... 5=Fri, 6=Sat.
function getDow(d:string): number|null {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return null;
  const dt = new Date(Date.UTC(parseInt(m[1],10),parseInt(m[2],10)-1,parseInt(m[3],10)));
  return dt.getUTCDay();
}

// Official field-visit window: 1 PM–9 PM, every day except Friday (the
// company's weekly day off — Friday visits are judged separately, not
// against the hour window, since the whole day is out of the ordinary).
const VISIT_WINDOW_START_HOUR = 13; // 1 PM
const VISIT_WINDOW_END_HOUR = 21;   // 9 PM
const WEEKLY_OFF_DOW = 5; // Friday

// Smart Sense is the company's own head office, not a retail dealer/shop —
// visits logged there (attendance/admin check-ins) must never be counted as
// "store" visits in coverage, single-shop-loop, or top-stores metrics.
function isHQLocation(shopName:string): boolean {
  return shopName.toLowerCase().includes("smart sense");
}

// ─── BUILD PROFILES ──────────────────────────────────────────────────────────
function buildProfiles(
  empSummary: EmployeeSummaryRow[],
  visits: VisitRow[],
  storeCoverage: StoreCoverageRow[],
  submissionMap: Map<string,SubmissionRow>,
  weeklyMap: Map<string,WeeklySummaryRow>,
  attendance: AttendanceRow[] = [],
): EmployeeProfile[] {

  // Index attendance by employee code for per-employee lookups when
  // cross-checking filed reports against the system's own GPS/app log.
  const attendanceByCode = new Map<string,AttendanceRow[]>();
  for(const a of attendance){
    if(!attendanceByCode.has(a.empCode)) attendanceByCode.set(a.empCode,[]);
    attendanceByCode.get(a.empCode)!.push(a);
  }
  const attendanceDatesByEmp = new Set<string>(); // codes that have any attendance rows at all
  for(const a of attendance) attendanceDatesByEmp.add(a.empCode);

  // Index visits by spvrCode
  const visitsByCode = new Map<string,VisitRow[]>();
  for(const v of visits) {
    if(!visitsByCode.has(v.spvrCode)) visitsByCode.set(v.spvrCode,[]);
    visitsByCode.get(v.spvrCode)!.push(v);
  }

  // Store coverage: count stores per SPVR (cross-ref from raw visits)
  const storesBySpvr = new Map<string,Set<string>>();
  for(const v of visits) {
    if(!storesBySpvr.has(v.spvrCode)) storesBySpvr.set(v.spvrCode,new Set());
    storesBySpvr.get(v.spvrCode)!.add(v.shopCode);
  }

  // Total possible days from submission matrix (count all day columns)
  const getSubmissionStats = (code: string) => {
    const sub = submissionMap.get(code);
    if(!sub) return { submittedDays:0, totalPossibleDays:0, timeMap: new Map<string,string>(), missingDates:"" };
    const allVals = [...sub.dayMap.values()];
    const totalPossibleDays = allVals.length;
    const submittedDays = allVals.filter(v=>v!=="–"&&v!=="").length;
    return { submittedDays, totalPossibleDays, timeMap:sub.dayMap, missingDates:sub.missingDates };
  };

  const profiles: EmployeeProfile[] = [];

  for(const emp of empSummary) {
    const rows = visitsByCode.get(emp.code)||[];
    const sub = getSubmissionStats(emp.code);
    const weekly = weeklyMap.get(emp.code);

    // Report quality analysis — scans every free-text field for repeated /
    // templated content, not just the Comment field, so duplicate phrasing
    // anywhere in the report (Sell-out movement, Movement, Action) is caught.
    // Smart Sense (company HQ) rows are excluded from "store" identity —
    // they're admin/attendance check-ins, not dealer visits.
    const storeRows = rows.filter(r=>!isHQLocation(r.shopName));
    const hqRows = rows.filter(r=>isHQLocation(r.shopName));
    const shops = new Set(storeRows.map(r=>r.shopCode));
    let blank=0, lowInfo=0, unsupported=0, offHours=0, fridayVisits=0, totalLen=0;
    const cc = new Map<string,number>(); // comment text -> count (for "most reused comment")
    const DUP_FIELDS: ("comment"|"selloutMovement"|"movement"|"action1")[] = ["comment","selloutMovement","movement","action1"];
    const exactMap = new Map<string,{count:number;sample:string;field:string}>();
    const normMap = new Map<string,{count:number;sample:string;field:string}>();
    const normalize = (s:string) => s.toLowerCase().trim().replace(/[\d/().,%-]+/g," ").replace(/\s+/g," ").trim();

    for(const r of rows) {
      const c = r.comment.toLowerCase().trim();
      totalLen += r.comment.length;
      if(!c) blank++;
      else if(LOW_INFO.has(c)||c.length<=4) lowInfo++;
      else cc.set(c,(cc.get(c)||0)+1);
      const shortage = r.samsungShortage&&!["n","no","none","","–"].includes(r.samsungShortage.toLowerCase().trim());
      if((shortage||r.selloutMovement.length>3)&&!c) unsupported++;

      // Visit-time check: official window is 1 PM–9 PM every day except
      // Friday, which is the weekly day off — a Friday visit is flagged on
      // its own rather than judged against the hour window.
      const hr=getHour(r.date);
      const dow=getDow(r.date);
      if(dow===WEEKLY_OFF_DOW) fridayVisits++;
      else if(hr!==null&&(hr<VISIT_WINDOW_START_HOUR||hr>=VISIT_WINDOW_END_HOUR)) offHours++;

      // Cross-field duplicate scan (exact + near/templated)
      for(const field of DUP_FIELDS){
        const raw = (r[field]||"").toString().toLowerCase().trim();
        if(raw.length<8||LOW_INFO.has(raw)) continue;
        const eKey = `${field}::${raw}`;
        const e = exactMap.get(eKey)||{count:0,sample:(r as any)[field],field};
        e.count++; exactMap.set(eKey,e);
        const norm = normalize(raw);
        if(norm.length>=8){
          const nKey = `${field}::${norm}`;
          const n = normMap.get(nKey)||{count:0,sample:(r as any)[field],field};
          n.count++; normMap.set(nKey,n);
        }
      }
    }

    let exactDupExtra=0, top:any=null;
    for(const [text,count] of cc.entries()){
      if(!top||count>top.count) top={text,count};
    }
    let topDupField:{sample:string;field:string;count:number}|null=null;
    for(const {count,sample,field} of exactMap.values()){
      if(count>1){
        exactDupExtra += count-1;
        if(!topDupField||count>topDupField.count) topDupField={sample,field,count};
      }
    }
    let nearDupExtra=0;
    for(const {count} of normMap.values()){
      if(count>1) nearDupExtra += count-1;
    }
    // Near-dup total also includes exact matches (identical text normalizes the same way too) — net out the overlap so templated-but-not-identical repeats aren't double counted.
    nearDupExtra = Math.max(0, nearDupExtra-exactDupExtra);
    // templatedRepeats: exact repeats count in full, templated/near-duplicate repeats (same wording, different model/number) count at reduced weight since they're a softer signal.
    const templatedRepeats = exactDupExtra + Math.round(nearDupExtra*0.6);

    const avgCommentLen = rows.length>0?Math.round(totalLen/rows.length):0;
    const singleShopLoop = shops.size===1&&storeRows.length>4;
    const blankPct = pct(blank,rows.length);
    const offHoursPct = pct(offHours,rows.length);

    // ── Attendance cross-check (system check-in log = ground truth) ──────
    // Classifies every attendance check-in and every filed report the same
    // way a manual audit would: a check-in with no recorded check-out is a
    // critical accountability gap regardless of whether a report happens to
    // match it — this includes Smart Sense (the office check-in itself is
    // legitimate; never checking back out of it is not, so it is NOT
    // excluded here even though Smart Sense is excluded from "store"
    // coverage counts elsewhere in this file). A check-in under 1 minute is
    // a suspicious short visit. Anything else either has a matching
    // same-day/same-shop report (verified) or doesn't (a gap — "Attended
    // Not Reported" — tiered High/Medium by how long the visit actually
    // ran). A filed report with zero attendance record at all for that
    // shop/day is "Ghost Reporting" — the strongest single fraud signal,
    // since there is no system evidence the employee was ever there.
    const empAttendance = attendanceByCode.get(emp.code)||[];
    const hasAttendanceData = attendanceDatesByEmp.has(emp.code);
    const reportedShopDatePairs = new Set(rows.map(r=>`${r.shopCode}::${toDateKey(r.date)}`));

    let verifiedVisits=0, noCheckoutCount=0, shortVisitCount=0;
    let gapCount=0, gapHigh=0, totalDurSec=0;
    for(const a of empAttendance){
      totalDurSec += a.durationSec;
      const noCheckout = !a.endTime;
      const shortVisit = !noCheckout&&a.durationSec<60;
      const matched = reportedShopDatePairs.has(`${a.shopCode}::${a.date}`);
      if(noCheckout) noCheckoutCount++;
      else if(shortVisit) shortVisitCount++;
      else if(matched) verifiedVisits++;
      else { gapCount++; if(a.durationSec>=1800) gapHigh++; }
    }
    const attendanceShopDatePairs = new Set(empAttendance.map(a=>`${a.shopCode}::${a.date}`));
    let unverifiedReports=0; // = "Ghost Reporting": filed with zero attendance record
    for(const r of rows){
      const dKey = toDateKey(r.date);
      if(hasAttendanceData&&!attendanceShopDatePairs.has(`${r.shopCode}::${dKey}`)) unverifiedReports++;
    }
    const criticalIssues = noCheckoutCount+unverifiedReports;
    const totalCrossRefRows = empAttendance.length+unverifiedReports;
    const attendanceMatchRate = hasAttendanceData&&totalCrossRefRows>0?pct(verifiedVisits,totalCrossRefRows):0;
    const avgCheckinDurationMin = empAttendance.length>0?Math.round((totalDurSec/empAttendance.length)/6)/10:0;
    // Preserve prior field names used throughout the rest of the file.
    const silentVisits = gapCount;         // "Attended Not Reported" gaps
    const ghostCheckins = shortVisitCount; // "Suspicious Short Visit"
    const openCheckins = noCheckoutCount;  // "No Check-Out (Fake Visit)"

    const fieldLabel:Record<string,string> = {comment:"Comment",selloutMovement:"Sell-out movement",movement:"Movement",action1:"Action"};
    const flags: string[] = [];
    if(hasAttendanceData&&unverifiedReports>0) flags.push(`Ghost Reporting: ${unverifiedReports} filed report${unverifiedReports>1?"s":""} with ZERO matching attendance record for that shop/day`);
    if(openCheckins>0) flags.push(`No Check-Out: ${openCheckins} check-in${openCheckins>1?"s":""} with no recorded check-out (incl. Smart Sense) — treated as a critical gap regardless of any matching report`);
    if(ghostCheckins>0) flags.push(`Suspicious Short Visit: ${ghostCheckins} check-in${ghostCheckins>1?"s":""} under 1 minute long`);
    if(hasAttendanceData&&silentVisits>0) flags.push(`Attended Not Reported: ${silentVisits} check-in${silentVisits>1?"s":""} with no matching report ever filed${gapHigh>0?` (${gapHigh} of them ≥30 min — High priority)`:""}`);
    if(blankPct>30) flags.push(`${blank} blank comments (${blankPct}% of visits)`);
    if(exactDupExtra>0) flags.push(`${exactDupExtra} exact word-for-word repeat${exactDupExtra>1?"s":""} across different shops`);
    if(nearDupExtra>=3) flags.push(`${nearDupExtra} templated entries reused with only the model/number swapped`);
    if(offHoursPct>50&&rows.length>=4) flags.push(`${offHours}/${rows.length} reports filed outside the 1 PM–9 PM visit window`);
    if(fridayVisits>0) flags.push(`${fridayVisits} report${fridayVisits>1?"s":""} logged on Friday (the weekly day off)`);
    if(unsupported>0) flags.push(`${unsupported} shortage claims with zero explanation`);
    if(avgCommentLen<25&&rows.length>=5) flags.push(`Avg comment only ${avgCommentLen} chars`);
    if(singleShopLoop) flags.push(`All ${storeRows.length} store visits at the same single shop`);
    if(hqRows.length>0) flags.push(`${hqRows.length} of ${rows.length} entries are Smart Sense (HQ) check-ins, not store visits`);
    if(topDupField&&topDupField.count>=2) flags.push(`${fieldLabel[topDupField.field]} repeated verbatim ${topDupField.count}× — e.g. "${topDupField.sample.toString().slice(0,55)}…"`);

    // Attendance is the strongest available signal, so when it's present it
    // carries real weight in the ghost score (unverified reports + drive-by
    // check-ins pushed in directly), not just as an extra flag on the side.
    const unverifiedPct = hasAttendanceData?pct(unverifiedReports,storeRows.length):0;
    const ghostCheckinPct = hasAttendanceData&&empAttendance.length>0?pct(ghostCheckins,empAttendance.length):0;
    const ghostScoreBase = Math.round(
      blankPct*0.30+Math.min(100,templatedRepeats*8)*0.20+offHoursPct*0.20+pct(fridayVisits,rows.length)*0.05+
      Math.min(100,unsupported*15)*0.15+(singleShopLoop?100:0)*0.10
    );
    const ghostScore = hasAttendanceData
      ? Math.min(100,Math.round(ghostScoreBase*0.55+unverifiedPct*0.35+ghostCheckinPct*0.10))
      : Math.min(100,ghostScoreBase);

    const penalty = templatedRepeats*4+lowInfo*1.5+unsupported*3+blank*1+fridayVisits*2+(hasAttendanceData?unverifiedReports*6+ghostCheckins*3:0);
    const integrityScore = Math.max(0,Math.min(100,Math.round(100-penalty)));

    const submissionRate = pct(sub.submittedDays, sub.totalPossibleDays);
    // With attendance data available, it becomes a third leg of field trust
    // (the "did this actually happen" check) alongside submission compliance
    // and report-content integrity — weighted evenly across all three.
    const fieldTrust = hasAttendanceData
      ? Math.round(submissionRate*0.33+integrityScore*0.33+attendanceMatchRate*0.34)
      : Math.round(submissionRate*0.5+integrityScore*0.5);
    const trustTier: "Healthy"|"Watch"|"Needs Support" = fieldTrust>=80?"Healthy":fieldTrust>=50?"Watch":"Needs Support";

    profiles.push({
      ...emp,
      submittedDays: sub.submittedDays,
      totalPossibleDays: sub.totalPossibleDays,
      missingDates: sub.missingDates,
      submissionRate,
      timeMap: sub.timeMap,
      weekTotals: weekly?.weekTotals||[],
      juneTotal: (weekly?.weekTotals||[]).reduce((s,v)=>s+v,0),
      visitCount: rows.length,
      blankComments: blank, lowInfoComments: lowInfo, templatedRepeats,
      unsupportedClaims: unsupported, lateNightCount: offHours, fridayVisits, hqCheckIns: hqRows.length,
      singleShopLoop, avgCommentLen,
      integrityScore, ghostScore, suspiciousFlags: flags,
      topRepeatedComment: topDupField&&topDupField.count>1?{text:topDupField.sample.toString(),count:topDupField.count}:(top&&top.count>1?top:null),
      uniquenessRatio: (rows.length-blank)>0?pct(cc.size+lowInfo,rows.length-blank):100,
      storesInCoverage: shops.size,
      hasAttendanceData, attendanceCheckins: empAttendance.length,
      attendanceShops: new Set(empAttendance.map(a=>a.shopCode)).size,
      verifiedVisits, unverifiedReports, attendanceMatchRate, silentVisits,
      ghostCheckins, openCheckins, avgCheckinDurationMin, criticalIssues, gapHigh,
      fieldTrust, trustTier,
    });
  }
  return profiles.sort((a,b)=>a.fieldTrust-b.fieldTrust);
}

// ─── SVG DEFS ────────────────────────────────────────────────────────────────
function Defs(){return(
  <defs>
    <linearGradient id="areaCyan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.55}/><stop offset="100%" stopColor="#22d3ee" stopOpacity={0}/>
    </linearGradient>
    <linearGradient id="hbar0" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="#0e7490"/><stop offset="100%" stopColor="#22d3ee"/>
    </linearGradient>
    <linearGradient id="hbar1" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="#5b21b6"/><stop offset="100%" stopColor="#a78bfa"/>
    </linearGradient>
    <linearGradient id="hbar2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stopColor="#92400e"/><stop offset="100%" stopColor="#fbbf24"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.55"/></filter>
    <filter id="glowCyan"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#22d3ee" floodOpacity="0.7"/></filter>
    <filter id="glowRed"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f87171" floodOpacity="0.7"/></filter>
    <filter id="glowGreen"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#34d399" floodOpacity="0.7"/></filter>
    <filter id="glowAmber"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#fbbf24" floodOpacity="0.7"/></filter>
    <filter id="glowPurple"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#a78bfa" floodOpacity="0.7"/></filter>
  </defs>
);}

const GlowDot=(p:any)=>{
  const{cx,cy}=p;if(!cx||!cy)return null;
  return(<g><circle cx={cx} cy={cy} r={7} fill="#22d3ee" opacity={0.15}/><circle cx={cx} cy={cy} r={3.5} fill="#22d3ee" filter="url(#glowCyan)"/></g>);
};
const GradBar=(p:any)=>{
  const{x,y,width,height,index}=p;
  const g=["url(#hbar0)","url(#hbar1)","url(#hbar2)"][index%3];
  return(<g filter="url(#shadow)"><rect x={x} y={y+1} width={width} height={height-2} rx={5} ry={5} fill={g}/><rect x={x} y={y+1} width={width*0.38} height={(height-2)*0.4} rx={5} ry={5} fill="white" opacity={0.09}/></g>);
};
function GhostMeter({score}:{score:number}){
  const f=Math.round(score/10),c=score>=60?"bg-red-400":score>=30?"bg-amber-400":"bg-emerald-400";
  return(<div className="flex items-center gap-0.5">{Array.from({length:10}).map((_,i)=>(<div key={i} className={`w-1.5 h-3.5 rounded-sm ${i<f?c:"bg-neutral-700"}`}/>))}</div>);
}

// ─── FLAG TOOLTIP ────────────────────────────────────────────────────────────
function FlagTooltip({p}:{p:EmployeeProfile}){
  const [open,setOpen]=useState(false);const n=p.suspiciousFlags.length;
  if(n===0)return<span className="text-neutral-600 text-sm">—</span>;
  return(<div className="relative inline-block">
    <button onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}
      className="flex items-center gap-1 text-sm font-medium text-amber-400 hover:text-amber-200 transition-colors">
      <Zap className="w-3 h-3"/>{n} flag{n>1?"s":""}
    </button>
    {open&&(<div className="absolute z-50 bottom-full left-0 mb-2 w-80 bg-neutral-800 border border-amber-500/40 rounded-xl p-3 shadow-2xl shadow-black/60">
      <p className="text-sm text-amber-300 font-bold mb-2 tracking-widest">⚠ THINGS TO REVIEW</p>
      <div className="space-y-1.5">{p.suspiciousFlags.map((f,i)=>(<div key={i} className="flex items-start gap-2 text-sm text-neutral-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"/>{f}</div>))}</div>
      {p.topRepeatedComment&&(<div className="mt-2 pt-2 border-t border-neutral-700"><p className="text-sm text-neutral-500 mb-1">Top repeated ({p.topRepeatedComment.count}×):</p><p className="text-sm text-neutral-300 italic line-clamp-2">"{p.topRepeatedComment.text}"</p></div>)}
    </div>)}
  </div>);
}

// ─── WEEK SPARKLINE ──────────────────────────────────────────────────────────
function WeekSparkline({totals}:{totals:number[]}){
  if(!totals.length)return<span className="text-neutral-600 text-sm">—</span>;
  const max=Math.max(...totals,1);
  return(
    <div className="flex items-end gap-0.5 h-5">
      {totals.map((v,i)=>{
        const h=Math.max(2,Math.round((v/max)*20));
        const c=v===0?"bg-neutral-700":v>=5?"bg-emerald-400":v>=3?"bg-cyan-400":"bg-amber-400";
        return(<div key={i} title={`W${i+1}: ${v}`} className={`w-2 rounded-sm ${c}`} style={{height:h}}/>);
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ SCORECARD MODAL ══════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ══ SCORECARD MODAL — visit trend replaces radar, enhanced UI/UX ═════════════
// ─────────────────────────────────────────────────────────────────────────────
function ScorecardModal({p,visits,storeCoverage,onClose}:{p:EmployeeProfile;visits:VisitRow[];storeCoverage:StoreCoverageRow[];onClose:()=>void}){
  const empVisits=visits.filter(v=>v.spvrCode===p.code);
  const shops=Array.from(new Set(empVisits.filter(v=>!isHQLocation(v.shopName)).map(v=>v.shopName))).slice(0,6);
  const areas=Array.from(new Set(empVisits.map(v=>v.area))).filter(Boolean);
  const govs=Array.from(new Set(empVisits.map(v=>v.governorate))).filter(Boolean);
  const trustColor=p.fieldTrust>=80?"#34d399":p.fieldTrust>=50?"#fbbf24":"#f87171";
  const trustGlow=p.fieldTrust>=80?"glowGreen":p.fieldTrust>=50?"glowAmber":"glowRed";

  // ── Visit trend — daily count ─────────────────────────────────────────────
  const dailyMap=new Map<string,number>();
  for(const v of empVisits) dailyMap.set(v.date.slice(0,10),(dailyMap.get(v.date.slice(0,10))||0)+1);
  const trendData=Array.from(dailyMap.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([d,c])=>({d:d.slice(5),c}));
  const avgDaily=trendData.length>0?Math.round(trendData.reduce((s,d)=>s+d.c,0)/trendData.length):0;
  const maxDaily=Math.max(...trendData.map(d=>d.c),1);
  const trendPct=trendData.length>=2?Math.round(((trendData[trendData.length-1].c-trendData[0].c)/Math.max(1,trendData[0].c))*100):0;

  // ── Weekly bars ───────────────────────────────────────────────────────────
  const weekBarData=p.weekTotals.map((v,i)=>({week:`W${i+1}`,visits:v,fill:v===0?"#374151":v>=5?"#34d399":v>=3?"#22d3ee":"#f59e0b"}));

  // ── Quality breakdown bar ───────────────────────────────────────────────
  const integrityBars=[
    {label:"Submission",val:p.submissionRate,max:100},
    {label:"Integrity",val:p.integrityScore,max:100},
    {label:"Comment Quality",val:Math.min(100,Math.round(((p.visitCount-p.blankComments)/Math.max(1,p.visitCount))*100)),max:100},
    {label:"Timeliness",val:Math.max(0,100-pct(p.lateNightCount,p.visitCount)),max:100},
    {label:"Coverage",val:Math.min(100,p.uniqueStores*4),max:100},
    ...(p.hasAttendanceData?[{label:"Check-in Verified",val:p.attendanceMatchRate,max:100}]:[]),
  ];

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4" style={{background:"rgba(0,0,0,0.92)",backdropFilter:"blur(12px)"}} onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[94vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{background:"linear-gradient(135deg,#07070f 0%,#0d0d1c 50%,#07070f 100%)",border:`1px solid ${trustColor}33`,boxShadow:`0 0 120px ${trustColor}14,0 0 0 1px ${trustColor}28,0 40px 80px rgba(0,0,0,0.95)`}}
        onClick={e=>e.stopPropagation()}>

        {/* Scanline + pulse bars */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0" style={{background:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,0.012) 3px,rgba(255,255,255,0.012) 4px)",opacity:1}}/>
          <div className="absolute left-0 right-0 h-px animate-pulse" style={{background:`linear-gradient(to right,transparent,${trustColor}55,transparent)`,top:"22%"}}/>
          <div className="absolute left-0 right-0 h-px animate-pulse" style={{background:`linear-gradient(to right,transparent,${trustColor}30,transparent)`,top:"68%",animationDelay:"1.4s"}}/>
          {/* Corner accent */}
          <div className="absolute top-0 left-0 w-24 h-24" style={{background:`radial-gradient(circle at 0 0,${trustColor}18,transparent 70%)`}}/>
          <div className="absolute bottom-0 right-0 w-32 h-32" style={{background:`radial-gradient(circle at 100% 100%,${trustColor}12,transparent 70%)`}}/>
        </div>

        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="relative flex items-center justify-between px-6 pt-6 pb-5 border-b" style={{borderColor:`${trustColor}22`}}>
          <div className="flex items-center gap-5">
            {/* Avatar ring */}
            <div className="relative w-18 h-18 shrink-0" style={{width:72,height:72}}>
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="32" fill="none" stroke="#1a1a2e" strokeWidth="4"/>
                <circle cx="36" cy="36" r="32" fill="none" stroke={trustColor} strokeWidth="4"
                  strokeDasharray={`${(p.fieldTrust/100)*201.1} 201.1`} strokeLinecap="round"
                  style={{filter:`drop-shadow(0 0 6px ${trustColor}88)`}}/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center rounded-full" style={{background:`${trustColor}12`}}>
                <span className="text-3xl font-black text-white">{p.name.split(" ").map((w:string)=>w[0]).slice(0,2).join("")}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h2 className="text-4xl font-display font-bold text-white tracking-tight">{p.name}</h2>
                <span className={`text-sm font-black px-3 py-1 rounded-full border tracking-wider ${p.trustTier==="Needs Support"?"bg-red-500/20 text-red-300 border-red-500/30":p.trustTier==="Watch"?"bg-amber-500/20 text-amber-300 border-amber-500/30":"bg-emerald-500/20 text-emerald-300 border-emerald-500/30"}`}>{p.trustTier.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-3 text-base text-neutral-400 mb-1">
                <span className="font-mono text-lg text-cyan-400 font-bold">{p.code}</span>
                <span className="text-neutral-700">·</span>
                <span className="capitalize font-medium">{p.department}</span>
                <span className="text-neutral-700">·</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-400"/>{govs.slice(0,3).join(", ")}{govs.length>3?` +${govs.length-3}`:""}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                <Calendar className="w-3 h-3"/>
                <span>{p.firstReport?.slice(0,10)} → {p.lastReport?.slice(0,10)}</span>
                <span className="text-neutral-700">·</span>
                <span className="text-neutral-500">{p.totalReports} total reports · {p.uniqueStores} stores</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-6 py-3 rounded-2xl border" style={{borderColor:`${trustColor}44`,background:`${trustColor}0e`}}>
              <p className="text-sm text-neutral-500 tracking-[0.2em] mb-1 font-bold">FIELD TRUST</p>
              <p className="text-5xl font-black font-mono leading-none" style={{color:trustColor,textShadow:`0 0 30px ${trustColor}88`}}>{p.fieldTrust}<span className="text-3xl">%</span></p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110" style={{background:"#1a1a2e",border:"1px solid #333"}}>
              <X className="w-4 h-4 text-neutral-400"/>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* ── ROW 1: Visit trend (full width) ──────────────────────────── */}
          <div className="rounded-xl border p-4" style={{background:"#0a0a16",borderColor:`${trustColor}22`}}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:`${trustColor}20`}}>
                  <Activity className="w-3.5 h-3.5" style={{color:trustColor}}/>
                </div>
                <div>
                  <p className="text-xl font-display font-bold text-white tracking-wide">VISIT ACTIVITY TREND</p>
                  <p className="text-sm text-neutral-500">Daily visit frequency across full period</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-neutral-500 tracking-wider">DAILY AVG</p>
                  <p className="text-2xl font-black font-mono" style={{color:trustColor}}>{avgDaily}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-500 tracking-wider">TREND</p>
                  <p className={`text-2xl font-black font-mono ${trendPct>=0?"text-emerald-400":"text-red-400"}`}>{trendPct>=0?"+":""}{trendPct}%</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-500 tracking-wider">PEAK/DAY</p>
                  <p className="text-2xl font-black font-mono text-purple-400">{maxDaily}</p>
                </div>
              </div>
            </div>
            {trendData.length>0?(
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={trendData} margin={{top:8,right:8,bottom:0,left:0}}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={trustColor} stopOpacity={0.5}/>
                      <stop offset="60%" stopColor={trustColor} stopOpacity={0.08}/>
                      <stop offset="100%" stopColor={trustColor} stopOpacity={0}/>
                    </linearGradient>
                    <filter id="trendGlow"><feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={trustColor} floodOpacity="0.6"/></filter>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#ffffff08" vertical={false}/>
                  <XAxis dataKey="d" tick={{fill:"#525252",fontSize:9,fontFamily:"monospace"}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:"#525252",fontSize:9}} axisLine={false} tickLine={false} width={22}/>
                  <ReferenceLine y={avgDaily} stroke={trustColor} strokeDasharray="4 3" strokeOpacity={0.35} label={{value:`avg`,position:"insideTopRight",fill:trustColor,fontSize:9,fontFamily:"monospace"}}/>
                  <Tooltip contentStyle={{background:"#0d0d1a",border:`1px solid ${trustColor}44`,borderRadius:10,color:"#fff",fontSize:11}} labelStyle={{color:trustColor,fontWeight:"bold"}} formatter={(v:any)=>[`${v} visits`,"Daily Volume"]}/>
                  <Area type="monotone" dataKey="c" stroke={trustColor} strokeWidth={2.5} fill="url(#trendFill)"
                    dot={false} activeDot={{r:5,fill:trustColor,stroke:"#0a0a16",strokeWidth:2,filter:"url(#trendGlow)"}}/>
                </AreaChart>
              </ResponsiveContainer>
            ):<div className="h-36 flex items-center justify-center"><p className="text-base text-neutral-600">No raw visit data loaded</p></div>}
          </div>

          {/* ── ROW 2: 5 metric bars + weekly bars ───────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Performance bars */}
            <div className="rounded-xl border p-4" style={{background:"#0a0a16",borderColor:"#1e1e2e"}}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-cyan-500/15">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400"/>
                </div>
                <p className="text-xl font-display font-bold text-white tracking-wide">PERFORMANCE BREAKDOWN</p>
              </div>
              <div className="space-y-3">
                {integrityBars.map((b,i)=>{
                  const bColor=b.val>=80?"#34d399":b.val>=50?"#fbbf24":"#f87171";
                  return(
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-neutral-300">{b.label}</span>
                        <span className="text-base font-black font-mono" style={{color:bColor}}>{b.val}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-800/80 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{
                          width:`${b.val}%`,
                          background:`linear-gradient(to right,${bColor}99,${bColor})`,
                          boxShadow:`0 0 8px ${bColor}66`
                        }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Weekly bars */}
            <div className="rounded-xl border p-4" style={{background:"#0a0a16",borderColor:"#1e1e2e"}}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15">
                    <Calendar className="w-3.5 h-3.5 text-purple-400"/>
                  </div>
                  <p className="text-xl font-display font-bold text-white tracking-wide">WEEKLY PERFORMANCE</p>
                </div>
                <span className="text-sm text-neutral-500 font-mono">{p.weekTotals.reduce((s,v)=>s+v,0)} total</span>
              </div>
              {weekBarData.length>0?(
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={weekBarData} margin={{top:4,right:4,bottom:0,left:0}} barSize={32}>
                    <XAxis dataKey="week" tick={{fill:"#737373",fontSize:10,fontFamily:"monospace",fontWeight:"bold"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:"#525252",fontSize:9}} axisLine={false} tickLine={false} width={22}/>
                    <Tooltip contentStyle={{background:"#0d0d1a",border:"1px solid #333",borderRadius:10,color:"#fff",fontSize:11}} formatter={(v:any)=>[`${v} visits`,""]}/>
                    <Bar dataKey="visits" radius={[5,5,0,0]}>
                      {weekBarData.map((d,i)=>(<Cell key={i} fill={d.fill} style={{filter:`drop-shadow(0 0 4px ${d.fill}66)`}}/>))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ):<p className="text-base text-neutral-600 text-center py-10">No weekly data</p>}
            </div>
          </div>

          {/* ── ROW 3: KPI chips ──────────────────────────────────────────── */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {[
              {label:"TOTAL REPORTS",val:p.totalReports,icon:"📋",color:trustColor},
              {label:"UNIQUE STORES",val:p.uniqueStores,icon:"🏪",color:"#22d3ee"},
              {label:"JUNE VISITS",val:p.juneTotal||p.visitCount,icon:"📅",color:"#a78bfa"},
              {label:"BLANK CMTS",val:p.blankComments,icon:"💬",color:p.blankComments>0?"#f87171":"#34d399"},
              {label:"OFF-HOURS",val:p.lateNightCount,icon:"🌙",color:p.lateNightCount>0?"#a78bfa":"#34d399"},
              {label:"PATTERN SCORE",val:`${p.ghostScore}`,icon:"👻",color:p.ghostScore>=60?"#f87171":p.ghostScore>=30?"#fbbf24":"#34d399"},
            ].map(k=>(
              <div key={k.label} className="rounded-xl p-3 border flex flex-col gap-1" style={{background:"#0d0d1a",borderColor:`${k.color}28`}}>
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] text-neutral-500 tracking-wider font-black leading-tight">{k.label}</span>
                  <span className="text-lg">{k.icon}</span>
                </div>
                <p className="text-3xl font-black font-mono" style={{color:k.color,textShadow:`0 0 12px ${k.color}55`}}>{k.val}</p>
              </div>
            ))}
          </div>

          {/* ── ROW 4: Store footprint ────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4" style={{background:"#0a0a16",borderColor:"#1e1e2e"}}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15">
                  <Store className="w-3.5 h-3.5 text-purple-400"/>
                </div>
                <p className="text-xl font-display font-bold text-white tracking-wide">TOP STORES VISITED</p>
              </div>
              <div className="space-y-2.5">
                {shops.length>0?shops.map((s,i)=>{
                  const cnt=empVisits.filter(v=>v.shopName===s).length;
                  const maxCnt=Math.max(...shops.map(sh=>empVisits.filter(v=>v.shopName===sh).length),1);
                  return(<div key={i}>
                    <div className="flex justify-between mb-1"><span className="text-sm text-neutral-300 truncate max-w-[160px] font-medium">{s}</span><span className="text-sm font-black font-mono" style={{color:trustColor}}>{cnt}×</span></div>
                    <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${(cnt/maxCnt)*100}%`,background:`linear-gradient(to right,#0e7490,${trustColor})`,boxShadow:`0 0 6px ${trustColor}55`}}/></div>
                  </div>);
                }):<p className="text-base text-neutral-600">No store data</p>}
              </div>
              {areas.length>0&&(<div className="mt-4 pt-3 border-t border-neutral-800/80"><div className="flex flex-wrap gap-1.5">{areas.map(a=>(<span key={a} className="text-sm px-2.5 py-1 rounded-full font-semibold" style={{background:"#6d28d920",color:"#a78bfa",border:"1px solid #6d28d940"}}>{a}</span>))}</div></div>)}
            </div>

            {/* Evidence flags */}
            <div className="rounded-xl border p-4" style={{background:p.suspiciousFlags.length>0?"#1a0a0a":"#0a0a16",borderColor:p.suspiciousFlags.length>0?"#f8717128":"#1e1e2e"}}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:p.suspiciousFlags.length>0?"#f8717120":"#1e293b"}}>
                  <Zap className="w-3.5 h-3.5" style={{color:p.suspiciousFlags.length>0?"#f87171":"#64748b"}}/>
                </div>
                <p className="text-xl font-display font-bold text-white tracking-wide">REVIEW NOTES</p>
                {p.suspiciousFlags.length>0&&<span className="text-sm font-black px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">{p.suspiciousFlags.length} FLAG{p.suspiciousFlags.length>1?"S":""}</span>}
              </div>
              {p.suspiciousFlags.length>0?(
                <div className="space-y-2">
                  {p.suspiciousFlags.map((f,i)=>(<div key={i} className="flex items-start gap-2.5 px-3 py-2 rounded-lg" style={{background:"#f8717108",border:"1px solid #f8717118"}}>
                    <span className="text-red-400 mt-0.5 shrink-0 text-lg">⚡</span>
                    <span className="text-sm text-neutral-200 leading-relaxed font-medium">{f}</span>
                  </div>))}
                  {p.topRepeatedComment&&(<div className="mt-2 p-3 rounded-lg" style={{background:"#111120",border:"1px solid #2a2a3a"}}>
                    <p className="text-[12.5px] text-neutral-500 mb-1 tracking-wider font-bold">MOST-REUSED COMMENT ({p.topRepeatedComment.count}×)</p>
                    <p className="text-sm text-neutral-300 italic">"{p.topRepeatedComment.text}"</p>
                  </div>)}
                </div>
              ):(
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <CheckCircle className="w-8 h-8 text-emerald-500"/>
                  <p className="text-base font-bold text-emerald-400">No suspicious patterns detected</p>
                  <p className="text-sm text-neutral-600 text-center">All behavioural signals are within normal parameters</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ EXPORT ENGINE ════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
function exportEvidence(profiles:EmployeeProfile[], visits:VisitRow[], storeCoverage:StoreCoverageRow[], audit:{severity:string;category?:string;employee?:string;code?:string;message:string}[]){
  const wb=XLSX.utils.book_new();
  const ts=new Date().toLocaleString();

  // Executive Summary
  const s1=[
    ["FIELD VISIT COMPLIANCE & QUALITY REPORT"],
    [`Generated: ${ts}`],
    [`Total Staff: ${profiles.length} | Overall Submission Rate: ${pct(profiles.reduce((s,p)=>s+p.submittedDays,0),profiles.reduce((s,p)=>s+p.totalPossibleDays,0))}%`],
    [`Avg Integrity Score: ${Math.round(profiles.reduce((s,p)=>s+p.integrityScore,0)/Math.max(1,profiles.length))}% | At-Risk Staff: ${profiles.filter(p=>p.trustTier==="Needs Support").length}`],
    [],
    ["EMPLOYEE","CODE","DEPT","TOTAL REPORTS","UNIQUE STORES","JUNE VISITS","SUBMITTED DAYS","POSSIBLE DAYS","SUBMISSION %","QUALITY %","PATTERN SCORE","FIELD TRUST","TIER","BLANK COMMENTS","REPEATED TEXT","OFF-HOURS","UNSUPPORTED","VERIFIED VISITS","UNVERIFIED REPORTS","CHECK-IN MATCH %","SILENT VISITS","MISSING DATES (SAMPLE)"],
    ...profiles.map(p=>[p.name,p.code,p.department,p.totalReports,p.uniqueStores,p.juneTotal||p.visitCount,p.submittedDays,p.totalPossibleDays,`${p.submissionRate}%`,`${p.integrityScore}%`,p.ghostScore,`${p.fieldTrust}%`,p.trustTier,p.blankComments,p.templatedRepeats,p.lateNightCount,p.unsupportedClaims,p.hasAttendanceData?p.verifiedVisits:"n/a",p.hasAttendanceData?p.unverifiedReports:"n/a",p.hasAttendanceData?`${p.attendanceMatchRate}%`:"n/a",p.hasAttendanceData?p.silentVisits:"n/a",p.missingDates.slice(0,120)]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s1),"Executive Summary");

  // Pattern Review Analysis
  const s2=[
    ["PATTERN REVIEW ANALYSIS"],
    [`Generated: ${ts}`],[],
    ["EMPLOYEE","CODE","PATTERN SCORE","STATUS","BLANK COMMENTS","REPEATED TEXT COUNT","OFF-HOURS","UNSUPPORTED CLAIMS","SINGLE SHOP LOOP","AVG COMMENT LEN","TOP REPEATED COMMENT","FLAGS"],
    ...[...profiles].sort((a,b)=>b.ghostScore-a.ghostScore).map(p=>[p.name,p.code,p.ghostScore,ghostBadge(p.ghostScore).l,p.blankComments,p.templatedRepeats,p.lateNightCount,p.unsupportedClaims,p.singleShopLoop?"YES":"NO",p.avgCommentLen,p.topRepeatedComment?`"${p.topRepeatedComment.text.slice(0,80)}" ×${p.topRepeatedComment.count}`:"",p.suspiciousFlags.join(" | ")]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s2),"Pattern Review");

  // Store Coverage Intelligence
  const s3=[
    ["STORE COVERAGE INTELLIGENCE"],
    [`Generated: ${ts}`],[],
    ["SHOP CODE","SHOP NAME","AREA","GOVERNORATE","TOTAL VISITS","UNIQUE SPVRs","FIRST VISIT","LAST VISIT"],
    ...storeCoverage.map(s=>[s.shopCode,s.shopName,s.area,s.governorate,s.totalVisits,s.uniqueSPVRs,s.firstVisit,s.lastVisit]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s3),"Store Coverage");

  // Raw Visit Evidence
  const s4=[
    ["RAW VISIT LOG"],
    [`Generated: ${ts}`],[],
    ["DATE","SPVR CODE","SPVR NAME","SHOP CODE","SHOP NAME","AREA","GOVERNORATE","SAMSUNG SHORTAGE","COMP SHORTAGE","SELLOUT MOVEMENT","BRAND","MOVEMENT","COMMENT","ACTION 1","ACCOUNT FEEDBACK","ACTION 2"],
    ...visits.map(v=>[v.date,v.spvrCode,v.spvrName,v.shopCode,v.shopName,v.area,v.governorate,v.samsungShortage,v.compShortage,v.selloutMovement,v.brand,v.movement,v.comment,v.action1,v.accountFeedback,v.action2]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s4),"Raw Visit Evidence");

  // Audit
  const s5=[["DATA CHECK ITEMS"],[`Generated: ${ts}`],[],["PRIORITY","EMPLOYEE","CODE","CATEGORY","ITEM"],...audit.map(a=>[a.severity.toUpperCase(),a.employee||"",a.code||"",a.category||"",a.message])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s5),"Data Check");

  // Attendance Verification — system check-in cross-check, the ground-truth
  // evidence sheet. Only meaningful for staff that had attendance rows.
  const attendanceProfiles = profiles.filter(p=>p.hasAttendanceData);
  const s7=[
    ["ATTENDANCE VERIFICATION — SYSTEM CHECK-IN CROSS-CHECK"],
    [`Generated: ${ts}`],
    ["Verified = report has a matching same-day system check-in at the same shop. Unverified = report with no check-in evidence found — review before treating as confirmed. Silent = system check-in exists with no report ever filed."],
    [],
    ["EMPLOYEE","CODE","DEPARTMENT","TOTAL REPORTS","VERIFIED VISITS","UNVERIFIED REPORTS","CHECK-IN MATCH %","SILENT VISITS (NO REPORT FILED)","DRIVE-BY CHECK-INS (<3 MIN)","OPEN CHECK-INS (NO CHECKOUT)","AVG CHECK-IN DURATION (MIN)","TOTAL SYSTEM CHECK-INS"],
    ...attendanceProfiles.sort((a,b)=>a.attendanceMatchRate-b.attendanceMatchRate).map(p=>[p.name,p.code,p.department,p.visitCount,p.verifiedVisits,p.unverifiedReports,`${p.attendanceMatchRate}%`,p.silentVisits,p.ghostCheckins,p.openCheckins,p.avgCheckinDurationMin,p.attendanceCheckins]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s7),"Attendance Verification");

  // Weekly Trend — higher-resolution week-by-week breakdown per employee, for charting in Excel
  const maxWeeks = Math.max(1,...profiles.map(p=>p.weekTotals.length));
  const weekHeaders = Array.from({length:maxWeeks},(_,i)=>`WEEK ${i+1}`);
  const s6=[["WEEKLY VISIT TREND"],[`Generated: ${ts}`],[],
    ["EMPLOYEE","CODE","DEPARTMENT",...weekHeaders,"TOTAL"],
    ...profiles.map(p=>[p.name,p.code,p.department,
      ...Array.from({length:maxWeeks},(_,i)=>p.weekTotals[i]||0),
      p.weekTotals.reduce((s,v)=>s+v,0)])];
  const wsWeekly = XLSX.utils.aoa_to_sheet(s6);
  wsWeekly["!cols"] = [{wch:24},{wch:10},{wch:16},...weekHeaders.map(()=>({wch:9})),{wch:9}];
  XLSX.utils.book_append_sheet(wb,wsWeekly,"Weekly Trend");

  XLSX.writeFile(wb,`VisitCompliance_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// Export a focused workbook for a hand-picked group of employees (used by the
// checkbox / group-select feature across the dashboard tables).
function exportSelectedGroup(selected: EmployeeProfile[], visits: VisitRow[], storeCoverage: StoreCoverageRow[]) {
  if(selected.length===0) return;
  const codes = new Set(selected.map(p=>p.code));
  exportEvidence(selected, visits.filter(v=>codes.has(v.spvrCode)), storeCoverage, []);
}

// Build a mailto: draft so a manager can review/send a summary of selected
// employees straight from their own mail client — no server round-trip needed.
function draftEmailForSelected(selected: EmployeeProfile[]) {
  if(selected.length===0) return;
  const today = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  const subject = `Field Visit Quality Summary — ${selected.length} employee${selected.length>1?"s":""} — ${today}`;
  const pad=(s:string,n:number)=>{ s=(s||"").toString(); return s.length>n? s.slice(0,Math.max(0,n-1))+"…" : s.padEnd(n); };

  const lines: string[] = [];
  lines.push(`Summary of ${selected.length} employee${selected.length>1?"s":""} as of ${today}:`);
  lines.push("");
  const shown = selected.slice(0,12);
  for(const p of shown){
    lines.push(`${p.name} (${p.code}) — ${p.department}`);
    lines.push(`  Submission ${p.submissionRate}% | Quality ${p.integrityScore}% | Trust ${p.fieldTrust}% (${p.trustTier})`);
  }
  if(selected.length>shown.length) lines.push(`…and ${selected.length-shown.length} more — see the exported report for full details.`);
  lines.push("");

  // Evidence table — the exact, specific finding behind each score, laid out
  // in fixed-width columns so it stays readable as plain text in any mail
  // client. This is what a manager needs when following up with the member.
  const withFindings = selected.filter(p=>p.suspiciousFlags.length>0);
  if(withFindings.length>0){
    lines.push("EVIDENCE OF FINDINGS (for investigation / follow-up)");
    lines.push("=".repeat(78));
    lines.push(`${pad("EMPLOYEE",20)} ${pad("CODE",10)} FINDING`);
    lines.push("-".repeat(78));
    for(const p of withFindings){
      for(const f of p.suspiciousFlags.slice(0,6)){
        lines.push(`${pad(p.name,20)} ${pad(p.code,10)} ${f}`);
      }
      if(p.suspiciousFlags.length>6) lines.push(`${pad("",20)} ${pad("",10)} …and ${p.suspiciousFlags.length-6} more finding(s) for this employee`);
    }
    lines.push("-".repeat(78));
  } else {
    lines.push("No specific findings recorded for the selected employees.");
  }
  lines.push("");
  lines.push("Note: this plain-text table lines up correctly in a monospace/fixed-width font. If your mail client reflows it, the exported Excel report has the same evidence in proper table form.");
  lines.push("");
  lines.push("Sent from the SmartSense-LTD DRS Sys.");
  const body = lines.join("\n");
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ MAP PANEL ════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
// ══ MAP PANEL — compact 3D isometric Egypt with side stats panel ═════════════
// ─────────────────────────────────────────────────────────────────────────────
const GOV_POS: Record<string,{x:number;y:number;label:string}>={
  "cairo":{x:390,y:255,label:"Cairo"},"القاهرة":{x:390,y:255,label:"Cairo"},
  "giza":{x:355,y:278,label:"Giza"},"الجيزة":{x:355,y:278,label:"Giza"},
  "alexandria":{x:248,y:162,label:"Alexandria"},"الإسكندرية":{x:248,y:162,label:"Alexandria"},
  "dakahlia":{x:432,y:174,label:"Dakahlia"},"الدقهلية":{x:432,y:174,label:"Dakahlia"},
  "sharqia":{x:458,y:208,label:"Sharqia"},"الشرقية":{x:458,y:208,label:"Sharqia"},
  "sharqiyah":{x:458,y:208,label:"Sharqia"},
  "qalyubia":{x:398,y:218,label:"Qalyubia"},"القليوبية":{x:398,y:218,label:"Qalyubia"},
  "beheira":{x:288,y:198,label:"Beheira"},"البحيرة":{x:288,y:198,label:"Beheira"},
  "behira":{x:288,y:198,label:"Beheira"},
  "gharbia":{x:342,y:198,label:"Gharbia"},"الغربية":{x:342,y:198,label:"Gharbia"},
  "monufia":{x:362,y:218,label:"Monufia"},"المنوفية":{x:362,y:218,label:"Monufia"},
  "menufia":{x:362,y:218,label:"Monufia"},
  "kafr el sheikh":{x:322,y:172,label:"Kafr El Sheikh"},"كفر الشيخ":{x:322,y:172,label:"Kafr El Sheikh"},
  "kafr el shaikh":{x:322,y:172,label:"Kafr El Sheikh"},
  "port said":{x:492,y:180,label:"Port Said"},"بورسعيد":{x:492,y:180,label:"Port Said"},
  "ismailia":{x:475,y:232,label:"Ismailia"},"الإسماعيلية":{x:475,y:232,label:"Ismailia"},
  "suez":{x:482,y:268,label:"Suez"},"السويس":{x:482,y:268,label:"Suez"},
  "fayoum":{x:352,y:308,label:"Fayoum"},"الفيوم":{x:352,y:308,label:"Fayoum"},
  "faiyum":{x:352,y:308,label:"Fayoum"},
  "beni suef":{x:378,y:338,label:"Beni Suef"},"بني سويف":{x:378,y:338,label:"Beni Suef"},
  "minya":{x:388,y:380,label:"Minya"},"المنيا":{x:388,y:380,label:"Minya"},
  "assiut":{x:395,y:425,label:"Assiut"},"أسيوط":{x:395,y:425,label:"Assiut"},
  "asyut":{x:395,y:425,label:"Assiut"},
  "sohag":{x:402,y:470,label:"Sohag"},"سوهاج":{x:402,y:470,label:"Sohag"},
  "qena":{x:410,y:510,label:"Qena"},"قنا":{x:410,y:510,label:"Qena"},
  "luxor":{x:412,y:542,label:"Luxor"},"الأقصر":{x:412,y:542,label:"Luxor"},
  "aswan":{x:415,y:590,label:"Aswan"},"أسوان":{x:415,y:590,label:"Aswan"},
  "damietta":{x:448,y:155,label:"Damietta"},"دمياط":{x:448,y:155,label:"Damietta"},
  "red sea":{x:498,y:330,label:"Red Sea"},"البحر الأحمر":{x:498,y:330,label:"Red Sea"},
};

function MapPanel({visits,storeCoverage,attendanceRows=[]}:{visits:VisitRow[];storeCoverage:StoreCoverageRow[];attendanceRows?:AttendanceRow[]}){
  const [selArea,setSelArea]=useState("All");
  const [selGov,setSelGov]=useState("All");
  const [selDate,setSelDate]=useState("All");
  const [hov,setHov]=useState<string|null>(null);
  const [mapMode,setMapMode]=useState<"visits"|"stores"|"verification">("visits");

  const areas=["All",...Array.from(new Set(visits.map(v=>v.area).filter(Boolean))).sort()];
  const govs=["All",...Array.from(new Set(visits.map(v=>v.governorate).filter(Boolean))).sort()];
  const dates=["All",...Array.from(new Set(visits.map(v=>v.date.slice(0,10)))).sort()];
  const hasAttendance = attendanceRows.length>0;

  // Exact-match key set for cross-checking a visit report against a system
  // check-in — same employee, same shop, same calendar day. Used to color
  // the map by "verified reality" instead of just raw report volume.
  const attendanceKey = useMemo(()=>new Set(attendanceRows.map(a=>`${a.empCode}::${a.shopCode}::${a.date}`)),[attendanceRows]);

  const filteredVisits=visits.filter(v=>
    (selArea==="All"||v.area===selArea)&&
    (selGov==="All"||v.governorate===selGov)&&
    (selDate==="All"||v.date.slice(0,10)===selDate)
  );

  const govData=new Map<string,{count:number;label:string;x:number;y:number;spvrs:Set<string>;stores:Set<string>;verified:number;unverified:number}>();
  for(const v of filteredVisits){
    const key=(v.governorate||"").toLowerCase().trim();
    const pos=GOV_POS[key];if(!pos)continue;
    if(!govData.has(key))govData.set(key,{count:0,label:pos.label,x:pos.x,y:pos.y,spvrs:new Set(),stores:new Set(),verified:0,unverified:0});
    const d=govData.get(key)!;d.count++;d.spvrs.add(v.spvrCode);d.stores.add(v.shopCode);
    if(hasAttendance&&!isHQLocation(v.shopName)){
      const vk=`${v.spvrCode}::${v.shopCode}::${v.date.slice(0,10)}`;
      if(attendanceKey.has(vk))d.verified++; else d.unverified++;
    }
  }

  const storeGovData=new Map<string,{count:number;label:string;x:number;y:number}>();
  for(const s of storeCoverage){
    const key=s.governorate.toLowerCase().trim();const pos=GOV_POS[key];if(!pos)continue;
    if(!storeGovData.has(key))storeGovData.set(key,{count:0,label:pos.label,x:pos.x,y:pos.y});
    storeGovData.get(key)!.count+=s.totalVisits;
  }

  const activeData=mapMode==="stores"?storeGovData:govData;
  const maxCount=Math.max(...Array.from(activeData.values()).map(d=>d.count),1);

  const ledColor=(c:number)=>{
    const t=c/maxCount;
    if(t>0.66)return{fill:"#f87171",glow:"0 0 14px #f87171aa",ring:"#f8717122"};
    if(t>0.33)return{fill:"#fbbf24",glow:"0 0 14px #fbbf24aa",ring:"#fbbf2422"};
    return{fill:"#22d3ee",glow:"0 0 14px #22d3eeaa",ring:"#22d3ee22"};
  };
  // Verification mode inverts the usual read: red = LOW match rate (bad),
  // green = HIGH match rate (good) — matched against verified check-ins.
  const verColor=(verified:number,unverified:number)=>{
    const total=verified+unverified;
    if(total===0)return{fill:"#525252",glow:"none",ring:"#52525222",rate:null as number|null};
    const rate=Math.round((verified/total)*100);
    if(rate>=80)return{fill:"#34d399",glow:"0 0 14px #34d399aa",ring:"#34d39922",rate};
    if(rate>=50)return{fill:"#fbbf24",glow:"0 0 14px #fbbf24aa",ring:"#fbbf2422",rate};
    return{fill:"#f87171",glow:"0 0 14px #f87171aa",ring:"#f8717122",rate};
  };

  // Top govs for side panel
  const topGovs=Array.from(activeData.entries()).sort((a,b)=>b[1].count-a[1].count).slice(0,8);
  const totalFiltered=filteredVisits.length;

  return(
    <div className="bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/15">
            <MapPin className="w-4.5 h-4.5 text-emerald-400" style={{width:18,height:18}}/>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xl font-display font-bold text-white tracking-wide">FIELD ACTIVITY MAP</p>
              <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full pl-1.5 pr-2 py-0.5">
                <span className="relative flex w-2 h-2">
                  <span className="live-dot absolute inline-flex w-2 h-2 rounded-full bg-emerald-400"/>
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400"/>
                </span>
                <span className="text-[10.5px] font-black text-emerald-400 tracking-widest">LIVE</span>
              </span>
            </div>
            <p className="text-sm text-neutral-500">{totalFiltered.toLocaleString()} visits · {govData.size} governorates active</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-0.5 p-1 bg-neutral-800 rounded-lg border border-neutral-700">
            {(["visits","stores",...(hasAttendance?["verification"] as const:[])] as const).map(m=>(
              <button key={m} onClick={()=>setMapMode(m)} className={`text-[12.5px] px-3 py-1.5 rounded font-black capitalize tracking-wider transition-all ${mapMode===m?"bg-neutral-700 text-white":"text-neutral-500 hover:text-neutral-300"}`}>{m==="verification"?"✓ verified":m}</button>
            ))}
          </div>
          {[{val:selArea,set:setSelArea,opts:areas,ph:"All Areas"},{val:selGov,set:setSelGov,opts:govs,ph:"All Govs"},{val:selDate,set:setSelDate,opts:dates,ph:"All Dates"}].map((f,i)=>(
            <div key={i} className="relative">
              <select value={f.val} onChange={e=>f.set(e.target.value)} className="appearance-none bg-neutral-800 border border-neutral-700 text-sm font-semibold text-neutral-300 rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-emerald-500 max-w-[130px] truncate">
                {f.opts.map(o=><option key={o}>{o}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none"/>
            </div>
          ))}
        </div>
      </div>

      {/* Map + activity ticker + side panel */}
      <div className="flex flex-col lg:flex-row gap-0">

        {/* ── SVG MAP — small, contained, tilted 3D card ─────────────────── */}
        <div className="lg:w-[360px] w-full shrink-0 p-4 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-neutral-800" style={{background:"linear-gradient(135deg,#020208 0%,#060614 50%,#020208 100%)"}}>
          {/* Legend */}
          <div className="w-full flex items-center gap-3 mb-3 flex-wrap">
            {[{c:"#22d3ee",l:"Low"},{c:"#fbbf24",l:"Medium"},{c:"#f87171",l:"High"}].map(d=>(
              <div key={d.l} className="flex items-center gap-1.5 text-[11.5px] text-neutral-400 font-semibold">
                <div className="w-2 h-2 rounded-full" style={{background:d.c,boxShadow:`0 0 8px ${d.c}`}}/>
                {d.l}
              </div>
            ))}
            <span className="text-[11.5px] text-neutral-700 ml-auto font-mono">hover →</span>
          </div>

          {/* Map SVG — small 3D-tilted card so it never dominates the page */}
          <div style={{perspective:"900px",width:"100%"}}>
            <div className="rounded-2xl overflow-hidden ring-1 ring-white/5"
              style={{
                background:"linear-gradient(180deg,#020210 0%,#04041a 100%)",
                transform:"rotateX(9deg) rotateY(-3deg)",
                boxShadow:"0 25px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)",
                transition:"transform 0.3s ease",
              }}>
            <svg viewBox="200 130 360 510" width="100%" style={{maxHeight:300}} className="block">
              <defs>
                {/* Subtle grid */}
                <pattern id="mgrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5"/>
                </pattern>
                <filter id="mblur"><feGaussianBlur stdDeviation="1.5"/></filter>
              </defs>
              <rect x="200" y="130" width="360" height="510" fill="url(#mgrid)"/>

              {/* Mediterranean sea shimmer */}
              <rect x="200" y="130" width="360" height="42" fill="#0ea5e912" rx="0"/>
              <path d="M 210 158 Q 285 148 370 152 Q 440 155 555 165" stroke="#0ea5e9" strokeWidth="1.5" fill="none" strokeOpacity="0.5"/>
              <text x="285" y="148" fill="#0ea5e9" fontSize="7" opacity="0.45" fontFamily="monospace" letterSpacing="1">MEDITERRANEAN SEA</text>

              {/* Red sea dashed coast */}
              <path d="M 505 200 Q 520 270 525 360 Q 522 430 510 500" stroke="#0ea5e9" strokeWidth="1" fill="none" strokeOpacity="0.2" strokeDasharray="4 6"/>

              {/* Nile river */}
              <path d="M 415 620 Q 412 560 410 500 Q 405 430 395 370 Q 385 320 390 280 Q 392 250 375 228 Q 358 210 340 195" stroke="#1d4ed8" strokeWidth="2" fill="none" strokeOpacity="0.28" strokeDasharray="6 4"/>

              {/* Sinai peninsula hint */}
              <path d="M 480 168 Q 530 200 535 260 Q 530 300 495 330" stroke="#ffffff" strokeWidth="0.5" fill="none" strokeOpacity="0.06" strokeDasharray="3 5"/>

              {/* LED visit dots */}
              {Array.from(activeData.entries()).map(([key,d])=>{
                const gd = d as any;
                const{fill,glow,ring}=mapMode==="verification"?verColor(gd.verified||0,gd.unverified||0):ledColor(d.count);
                const r=Math.max(7,Math.min(18,7+Math.round((d.count/maxCount)*11)));
                const isH=hov===key;
                const verRate = mapMode==="verification"?verColor(gd.verified||0,gd.unverified||0).rate:null;

                return(
                  <g key={key} style={{cursor:"pointer"}} onMouseEnter={()=>setHov(key)} onMouseLeave={()=>setHov(null)}>
                    {/* Outer pulse ring */}
                    <circle cx={d.x} cy={d.y} r={r+9} fill={ring} opacity={isH?0.6:0.25} style={{transition:"all 0.2s"}}/>
                    {/* 3D ground shadow */}
                    <ellipse cx={d.x+1.5} cy={d.y+4} rx={r*0.85} ry={r*0.28} fill="#000" opacity={0.5}/>
                    {/* Main dot */}
                    <circle cx={d.x} cy={d.y} r={r} fill={fill} opacity={isH?1:0.88} style={{filter:`drop-shadow(${glow})`,transition:"r 0.15s"}}/>
                    {/* Glass shine */}
                    <circle cx={d.x-r*0.3} cy={d.y-r*0.3} r={r*0.28} fill="white" opacity={0.2}/>
                    {/* Count text */}
                    <text x={d.x} y={d.y+r*0.4} textAnchor="middle" fill="white" fontSize={r<10?6:r<14?8:9} fontFamily="monospace" fontWeight="bold">{mapMode==="verification"?(verRate!==null?`${verRate}%`:"–"):d.count}</text>
                    {/* City label */}
                    <text x={d.x} y={d.y+r+10} textAnchor="middle" fill="#9ca3af" fontSize={7} fontFamily="monospace" letterSpacing="0.3">{d.label}</text>

                    {/* Hover tooltip */}
                    {isH&&(
                      <g>
                        <rect x={d.x-58} y={d.y-r-52} width={116} height={mapMode==="verification"?54:44} rx={7} fill="#070714" stroke={fill} strokeWidth={0.8} strokeOpacity={0.8} style={{filter:"drop-shadow(0 4px 12px rgba(0,0,0,0.8))"}}/>
                        <text x={d.x} y={d.y-r-36} textAnchor="middle" fill={fill} fontSize={10} fontWeight="bold" fontFamily="monospace">{d.label}</text>
                        <text x={d.x} y={d.y-r-22} textAnchor="middle" fill="#e5e5e5" fontSize={8.5} fontFamily="monospace">{d.count} visits</text>
                        {'spvrs' in d&&<text x={d.x} y={d.y-r-10} textAnchor="middle" fill="#737373" fontSize={7.5} fontFamily="monospace">{(d as any).spvrs?.size} SPVRs · {(d as any).stores?.size} shops</text>}
                        {mapMode==="verification"&&<text x={d.x} y={d.y-r+2} textAnchor="middle" fill="#a3a3a3" fontSize={7.5} fontFamily="monospace">{gd.verified} verified · {gd.unverified} unverified</text>}
                      </g>
                    )}
                  </g>
                );
              })}

              {activeData.size===0&&(
                <text x="380" y="390" textAnchor="middle" fill="#404040" fontSize="11" fontFamily="monospace">No data for selected filters</text>
              )}
            </svg>
            </div>
          </div>
          {/* Mini radar-sweep scanning badge — small, decorative, signals "live" scanning */}
          <div className="w-full flex items-center justify-center gap-2 mt-3">
            <div className="relative w-5 h-5 rounded-full flex items-center justify-center" style={{background:"radial-gradient(circle,#052e2b 0%,#020208 70%)",border:"1px solid #34d39940"}}>
              <div className="radar-sweep absolute inset-0 rounded-full" style={{background:"conic-gradient(from 0deg,#34d39900 0%,#34d39970 12%,#34d39900 24%)"}}/>
              <div className="w-1 h-1 rounded-full bg-emerald-400" style={{boxShadow:"0 0 4px #34d399"}}/>
            </div>
            <span className="text-[11.5px] text-neutral-600 font-mono tracking-wide">scanning {mapMode} across Egypt</span>
          </div>
        </div>

        {/* ── ACTIVITY PULSE — freed-up space: rolling feed of most recent visits ── */}
        <div className="flex-1 min-w-0 border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col" style={{background:"#03030a"}}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
            <Activity className="w-3.5 h-3.5 text-purple-400"/>
            <p className="text-sm font-display font-bold text-white tracking-wide">ACTIVITY PULSE</p>
            <span className="text-[11.5px] text-neutral-600 font-mono ml-auto">most recent first</span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[300px] lg:max-h-[360px] divide-y divide-neutral-800/70">
            {[...filteredVisits].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14).map((v,i)=>(
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-neutral-800/30 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-purple-400" style={{boxShadow:"0 0 6px #a78bfa"}}/>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-neutral-200 truncate">{v.shopName||v.shopCode}</p>
                  <p className="text-[11.5px] text-neutral-600 font-mono truncate">{v.spvrName} · {v.governorate}</p>
                </div>
                <span className="text-[11.5px] text-neutral-500 font-mono shrink-0">{v.date.slice(5,16)}</span>
              </div>
            ))}
            {filteredVisits.length===0&&(
              <p className="text-sm text-neutral-600 text-center py-8">No visits for the selected filters</p>
            )}
          </div>
        </div>

        {/* ── SIDE STATS PANEL ──────────────────────────────────────────── */}
        <div className="w-full lg:w-64 border-t lg:border-t-0 lg:border-l border-neutral-800 flex flex-col" style={{background:"#050510"}}>
          {/* Summary KPIs */}
          <div className="p-4 border-b border-neutral-800 grid grid-cols-2 gap-2">
            {[
              {label:"TOTAL VISITS",val:totalFiltered.toLocaleString(),color:"#22d3ee"},
              {label:"GOVERNORATES",val:govData.size,color:"#a78bfa"},
              {label:"SPVRs ACTIVE",val:new Set(filteredVisits.map(v=>v.spvrCode)).size,color:"#34d399"},
              {label:"SHOPS COVERED",val:new Set(filteredVisits.map(v=>v.shopCode)).size,color:"#fbbf24"},
            ].map(k=>(
              <div key={k.label} className="rounded-xl p-2.5" style={{background:"#0d0d1a",border:`1px solid ${k.color}20`}}>
                <p className="text-[11.5px] text-neutral-600 tracking-wider font-black mb-0.5">{k.label}</p>
                <p className="text-xl font-black font-mono" style={{color:k.color}}>{k.val}</p>
              </div>
            ))}
          </div>

          {/* Top governorates ranking */}
          <div className="p-4 flex-1">
            <p className="text-sm text-neutral-500 tracking-widest font-black mb-3">{mapMode==="verification"?"CHECK-IN MATCH BY GOVERNORATE":"TOP GOVERNORATES"}</p>
            <div className="space-y-2.5">
              {topGovs.map(([key,d],i)=>{
                const gd=d as any;
                const vc = mapMode==="verification"?verColor(gd.verified||0,gd.unverified||0):null;
                const{fill}=mapMode==="verification"?{fill:vc!.fill}:ledColor(d.count);
                const barPct=mapMode==="verification"?(vc!.rate??0):Math.round((d.count/maxCount)*100);
                return(
                  <div key={key} className="cursor-pointer hover:opacity-90 transition-opacity" onClick={()=>setSelGov(d.label)}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-black text-neutral-600 font-mono w-4">#{i+1}</span>
                        <span className="text-sm font-bold text-neutral-200">{d.label}</span>
                      </div>
                      <span className="text-sm font-black font-mono" style={{color:fill}}>{mapMode==="verification"?(vc!.rate!==null?`${vc!.rate}%`:"–"):d.count}</span>
                    </div>
                    <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{width:`${barPct}%`,background:`linear-gradient(to right,${fill}88,${fill})`,boxShadow:`0 0 6px ${fill}55`}}/>
                    </div>
                    {mapMode==="verification"&&<p className="text-[11px] text-neutral-600 mt-0.5">{gd.verified} verified · {gd.unverified} unverified</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Color legend pills at bottom */}
          <div className="p-4 border-t border-neutral-800">
            <p className="text-[12.5px] text-neutral-600 tracking-widest font-black mb-2">{mapMode==="verification"?"CHECK-IN MATCH SCALE":"DENSITY SCALE"}</p>
            <div className="space-y-1.5">
              {(mapMode==="verification"
                ?[{c:"#34d399",l:"Strong",d:"≥80% verified"},{c:"#fbbf24",l:"Mixed",d:"50–79%"},{c:"#f87171",l:"Weak",d:"<50% verified"}]
                :[{c:"#f87171",l:"High",d:">66% of max"},{c:"#fbbf24",l:"Medium",d:"33–66%"},{c:"#22d3ee",l:"Low",d:"<33%"}]
              ).map(x=>(
                <div key={x.l} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:x.c,boxShadow:`0 0 6px ${x.c}`}}/>
                  <span className="text-sm font-bold text-neutral-300">{x.l}</span>
                  <span className="text-sm text-neutral-600 ml-auto">{x.d}</span>
                </div>
              ))}
            </div>
            {mapMode==="verification"&&<p className="text-[11px] text-neutral-600 mt-2 leading-relaxed">Verified = same employee, same shop, same day check-in found in Attendance_time.xlsx. A low score is worth reviewing, not an automatic verdict — shop-code mismatches can also cause a miss.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ MAIN PAGE ════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
export default function VisitCompliancePage(){
  // Raw parsed data
  const [empSummary,setEmpSummary]=useState<EmployeeSummaryRow[]>([]);
  const [visits,setVisits]=useState<VisitRow[]>([]);
  const [storeCoverage,setStoreCoverage]=useState<StoreCoverageRow[]>([]);
  const [submissionMap,setSubmissionMap]=useState<Map<string,SubmissionRow>>(new Map());
  const [weeklyMap,setWeeklyMap]=useState<Map<string,WeeklySummaryRow>>(new Map());
  const [attendanceRows,setAttendanceRows]=useState<AttendanceRow[]>([]);
  const [files,setFiles]=useState<LoadedFile[]>([]);
  const [isDragging,setIsDragging]=useState(false);
  const [isProcessing,setIsProcessing]=useState(false);
  // UI
  const [section,setSection]=useState<"dashboard"|"map"|"stores">("dashboard");
  const [lowestTab,setLowestTab]=useState<"trust"|"ghost">("trust");
  const [deptFilter,setDeptFilter]=useState("All");
  const [empSearch,setEmpSearch]=useState("");
  const [scorecardEmp,setScorecardEmp]=useState<EmployeeProfile|null>(null);
  const [selectedCodes,setSelectedCodes]=useState<Set<string>>(new Set());
  const [now,setNow]=useState<Date>(new Date());

  useEffect(()=>{
    const t=setInterval(()=>setNow(new Date()),1000);
    return ()=>clearInterval(t);
  },[]);

  const toggleSelected=useCallback((code:string)=>{
    setSelectedCodes(prev=>{
      const next=new Set(prev);
      if(next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  },[]);

  const handleFiles=useCallback(async(fileList:FileList)=>{
    setIsProcessing(true);
    const newLoaded:LoadedFile[]=[];
    let nEmp:EmployeeSummaryRow[]|null=null, nVisits:VisitRow[]|null=null;
    let nStore:StoreCoverageRow[]|null=null;
    let nSub:Map<string,SubmissionRow>|null=null, nWeekly:Map<string,WeeklySummaryRow>|null=null;
    let nAttendance:AttendanceRow[]|null=null;
    for(const file of Array.from(fileList)){
      try{
        const buf=await file.arrayBuffer();
        const wb=XLSX.read(buf,{type:"array"});
        const kind=detectKind(wb.SheetNames,file.name);
        const rows=(ws:any)=>XLSX.utils.sheet_to_json(ws,{header:1,defval:null}) as any[][];
        if(kind==="employee_summary"){const ws=wb.Sheets["Employee Summary"]||wb.Sheets[wb.SheetNames[0]];const r=rows(ws);nEmp=parseEmployeeSummary(r);newLoaded.push({name:file.name,kind,size:fmtB(file.size),rows:r.length-1});}
        else if(kind==="mobile_dep"){const ws=wb.Sheets["Mobile"]||wb.Sheets[wb.SheetNames[0]];const r=rows(ws);nVisits=parseMobileDep(r);newLoaded.push({name:file.name,kind,size:fmtB(file.size),rows:nVisits.length});}
        else if(kind==="store_coverage"){const ws=wb.Sheets["Store Coverage"]||wb.Sheets[wb.SheetNames[0]];const r=rows(ws);nStore=parseStoreCoverage(r);newLoaded.push({name:file.name,kind,size:fmtB(file.size),rows:nStore.length});}
        else if(kind==="submission_matrix"){const ws=wb.Sheets["Submission Matrix"]||wb.Sheets[wb.SheetNames[0]];const r=rows(ws);nSub=parseSubmissionMatrix(r);newLoaded.push({name:file.name,kind,size:fmtB(file.size),rows:nSub.size});}
        else if(kind==="weekly_summary"){const ws=wb.Sheets["Weekly Summary"]||wb.Sheets[wb.SheetNames[0]];const r=rows(ws);nWeekly=parseWeeklySummary(r);newLoaded.push({name:file.name,kind,size:fmtB(file.size),rows:nWeekly.size});}
        else if(kind==="attendance_time"){const ws=wb.Sheets["Attendance time"]||wb.Sheets[wb.SheetNames[0]];const r=rows(ws);nAttendance=parseAttendanceTime(r);newLoaded.push({name:file.name,kind,size:fmtB(file.size),rows:nAttendance.length});}
        else{newLoaded.push({name:file.name,kind:"unknown",size:fmtB(file.size),rows:0});}
      }catch(e){newLoaded.push({name:file.name,kind:"unknown",size:"—",rows:0});}
    }
    setFiles(prev=>{const ex=new Set(prev.map(f=>f.name));return[...prev,...newLoaded.filter(f=>!ex.has(f.name))];});
    if(nEmp) setEmpSummary(nEmp);
    if(nVisits) setVisits(nVisits);
    if(nStore) setStoreCoverage(nStore);
    if(nSub) setSubmissionMap(nSub);
    if(nWeekly) setWeeklyMap(nWeekly);
    if(nAttendance) setAttendanceRows(nAttendance);
    setIsProcessing(false);
  },[]);

  const profiles=useMemo(()=>buildProfiles(empSummary,visits,storeCoverage,submissionMap,weeklyMap,attendanceRows),[empSummary,visits,storeCoverage,submissionMap,weeklyMap,attendanceRows]);

  const audit=useMemo(()=>{
    const issues:{severity:"high"|"medium";category:string;employee:string;code:string;message:string}[]=[];
    const seen=new Set<string>();
    for(const p of profiles){
      if(seen.has(p.code))issues.push({severity:"high",category:"Duplicate Code",employee:p.name,code:p.code,message:`Employee code ${p.code} appears more than once in the roster`});
      seen.add(p.code);
      if(!submissionMap.has(p.code))issues.push({severity:"medium",category:"Missing Source Data",employee:p.name,code:p.code,message:"Missing from Submission Matrix"});
      if(!weeklyMap.has(p.code))issues.push({severity:"medium",category:"Missing Source Data",employee:p.name,code:p.code,message:"Missing from Weekly Summary"});
      if(p.totalPossibleDays>0&&p.submittedDays===0)issues.push({severity:"high",category:"Zero Submissions",employee:p.name,code:p.code,message:"Zero days submitted in the entire period"});
      if(p.unsupportedClaims>0)issues.push({severity:"high",category:"Unsupported Claims",employee:p.name,code:p.code,message:`${p.unsupportedClaims} shortage/movement claim${p.unsupportedClaims>1?"s":""} with a blank comment`});
      if(p.lateNightCount>p.visitCount*0.6&&p.visitCount>=4)issues.push({severity:"high",category:"Off-Hours Filing",employee:p.name,code:p.code,message:`${p.lateNightCount}/${p.visitCount} reports filed outside the 1 PM–9 PM visit window`});
      if(p.fridayVisits>0)issues.push({severity:"medium",category:"Day-Off Filing",employee:p.name,code:p.code,message:`${p.fridayVisits} report${p.fridayVisits>1?"s":""} logged on Friday, the weekly day off`});
      if(p.topRepeatedComment&&p.topRepeatedComment.count>=4)issues.push({severity:"medium",category:"Repeated Text",employee:p.name,code:p.code,message:`Same text reused ${p.topRepeatedComment.count}× — "${p.topRepeatedComment.text.slice(0,60)}"`});
      if(p.hasAttendanceData&&p.attendanceMatchRate<50&&p.visitCount>=3)issues.push({severity:"high",category:"Unverified Visits",employee:p.name,code:p.code,message:`Only ${p.attendanceMatchRate}% of filed reports have a matching system check-in (${p.unverifiedReports} unverified)`});
      if(p.silentVisits>=3)issues.push({severity:"medium",category:"Undocumented Visits",employee:p.name,code:p.code,message:`${p.silentVisits} system check-ins with no report ever filed for that shop/day`});
      if(p.ghostCheckins>=2)issues.push({severity:"medium",category:"Drive-by Check-ins",employee:p.name,code:p.code,message:`${p.ghostCheckins} check-ins lasted under 3 minutes`});
    }
    return issues;
  },[profiles,submissionMap,weeklyMap]);

  const departments=["All",...Array.from(new Set(profiles.map(p=>p.department)))];
  const filteredProfiles=useMemo(()=>{
    let b=deptFilter==="All"?profiles:profiles.filter(p=>p.department===deptFilter);
    if(empSearch) b=b.filter(p=>p.name.toLowerCase().includes(empSearch.toLowerCase())||p.code.toLowerCase().includes(empSearch.toLowerCase()));
    return b;
  },[profiles,deptFilter,empSearch]);

  const overallSubmission=pct(profiles.reduce((s,p)=>s+p.submittedDays,0),profiles.reduce((s,p)=>s+p.totalPossibleDays,0));
  const avgIntegrity=Math.round(profiles.reduce((s,p)=>s+p.integrityScore,0)/Math.max(1,profiles.length));
  const atRisk=profiles.filter(p=>p.trustTier==="Needs Support").length;
  const hasAttendance = attendanceRows.length>0;
  const attendanceStaffCovered = profiles.filter(p=>p.hasAttendanceData).length;
  const totalVerified = profiles.reduce((s,p)=>s+p.verifiedVisits,0);
  const totalUnverified = profiles.reduce((s,p)=>s+p.unverifiedReports,0);
  const totalSilent = profiles.reduce((s,p)=>s+p.silentVisits,0);
  const totalGhostCheckins = profiles.reduce((s,p)=>s+p.ghostCheckins,0);
  const overallMatchRate = pct(totalVerified, totalVerified+totalUnverified);
  const teamsWithMismatch = profiles.filter(p=>p.hasAttendanceData&&(p.unverifiedReports>0||p.silentVisits>0)).sort((a,b)=>(b.unverifiedReports+b.silentVisits)-(a.unverifiedReports+a.silentVisits));
  const totalVisitsAll=visits.length;
  const totalStoresAll=storeCoverage.length;

  const statusBuckets=useMemo(()=>[
    {name:"Healthy",value:profiles.filter(p=>p.trustTier==="Healthy").length,color:"#34d399"},
    {name:"Watch",value:profiles.filter(p=>p.trustTier==="Watch").length,color:"#fbbf24"},
    {name:"Needs Support",value:profiles.filter(p=>p.trustTier==="Needs Support").length,color:"#f87171"},
  ],[profiles]);

  const dailyTrend=useMemo(()=>{const m=new Map<string,number>();for(const v of visits)m.set(v.date.slice(0,10),(m.get(v.date.slice(0,10))||0)+1);return Array.from(m.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([d,c])=>({date:d.slice(5),count:c}));},[visits]);
  const avgVolume=dailyTrend.length>0?Math.round(dailyTrend.reduce((s,d)=>s+d.count,0)/dailyTrend.length):0;

  const deptRollup=useMemo(()=>Array.from(new Set(profiles.map(p=>p.department))).map(dept=>{
    const m=profiles.filter(p=>p.department===dept);
    return{dept,headcount:m.length,compliance:pct(m.reduce((s,p)=>s+p.submittedDays,0),m.reduce((s,p)=>s+p.totalPossibleDays,0)),chronic:m.filter(p=>p.submissionRate<50).length,avgIntegrity:Math.round(m.reduce((s,p)=>s+p.integrityScore,0)/m.length),avgTrust:Math.round(m.reduce((s,p)=>s+p.fieldTrust,0)/m.length)};
  }).sort((a,b)=>b.compliance-a.compliance),[profiles]);

  const ghostRanking=useMemo(()=>[...profiles].sort((a,b)=>b.ghostScore-a.ghostScore),[profiles]);
  const lowestTrust=[...profiles].sort((a,b)=>a.fieldTrust-b.fieldTrust);
  const hasData=profiles.length>0;

  const kindLabel:Record<FileKind,string>={employee_summary:"Employee Summary",mobile_dep:"Mobile Visits",store_coverage:"Store Coverage",submission_matrix:"Submission Matrix",weekly_summary:"Weekly Summary",attendance_time:"Attendance (System Check-ins)",unknown:"Unrecognised"};
  const kindColor:Record<FileKind,string>={employee_summary:"text-cyan-400",mobile_dep:"text-purple-400",store_coverage:"text-emerald-400",submission_matrix:"text-amber-400",weekly_summary:"text-blue-400",attendance_time:"text-rose-400",unknown:"text-red-400"};

  return(
    <div className="p-4 sm:p-6 space-y-5 max-w-full" style={{fontFamily:"'Inter',ui-sans-serif,system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .font-display{font-family:'Space Grotesk',ui-sans-serif,sans-serif;}
        .font-mono{font-family:'JetBrains Mono',ui-monospace,monospace !important;}
        @keyframes livePulse{0%{box-shadow:0 0 0 0 rgba(52,211,153,0.55);}70%{box-shadow:0 0 0 9px rgba(52,211,153,0);}100%{box-shadow:0 0 0 0 rgba(52,211,153,0);}}
        @keyframes radarSweep{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
        .live-dot{animation:livePulse 2s infinite;}
        .radar-sweep{animation:radarSweep 3.5s linear infinite;transform-origin:50% 50%;}
      `}</style>

      {/* SCORECARD */}
      {scorecardEmp&&<ScorecardModal p={scorecardEmp} visits={visits} storeCoverage={storeCoverage} onClose={()=>setScorecardEmp(null)}/>}

      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1.5 h-11 rounded-full" style={{background:"linear-gradient(to bottom,#22d3ee,#a855f7,#f87171)"}}/>
            <div>
              <h1 className="font-display text-3xl font-extrabold text-white tracking-wide leading-tight">FIELD COMPLIANCE & QUALITY DASHBOARD</h1>
              <p className="text-base text-neutral-400 mt-1 font-medium">SMARTSENSE-LTD DRS SYS</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Digital date & clock readout */}
          <div className="flex items-center gap-2.5 bg-neutral-900/80 border border-neutral-800 rounded-xl px-3.5 py-2" style={{boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03), 0 4px 12px rgba(0,0,0,0.4)"}}>
            <span className="relative flex w-1.5 h-1.5">
              <span className="live-dot absolute inline-flex w-1.5 h-1.5 rounded-full bg-cyan-400"/>
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-cyan-400"/>
            </span>
            <div className="leading-tight">
              <p className="font-mono text-lg font-bold text-cyan-300 tracking-wider tabular-nums" style={{textShadow:"0 0 12px rgba(34,211,238,0.45)"}}>
                {now.toLocaleTimeString("en-GB",{hour12:false})}
              </p>
              <p className="text-[11.5px] text-neutral-500 font-mono tracking-wide">
                {now.toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"})}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
          {hasData&&(<button onClick={()=>exportEvidence(profiles,visits,storeCoverage,audit)}
            className="flex items-center gap-2 text-sm font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl hover:bg-emerald-500/20 transition-colors">
            <Download className="w-3.5 h-3.5"/>Export Report
          </button>)}
          {files.length>0&&(<button onClick={()=>{setFiles([]);setEmpSummary([]);setVisits([]);setStoreCoverage([]);setSubmissionMap(new Map());setWeeklyMap(new Map());}}
            className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-xl hover:bg-red-500/20 transition-colors">Clear all</button>)}
        </div>
        </div>
      </div>

      {/* UPLOAD */}
      <div onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)}
        onDrop={e=>{e.preventDefault();setIsDragging(false);if(e.dataTransfer.files.length)handleFiles(e.dataTransfer.files);}}
        className={`relative border-2 border-dashed rounded-xl p-7 text-center transition-all ${isDragging?"border-cyan-500 bg-cyan-500/5":"border-neutral-700 hover:border-neutral-600 bg-neutral-900"}`}>
        <input type="file" accept=".xlsx,.xls" multiple onChange={e=>{if(e.target.files?.length)handleFiles(e.target.files);}} className="absolute inset-0 opacity-0 cursor-pointer"/>
        <Upload className={`w-8 h-8 mx-auto mb-2.5 ${isDragging?"text-cyan-400":"text-neutral-500"}`}/>
        <p className="text-base font-bold text-white mb-1">Drop all 6 files here — or click to browse</p>
        <div className="flex flex-wrap justify-center gap-2 text-sm">
          {[{label:"Employee_Summary.xlsx",color:"text-cyan-400"},{label:"Mobile_Dep.xlsx",color:"text-purple-400"},{label:"Store_Coverage.xlsx",color:"text-emerald-400"},{label:"Submission_Matrix.xlsx",color:"text-amber-400"},{label:"Weekly_Summary.xlsx",color:"text-blue-400"},{label:"Attendance_time.xlsx",color:"text-rose-400"}].map(f=>(<span key={f.label} className={`font-mono ${f.color}`}>{f.label}</span>))}
        </div>
        <p className="text-sm text-rose-400/80 mt-2 flex items-center justify-center gap-1"><Fingerprint className="w-3 h-3"/>Attendance_time.xlsx is the system check-in log — it becomes the ground-truth signal every other file gets cross-checked against</p>
        {isProcessing&&<div className="mt-3 flex items-center justify-center gap-2 text-sm text-cyan-400"><RefreshCw className="w-3.5 h-3.5 animate-spin"/>Parsing workbooks…</div>}
      </div>

      {/* FILE CHIPS */}
      {files.length>0&&(
        <div className="flex flex-wrap gap-2">
          {files.map(f=>(<div key={f.name} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-900 text-sm">
            <FileSpreadsheet className={`w-3.5 h-3.5 ${kindColor[f.kind]}`}/>
            <span className="text-neutral-300 max-w-[160px] truncate">{f.name}</span>
            <span className="text-neutral-600">{f.size}</span>
            <span className={`${kindColor[f.kind]} font-semibold`}>{kindLabel[f.kind]}</span>
            <span className="text-neutral-600 font-mono">{f.rows}r</span>
          </div>))}
        </div>
      )}

      {!hasData&&files.length===0&&(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            {icon:Users,color:"cyan",title:"Employee Summary",desc:"SPVR profiles, total reports, unique stores, activity dates"},
            {icon:Activity,color:"purple",title:"Mobile Dep",desc:"Raw daily visits — comments, shortage claims, brands, actions"},
            {icon:Store,color:"emerald",title:"Store Coverage",desc:"Shop-level visit counts, SPVR reach, first/last visit dates"},
            {icon:CheckCircle,color:"amber",title:"Submission Matrix",desc:"Daily submission timestamps, missing date audit trail"},
            {icon:Calendar,color:"blue",title:"Weekly Summary",desc:"Week-by-week visit counts, June performance grid"},
            {icon:Fingerprint,color:"rose",title:"Attendance Time",desc:"System check-in log (app/GPS) — the ground-truth evidence layer"},
          ].map((c,i)=>(<div key={i} className={`bg-neutral-900 border border-${c.color}-500/25 rounded-xl p-4`}>
            <c.icon className={`w-5 h-5 mb-2 text-${c.color}-400`}/>
            <p className="text-white font-bold text-base mb-1">{c.title}</p>
            <p className="text-sm text-neutral-500 leading-relaxed">{c.desc}</p>
          </div>))}
        </div>
      )}

      {/* NAV */}
      {hasData&&(
        <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-700 rounded-xl w-fit">
          {([["dashboard","📊 Dashboard"],["map","🗺️ Field Map"],["stores","🏪 Stores"]] as const).map(([id,label])=>(
            <button key={id} onClick={()=>setSection(id)} className={`text-sm px-4 py-2 rounded-lg font-bold tracking-wide transition-all ${section===id?"bg-neutral-700 text-white":"text-neutral-500 hover:text-neutral-300"}`}>{label}</button>
          ))}
        </div>
      )}

      {/* ══ MAP ══════════════════════════════════════════════════════════════ */}
      {hasData&&section==="map"&&<MapPanel visits={visits} storeCoverage={storeCoverage} attendanceRows={attendanceRows}/>}

      {/* ══ STORES ═══════════════════════════════════════════════════════════ */}
      {hasData&&section==="stores"&&(
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700">
            <div className="flex items-center gap-2"><Store className="w-4 h-4 text-emerald-400"/><span className="text-sm text-neutral-300 font-semibold tracking-wider">STORE COVERAGE INTELLIGENCE — {storeCoverage.length} SHOPS</span></div>
            <span className="text-sm text-neutral-500">{Array.from(new Set(storeCoverage.map(s=>s.governorate))).length} governorates</span>
          </div>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-neutral-800">
            {[
              {label:"TOTAL STORES",val:storeCoverage.length,color:"text-white"},
              {label:"TOTAL VISITS",val:storeCoverage.reduce((s,st)=>s+st.totalVisits,0),color:"text-cyan-400"},
              {label:"AVG VISITS/STORE",val:Math.round(storeCoverage.reduce((s,st)=>s+st.totalVisits,0)/Math.max(1,storeCoverage.length)),color:"text-purple-400"},
              {label:"MAX VISITS (1 STORE)",val:Math.max(...storeCoverage.map(s=>s.totalVisits)),color:"text-amber-400"},
            ].map(k=>(<div key={k.label} className="bg-neutral-800/60 rounded-xl p-3 border border-neutral-700/50">
              <p className="text-[12.5px] text-neutral-500 tracking-wider font-bold mb-1">{k.label}</p>
              <p className={`text-3xl font-black font-mono ${k.color}`}>{k.val.toLocaleString()}</p>
            </div>))}
          </div>
          {/* Store table */}
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-base">
              <thead><tr className="text-sm text-neutral-500 border-b border-neutral-800 sticky top-0 bg-neutral-900">
                {["SHOP CODE","SHOP NAME","AREA","GOVERNORATE","TOTAL VISITS","UNIQUE SPVRs","FIRST VISIT","LAST VISIT","ACTIVITY"].map(h=>(<th key={h} className="text-left py-2.5 px-3 font-semibold tracking-wider whitespace-nowrap">{h}</th>))}
              </tr></thead>
              <tbody>{storeCoverage.sort((a,b)=>b.totalVisits-a.totalVisits).map(s=>{
                const actColor=s.totalVisits>=5?"text-emerald-400":s.totalVisits>=2?"text-amber-400":"text-red-400";
                const daysSinceFirst=s.firstVisit&&s.lastVisit?Math.round((new Date(s.lastVisit).getTime()-new Date(s.firstVisit).getTime())/86400000):0;
                return(<tr key={s.shopCode} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
                  <td className="py-2 px-3 font-mono text-cyan-400 text-sm">{s.shopCode}</td>
                  <td className="py-2 px-3 text-white text-sm font-medium">{s.shopName}</td>
                  <td className="py-2 px-3 text-neutral-400 text-sm">{s.area||"—"}</td>
                  <td className="py-2 px-3 text-neutral-400 text-sm">{s.governorate}</td>
                  <td className={`py-2 px-3 font-mono font-bold text-sm text-center ${actColor}`}>{s.totalVisits}</td>
                  <td className="py-2 px-3 font-mono text-neutral-300 text-sm text-center">{s.uniqueSPVRs}</td>
                  <td className="py-2 px-3 text-neutral-500 text-sm">{s.firstVisit}</td>
                  <td className="py-2 px-3 text-neutral-500 text-sm">{s.lastVisit}</td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-0.5">{Array.from({length:5}).map((_,i)=>(<div key={i} className={`w-2 h-2 rounded-sm ${i<Math.min(5,s.totalVisits)?"bg-cyan-500":"bg-neutral-700"}`}/>))}</div>
                  </td>
                </tr>);
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ DASHBOARD ════════════════════════════════════════════════════════ */}
      {hasData&&section==="dashboard"&&(<>

        {/* KPI ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {label:"STAFF",val:profiles.length,sub:"",color:"text-white",border:"border-neutral-700",icon:Users},
            {label:"SUBMISSION",val:`${overallSubmission}%`,sub:"rate",color:compColor(overallSubmission),border:"border-emerald-500/20",icon:overallSubmission>=70?TrendingUp:TrendingDown},
            {label:"AVG QUALITY",val:`${avgIntegrity}%`,sub:"",color:intgColor(avgIntegrity),border:"border-cyan-500/20",icon:Gauge},
            {label:"NEEDS SUPPORT",val:atRisk,sub:"staff",color:"text-red-400",border:"border-red-500/20",icon:ShieldAlert},
            {label:"TOTAL VISITS",val:totalVisitsAll.toLocaleString(),sub:"raw visits",color:"text-purple-400",border:"border-purple-500/20",icon:Activity},
            {label:"STORES COVERED",val:totalStoresAll.toLocaleString(),sub:"shops",color:"text-emerald-400",border:"border-emerald-500/20",icon:Store},
          ].map(k=>(<div key={k.label} className={`bg-neutral-900 border ${k.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2"><span className="text-[12.5px] text-neutral-400 tracking-wider font-bold">{k.label}</span><k.icon className={`w-4 h-4 ${k.color}`}/></div>
            <p className={`text-3xl font-black font-mono ${k.color}`}>{k.val}</p>
            {k.sub&&<p className="text-[12.5px] text-neutral-600 mt-0.5">{k.sub}</p>}
          </div>))}
        </div>

        {/* ATTENDANCE VERIFICATION PANEL — cross-checks filed reports against the
            system's own GPS/app check-in log. This is the strongest evidence
            layer in the dashboard: everything else here is the rep's own
            typed text, this is the phone/app telling us where they actually
            stood. A miss here still deserves a quick look rather than an
            automatic verdict — shop-code typos and date-boundary edge cases
            can also cause a non-match. */}
        {hasAttendance?(
          <div className="bg-neutral-900 border border-rose-500/25 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
              <div className="flex items-center gap-2"><Fingerprint className="w-4 h-4 text-rose-400"/><span className="text-sm text-neutral-300 font-semibold tracking-wider">ATTENDANCE VERIFICATION — SYSTEM CHECK-IN CROSS-CHECK</span></div>
              <span className="text-sm text-neutral-500">{attendanceStaffCovered}/{profiles.length} staff have attendance data</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 border-b border-neutral-800">
              {[
                {label:"CHECK-IN MATCH RATE",val:`${overallMatchRate}%`,color:compColor(overallMatchRate),icon:ShieldCheck},
                {label:"VERIFIED VISITS",val:totalVerified.toLocaleString(),color:"text-emerald-400",icon:CheckCircle},
                {label:"UNVERIFIED REPORTS",val:totalUnverified.toLocaleString(),color:"text-red-400",icon:ShieldAlert},
                {label:"SILENT VISITS",val:totalSilent.toLocaleString(),color:"text-amber-400",icon:FileWarning},
                {label:"DRIVE-BY CHECK-INS",val:totalGhostCheckins.toLocaleString(),color:"text-orange-400",icon:Zap},
                {label:"SYSTEM CHECK-INS",val:attendanceRows.length.toLocaleString(),color:"text-rose-400",icon:Fingerprint},
              ].map(k=>(<div key={k.label} className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5"><span className="text-[11px] text-neutral-500 tracking-wider font-bold">{k.label}</span><k.icon className={`w-3.5 h-3.5 ${k.color}`}/></div>
                <p className={`text-xl font-black font-mono ${k.color}`}>{k.val}</p>
              </div>))}
            </div>
            <div className="px-4 py-2 text-sm text-neutral-500 border-b border-neutral-800">
              <span className="text-neutral-400 font-semibold">Verified</span> = report has a matching same-day check-in at the same shop · <span className="text-red-400 font-semibold">Unverified</span> = report with no check-in evidence · <span className="text-amber-400 font-semibold">Silent</span> = system shows a check-in but no report was ever filed for it
            </div>
            {teamsWithMismatch.length>0?(
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-neutral-800 text-neutral-500">
                    <th className="text-left py-2 px-4 font-semibold text-[11px] tracking-wider">EMPLOYEE</th>
                    <th className="text-right py-2 px-4 font-semibold text-[11px] tracking-wider">REPORTS</th>
                    <th className="text-right py-2 px-4 font-semibold text-[11px] tracking-wider">VERIFIED</th>
                    <th className="text-right py-2 px-4 font-semibold text-[11px] tracking-wider">UNVERIFIED</th>
                    <th className="text-right py-2 px-4 font-semibold text-[11px] tracking-wider">MATCH %</th>
                    <th className="text-right py-2 px-4 font-semibold text-[11px] tracking-wider">SILENT VISITS</th>
                  </tr></thead>
                  <tbody>
                    {teamsWithMismatch.slice(0,12).map(p=>(
                      <tr key={p.code} className="border-b border-neutral-900 hover:bg-neutral-800/40 cursor-pointer" onClick={()=>setScorecardEmp(p)}>
                        <td className="py-2 px-4"><span className="text-white font-medium">{p.name}</span><span className="text-neutral-600 font-mono ml-2 text-[11px]">{p.code}</span></td>
                        <td className="text-right py-2 px-4 font-mono text-neutral-300">{p.visitCount}</td>
                        <td className="text-right py-2 px-4 font-mono text-emerald-400">{p.verifiedVisits}</td>
                        <td className={`text-right py-2 px-4 font-mono font-bold ${p.unverifiedReports>0?"text-red-400":"text-neutral-600"}`}>{p.unverifiedReports}</td>
                        <td className={`text-right py-2 px-4 font-mono font-bold ${compColor(p.attendanceMatchRate)}`}>{p.attendanceMatchRate}%</td>
                        <td className={`text-right py-2 px-4 font-mono ${p.silentVisits>0?"text-amber-400":"text-neutral-600"}`}>{p.silentVisits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ):(<div className="p-5 text-center text-sm text-neutral-500">No mismatches between filed reports and system check-ins for staff with attendance data — clean cross-check.</div>)}
          </div>
        ):(
          <div className="bg-neutral-900 border border-dashed border-rose-500/25 rounded-xl p-5 flex items-center gap-3">
            <Fingerprint className="w-6 h-6 text-rose-400/60 shrink-0"/>
            <div><p className="text-white font-bold text-base">No attendance data loaded yet</p><p className="text-sm text-neutral-500">Upload Attendance_time.xlsx to cross-check every filed report against the system's own check-in log — the strongest evidence source for telling real visits from fabricated ones.</p></div>
          </div>
        )}

        {/* CHARTS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Area trend */}
          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400"/><p className="text-sm text-neutral-300 font-semibold tracking-wider">DAILY VISIT VOLUME TREND</p></div>
              {visits.length>0&&<span className="text-base font-bold font-mono text-cyan-400">{avgVolume} <span className="text-sm text-neutral-600">avg/day</span></span>}
            </div>
            {visits.length>0?(
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={dailyTrend} margin={{top:8,right:8,bottom:0,left:0}}>
                  <defs><Defs/></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:"#525252",fontSize:9}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:"#525252",fontSize:9}} axisLine={false} tickLine={false} width={26}/>
                  <Tooltip contentStyle={{background:"#0a0a0a",border:"1px solid #2a2a2a",borderRadius:10,color:"#fff",fontSize:11}} labelStyle={{color:"#22d3ee",fontWeight:"bold"}} formatter={(v:any)=>[`${v} visits`,"Volume"]}/>
                  <ReferenceLine y={avgVolume} stroke="#22d3ee" strokeDasharray="4 3" strokeOpacity={0.3} label={{value:`avg`,position:"insideTopRight",fill:"#22d3ee",fontSize:9,fontFamily:"monospace"}}/>
                  <Area type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2.5} fill="url(#areaCyan)" dot={<GlowDot/>} activeDot={{r:6,fill:"#22d3ee",stroke:"#0e7490",strokeWidth:2}}/>
                </AreaChart>
              </ResponsiveContainer>
            ):<div className="h-[210px] flex items-center justify-center"><p className="text-sm text-neutral-600">Upload Mobile_Dep.xlsx to see trend</p></div>}
          </div>

          {/* Trust donut */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4"><Target className="w-4 h-4 text-purple-400"/><p className="text-sm text-neutral-300 font-semibold tracking-wider">FIELD TRUST SPLIT</p></div>
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <ResponsiveContainer width="100%" height={175}>
                <PieChart><defs><Defs/></defs>
                  <Pie data={statusBuckets} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={5} style={{filter:"url(#shadow)"}}>
                    {statusBuckets.map((s,i)=>(<Cell key={i} fill={s.color} style={{filter:s.name==="Needs Support"&&s.value>0?"drop-shadow(0 0 10px #f87171)":"none"}}/>))}
                  </Pie>
                  <Tooltip contentStyle={{background:"#0a0a0a",border:"1px solid #2a2a2a",borderRadius:8,color:"#fff",fontSize:11}}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-3xl font-black font-mono text-white">{profiles.length}</p>
                <p className="text-sm text-neutral-500">staff</p>
              </div>
            </div>
            <div className="flex justify-center gap-2 mt-2 flex-wrap">
              {statusBuckets.map(s=>(<span key={s.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-bold border" style={{borderColor:`${s.color}44`,background:`${s.color}14`,color:s.color}}><span className="w-1.5 h-1.5 rounded-full" style={{background:s.color}}/>{s.name} {s.value}</span>))}
            </div>
          </div>
        </div>

        {/* DEPT RANKING */}
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700">
            <div className="flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400"/><span className="text-sm text-neutral-300 font-semibold tracking-wider">DEPARTMENT RANKING</span></div>
          </div>
          <div className="px-5 pt-4 pb-2">
            <ResponsiveContainer width="100%" height={Math.max(80,deptRollup.length*58)}>
              <BarChart data={deptRollup} layout="vertical" margin={{left:0,right:48,top:4,bottom:4}}>
                <defs><Defs/></defs>
                <XAxis type="number" domain={[0,100]} tick={{fill:"#525252",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                <YAxis type="category" dataKey="dept" tick={{fill:"#e5e5e5",fontSize:11,fontWeight:600}} axisLine={false} tickLine={false} width={96}/>
                <Tooltip contentStyle={{background:"#0a0a0a",border:"1px solid #2a2a2a",borderRadius:8,color:"#fff",fontSize:11}} formatter={(v:any)=>[`${v}%`,"Submission Rate"]}/>
                <Bar dataKey="compliance" barSize={26} shape={<GradBar/>} radius={[0,6,6,0]}>
                  <LabelList dataKey="compliance" position="right" formatter={(v:any)=>`${v}%`} style={{fill:"#a3a3a3",fontSize:10,fontFamily:"monospace",fontWeight:"bold"}}/>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="w-full text-base border-t border-neutral-800">
            <thead><tr className="text-[12.5px] text-neutral-500 bg-neutral-950/60">{["#","DEPARTMENT","STAFF","SUBMISSION","AVG QUALITY","AVG TRUST","CHRONIC"].map(h=>(<th key={h} className="text-left py-2 px-4 font-bold tracking-wider">{h}</th>))}</tr></thead>
            <tbody>{deptRollup.map((d,i)=>(<tr key={d.dept} className="border-t border-neutral-800 hover:bg-neutral-800/40 transition-colors">
              <td className="py-2.5 px-4 text-neutral-500 font-mono text-sm">#{i+1}</td>
              <td className="py-2.5 px-4 text-white font-bold">{d.dept}</td>
              <td className="py-2.5 px-4 font-mono text-neutral-300 text-sm">{d.headcount}</td>
              <td className={`py-2.5 px-4 font-mono font-bold text-sm ${compColor(d.compliance)}`}>{d.compliance}%</td>
              <td className={`py-2.5 px-4 font-mono font-bold text-sm ${intgColor(d.avgIntegrity)}`}>{d.avgIntegrity}%</td>
              <td className={`py-2.5 px-4 font-mono font-bold text-sm ${compColor(d.avgTrust)}`}>{d.avgTrust}%</td>
              <td className="py-2.5 px-4 font-mono text-sm">{d.chronic>0?<span className="text-red-400 font-bold">{d.chronic}</span>:<span className="text-neutral-600">—</span>}</td>
            </tr>))}</tbody>
          </table>
        </div>

        {/* MANAGER ACTION DESK */}
        <div className="bg-neutral-900 border border-purple-500/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700 flex-wrap gap-3">
            <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-purple-400"/><span className="text-sm text-purple-300 font-bold tracking-wider">MANAGER ACTION DESK — DATA NEVER LIES</span></div>
            <div className="flex gap-1 p-1 bg-neutral-800 border border-neutral-700 rounded-lg">
              {([["trust","⬇ Lowest Trust"],["ghost","🔍 Pattern Review"]] as const).map(([id,label])=>(
                <button key={id} onClick={()=>setLowestTab(id)} className={`text-sm px-3 py-1.5 rounded font-bold tracking-wider transition-all ${lowestTab===id?id==="ghost"?"bg-red-500/20 text-red-300 border border-red-500/30":"bg-purple-500/20 text-purple-300 border border-purple-500/30":"text-neutral-500 hover:text-neutral-300"}`}>{label}</button>
              ))}
            </div>
          </div>

          {lowestTab==="trust"&&(<>
            <div className="px-5 py-2 border-b border-neutral-800 bg-neutral-950/40">
              <p className="text-sm text-neutral-500">Field Trust = submission rate (50%) + integrity score (50%). Click any row or 🔍 button to open 3D employee scorecard. Uses all 5 file sources.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead><tr className="text-[12.5px] text-neutral-500 border-b border-neutral-800 bg-neutral-950/40 sticky top-0">
                  <th className="py-2.5 px-3 w-8">
                    <input type="checkbox"
                      checked={lowestTrust.slice(0,18).length>0&&lowestTrust.slice(0,18).every(p=>selectedCodes.has(p.code))}
                      onChange={e=>{
                        const group=lowestTrust.slice(0,18);
                        setSelectedCodes(prev=>{
                          const next=new Set(prev);
                          if(e.target.checked) group.forEach(p=>next.add(p.code));
                          else group.forEach(p=>next.delete(p.code));
                          return next;
                        });
                      }}
                      className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"/>
                  </th>
                  {["EMPLOYEE","DEPT","REPORTS","JUNE VISITS","SUBMITTED","SUBMISSION%","BLANK","REPEATED TEXT","OFF-HOURS","WEEKS","QUALITY","TRUST","WHY FOLLOW UP","CARD"].map(h=>(<th key={h} className="text-left py-2.5 px-3 font-bold tracking-wider whitespace-nowrap">{h}</th>))}
                </tr></thead>
                <tbody>{lowestTrust.slice(0,18).map(p=>(
                  <tr key={p.code} className={`border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors cursor-pointer ${selectedCodes.has(p.code)?"bg-cyan-500/5":p.trustTier==="Needs Support"?"bg-red-950/8":""}`} onClick={()=>setScorecardEmp(p)}>
                    <td className="py-2.5 px-3" onClick={e=>e.stopPropagation()}>
                      <input type="checkbox" checked={selectedCodes.has(p.code)} onChange={()=>toggleSelected(p.code)}
                        className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"/>
                    </td>
                    <td className="py-2.5 px-3"><p className="text-white text-sm font-bold leading-tight">{p.name}</p><p className="text-cyan-400 font-mono text-[12.5px]">{p.code}</p></td>
                    <td className="py-2.5 px-3 text-neutral-400 text-sm">{p.department}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-300 text-sm text-center">{p.totalReports}</td>
                    <td className="py-2.5 px-3 font-mono text-purple-400 text-sm text-center font-bold">{p.juneTotal||p.visitCount}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-300 text-sm text-center">{p.submittedDays}<span className="text-neutral-600">/{p.totalPossibleDays}</span></td>
                    <td className={`py-2.5 px-3 font-mono font-bold text-sm text-center ${compColor(p.submissionRate)}`}>{p.submissionRate}%</td>
                    <td className="py-2.5 px-3 text-center text-sm font-mono">{p.blankComments>0?<span className="text-red-400 font-bold">{p.blankComments}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3 text-center text-sm font-mono">{p.templatedRepeats>0?<span className="flex items-center justify-center gap-1 text-amber-400"><Copy className="w-3 h-3"/>{p.templatedRepeats}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3 text-center text-sm font-mono">{p.lateNightCount>0?<span className="flex items-center justify-center gap-1 text-violet-400"><Clock className="w-3 h-3"/>{p.lateNightCount}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3"><WeekSparkline totals={p.weekTotals}/></td>
                    <td className={`py-2.5 px-3 text-center font-mono font-bold text-sm ${intgColor(p.integrityScore)}`}>{p.integrityScore}%</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded-full border ${p.trustTier==="Needs Support"?"bg-red-500/15 text-red-300 border-red-500/30":p.trustTier==="Watch"?"bg-amber-500/15 text-amber-300 border-amber-500/30":"bg-emerald-500/15 text-emerald-300 border-emerald-500/30"}`}>{p.fieldTrust}%</span>
                    </td>
                    <td className="py-2.5 px-3 min-w-[160px]" onClick={e=>e.stopPropagation()}>
                      <ul className="space-y-0.5">
                        {[
                          p.submissionRate<50&&`Only ${p.submissionRate}% submission rate`,
                          p.blankComments>0&&`${p.blankComments} blank comments`,
                          p.templatedRepeats>=3&&"Repeated text detected",
                          p.lateNightCount>p.visitCount*0.5&&p.visitCount>=4&&"Batch late-night filing",
                          p.unsupportedClaims>0&&`${p.unsupportedClaims} unsupported claims`,
                        ].filter(Boolean).slice(0,3).map((r,i)=>(<li key={i} className="text-[12.5px] text-neutral-300 flex items-start gap-1"><span className="text-red-400 shrink-0">•</span>{r}</li>))}
                      </ul>
                    </td>
                    <td className="py-2.5 px-3" onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setScorecardEmp(p)} className="flex items-center gap-1 text-[12.5px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg hover:bg-cyan-500/20 transition-colors whitespace-nowrap">
                        <Fingerprint className="w-3 h-3"/>3D Card
                      </button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>)}

          {lowestTab==="ghost"&&(<>
            <div className="px-5 py-2 border-b border-neutral-800 bg-red-950/8">
              <p className="text-sm text-neutral-500">Pattern Score: blank (30%) + repeated text (20%) + late-night batch (25%) + unsupported claims (15%) + single-shop loop (10%). Powered by Mobile_Dep.xlsx raw data.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead><tr className="text-[12.5px] text-neutral-500 border-b border-neutral-800 bg-neutral-950/40 sticky top-0">
                  {["EMPLOYEE","VISITS","SHOPS","AVG COMMENT","OFF-HOURS","BLANK %","UNSUPPORTED","PATTERN SCORE","STATUS","FLAGS","CARD"].map(h=>(<th key={h} className="text-left py-2.5 px-3 font-bold tracking-wider whitespace-nowrap">{h}</th>))}
                </tr></thead>
                <tbody>{ghostRanking.slice(0,18).map(p=>{
                  const badge=ghostBadge(p.ghostScore);
                  return(<tr key={p.code} className={`border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors cursor-pointer ${p.ghostScore>=60?"bg-red-950/8":""}`} onClick={()=>setScorecardEmp(p)}>
                    <td className="py-2.5 px-3"><p className="text-white text-sm font-bold">{p.name}</p><p className="text-cyan-400 font-mono text-[12.5px]">{p.code}</p></td>
                    <td className="py-2.5 px-3 font-mono text-neutral-300 text-sm text-center">{p.visitCount}</td>
                    <td className="py-2.5 px-3 font-mono text-sm text-center">{p.singleShopLoop?<span className="text-red-400 font-bold">{p.storesInCoverage}</span>:p.storesInCoverage}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm"><span className={p.avgCommentLen<25?"text-red-400":p.avgCommentLen<60?"text-amber-400":"text-emerald-400"}>{p.avgCommentLen}c</span></td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm">{p.lateNightCount>0?<span className="flex items-center justify-center gap-1 text-violet-400"><Clock className="w-3 h-3"/>{p.lateNightCount}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm"><span className={p.blankComments>0?"text-red-400":"text-neutral-600"}>{pct(p.blankComments,p.visitCount)}%</span></td>
                    <td className="py-2.5 px-3 text-center font-mono text-sm">{p.unsupportedClaims>0?<span className="flex items-center justify-center gap-1 text-red-400"><FileWarning className="w-3 h-3"/>{p.unsupportedClaims}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3"><div className="flex flex-col gap-1"><GhostMeter score={p.ghostScore}/><p className="text-[12.5px] font-mono text-neutral-400">{p.ghostScore}/100</p></div></td>
                    <td className="py-2.5 px-3"><span className={`text-[12.5px] font-bold px-2 py-0.5 rounded-full border ${badge.c}`}>{badge.l}</span></td>
                    <td className="py-2.5 px-3" onClick={e=>e.stopPropagation()}><FlagTooltip p={p}/></td>
                    <td className="py-2.5 px-3" onClick={e=>e.stopPropagation()}><button onClick={()=>setScorecardEmp(p)} className="flex items-center gap-1 text-[12.5px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg hover:bg-cyan-500/20 transition-colors whitespace-nowrap"><Fingerprint className="w-3 h-3"/>3D Card</button></td>
                  </tr>);
                })}</tbody>
              </table>
            </div>
          </>)}
        </div>

        {/* DATA CHECK */}
        {audit.length>0&&(
          <div className="bg-neutral-900 border border-amber-500/25 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-amber-500/20 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400"/>
                <span className="text-sm text-amber-300 font-bold tracking-wider">DATA CHECK — {audit.length} ITEM{audit.length>1?"S":""} TO REVIEW</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(audit.reduce((m:Record<string,number>,a)=>{m[a.category||"Other"]=(m[a.category||"Other"]||0)+1;return m;},{})).map(([cat,n])=>(
                  <span key={cat} className="text-[11.5px] font-bold text-neutral-400 bg-neutral-800 border border-neutral-700 rounded-full px-2.5 py-1 whitespace-nowrap">{cat} · {n}</span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-base">
                <thead><tr className="text-[12.5px] text-neutral-500 border-b border-neutral-800 sticky top-0 bg-neutral-900">
                  {["PRIORITY","EMPLOYEE","CODE","CATEGORY","DETAILS"].map(h=>(<th key={h} className="text-left py-2 px-3 font-bold tracking-wider whitespace-nowrap">{h}</th>))}
                </tr></thead>
                <tbody>{[...audit].sort((a,b)=>(a.severity==="high"?0:1)-(b.severity==="high"?0:1)).map((a,i)=>(
                  <tr key={i} className={`border-b border-neutral-800/70 ${a.severity==="high"?"bg-red-950/10":""}`}>
                    <td className="py-2 px-3">
                      <span className={`text-[11.5px] font-bold px-2 py-0.5 rounded-full border ${a.severity==="high"?"bg-red-500/15 text-red-300 border-red-500/30":"bg-amber-500/15 text-amber-300 border-amber-500/30"}`}>
                        {a.severity==="high"?"HIGH":"MEDIUM"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white text-sm font-bold whitespace-nowrap">{a.employee||"—"}</td>
                    <td className="py-2 px-3 font-mono text-cyan-400 text-sm whitespace-nowrap">{a.code||"—"}</td>
                    <td className="py-2 px-3 text-neutral-400 text-sm whitespace-nowrap">{a.category||"Other"}</td>
                    <td className="py-2 px-3 text-neutral-300 text-sm">{a.message}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}

        {/* EMPLOYEE TABLE */}
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700 flex-wrap gap-2">
            <span className="text-sm text-neutral-300 font-bold tracking-wider">ALL EMPLOYEES — FULL PROFILE</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500"/><input value={empSearch} onChange={e=>setEmpSearch(e.target.value)} placeholder="Search name/code…" className="bg-neutral-800 border border-neutral-600 text-sm text-neutral-300 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-cyan-500 w-40"/></div>
              <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="bg-neutral-800 border border-neutral-600 text-sm text-neutral-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500">
                {departments.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          {selectedCodes.size>0&&(
            <div className="flex items-center gap-3 px-5 py-2.5 border-b border-cyan-500/20 bg-cyan-500/5 flex-wrap">
              <span className="text-sm font-bold text-cyan-300">{selectedCodes.size} selected</span>
              <button onClick={()=>draftEmailForSelected(profiles.filter(p=>selectedCodes.has(p.code)))}
                className="flex items-center gap-1.5 text-[12.5px] font-bold text-blue-300 bg-blue-500/10 border border-blue-500/30 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors">
                <Mail className="w-3 h-3"/>Draft Email
              </button>
              <button onClick={()=>exportSelectedGroup(profiles.filter(p=>selectedCodes.has(p.code)),visits,storeCoverage)}
                className="flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-colors">
                <Download className="w-3 h-3"/>Export Selected
              </button>
              <button onClick={()=>setSelectedCodes(new Set())}
                className="text-[12.5px] font-bold text-neutral-400 hover:text-neutral-200 px-2 py-1.5 transition-colors ml-auto">
                Clear selection
              </button>
            </div>
          )}
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-base">
              <thead><tr className="text-[12.5px] text-neutral-500 border-b border-neutral-800 sticky top-0 bg-neutral-900">
                <th className="py-2.5 px-3 w-8">
                  <input type="checkbox"
                    checked={filteredProfiles.length>0&&filteredProfiles.every(p=>selectedCodes.has(p.code))}
                    onChange={e=>{
                      setSelectedCodes(prev=>{
                        const next=new Set(prev);
                        if(e.target.checked) filteredProfiles.forEach(p=>next.add(p.code));
                        else filteredProfiles.forEach(p=>next.delete(p.code));
                        return next;
                      });
                    }}
                    className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"/>
                </th>
                {["EMPLOYEE","CODE","DEPT","REPORTS","UNIQUE STORES","JUNE VISITS","SUBMISSION%","QUALITY","PENDING","PATTERN","TRUST","WEEKS","CARD"].map(h=>(<th key={h} className="text-left py-2.5 px-3 font-bold tracking-wider whitespace-nowrap">{h}</th>))}
              </tr></thead>
              <tbody>{filteredProfiles.map(p=>(
                <tr key={p.code} className={`border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors cursor-pointer ${selectedCodes.has(p.code)?"bg-cyan-500/5":""}`} onClick={()=>setScorecardEmp(p)}>
                  <td className="py-2 px-3" onClick={e=>e.stopPropagation()}>
                    <input type="checkbox" checked={selectedCodes.has(p.code)} onChange={()=>toggleSelected(p.code)}
                      className="w-3.5 h-3.5 rounded accent-cyan-500 cursor-pointer"/>
                  </td>
                  <td className="py-2 px-3 text-white text-sm font-bold">{p.name}</td>
                  <td className="py-2 px-3 font-mono text-cyan-400 text-sm">{p.code}</td>
                  <td className="py-2 px-3 text-neutral-400 text-sm">{p.department}</td>
                  <td className="py-2 px-3 font-mono text-neutral-300 text-sm text-center">{p.totalReports}</td>
                  <td className="py-2 px-3 font-mono text-neutral-300 text-sm text-center">{p.uniqueStores}</td>
                  <td className="py-2 px-3 font-mono text-purple-400 text-sm text-center font-bold">{p.juneTotal||p.visitCount}</td>
                  <td className={`py-2 px-3 font-mono font-bold text-sm text-center ${compColor(p.submissionRate)}`}>{p.submissionRate}%</td>
                  <td className={`py-2 px-3 font-mono font-bold text-sm text-center ${intgColor(p.integrityScore)}`}>{p.integrityScore}%</td>
                  <td className="py-2 px-3 font-mono text-sm text-center">{p.pending>0?<span className="text-amber-400 font-bold">{p.pending}</span>:<span className="text-neutral-600">—</span>}</td>
                  <td className="py-2 px-3 text-center"><GhostMeter score={p.ghostScore}/></td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-[12.5px] font-bold px-2 py-0.5 rounded-full border ${p.trustTier==="Needs Support"?"bg-red-500/20 text-red-300 border-red-500/30":p.trustTier==="Watch"?"bg-amber-500/20 text-amber-300 border-amber-500/30":"bg-emerald-500/20 text-emerald-300 border-emerald-500/30"}`}>{p.fieldTrust}%</span>
                  </td>
                  <td className="py-2 px-3"><WeekSparkline totals={p.weekTotals}/></td>
                  <td className="py-2 px-3" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>setScorecardEmp(p)} className="flex items-center gap-1 text-[12.5px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg hover:bg-cyan-500/20 transition-colors whitespace-nowrap">
                      <Fingerprint className="w-3 h-3"/>3D
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

      </>)}

      {/* FLOATING GROUP-SELECT ACTION BAR — visible from anywhere while employees are selected */}
      {selectedCodes.size>0&&(
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-neutral-900 border border-cyan-500/30 rounded-2xl px-5 py-3 flex-wrap justify-center"
          style={{boxShadow:"0 20px 40px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,211,238,0.08)"}}>
          <span className="flex items-center gap-2 text-sm font-bold text-white">
            <Users className="w-4 h-4 text-cyan-400"/>{selectedCodes.size} employee{selectedCodes.size>1?"s":""} selected
          </span>
          <button onClick={()=>draftEmailForSelected(profiles.filter(p=>selectedCodes.has(p.code)))}
            className="flex items-center gap-1.5 text-sm font-bold text-blue-300 bg-blue-500/10 border border-blue-500/30 px-3.5 py-1.5 rounded-xl hover:bg-blue-500/20 transition-colors">
            <Mail className="w-3.5 h-3.5"/>Draft Email
          </button>
          <button onClick={()=>exportSelectedGroup(profiles.filter(p=>selectedCodes.has(p.code)),visits,storeCoverage)}
            className="flex items-center gap-1.5 text-sm font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1.5 rounded-xl hover:bg-emerald-500/20 transition-colors">
            <Download className="w-3.5 h-3.5"/>Export Selected
          </button>
          <button onClick={()=>setSelectedCodes(new Set())}
            className="text-sm font-bold text-neutral-400 hover:text-neutral-200 px-2 py-1.5 transition-colors">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
