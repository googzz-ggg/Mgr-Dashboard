"use client";
import { useState, useCallback, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle,
  Users, ShieldCheck, ShieldAlert, TrendingDown, TrendingUp,
  Layers, RefreshCw, Crown, Flag, Copy, FileWarning, Eye, Gauge,
  Zap, Clock, Target, Activity, Download, X, MapPin, Calendar,
  Building2, ChevronDown, Search, Fingerprint, BarChart3, Store,
  AlertCircle, TrendingUp as TUp, Star,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine,
  LabelList, RadarChart, Radar, PolarGrid, PolarAngleAxis, LineChart, Line,
} from "recharts";

// ─── FILE SOURCE TYPES ───────────────────────────────────────────────────────
type FileKind =
  | "employee_summary"   // Employee_Summary.xlsx  — SPVR Name, Code, Dept, TotalReports, UniqueStores, Dates, Pending/Reviewed/Other
  | "mobile_dep"         // Mobile_Dep.xlsx        — Daily visits raw (Mobile sheet)
  | "store_coverage"     // Store_Coverage.xlsx    — Shop Code, Shop Name, Area, Gov, TotalVisits, UniqueSPVRs, Dates
  | "submission_matrix"  // Submission_Matrix.xlsx — Employee, Code, TotalReports, MissingDates, day cols
  | "weekly_summary"     // Weekly_Summary.xlsx    — Employee, Code, Dept, week day cols
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
  unsupportedClaims: number; lateNightCount: number;
  singleShopLoop: boolean; avgCommentLen: number;
  integrityScore: number; ghostScore: number;
  suspiciousFlags: string[];
  topRepeatedComment: { text: string; count: number } | null;
  uniquenessRatio: number;
  // from Store Coverage (cross-reference)
  storesInCoverage: number; // how many shops this SPVR appears in coverage file
  // composite
  fieldTrust: number; // 0-100
  trustTier: "Healthy" | "Watch" | "At Risk";
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const LOW_INFO = new Set(["ok","fine","good","done","no issue","nothing","n/a","na","-","none","good.","ok.","yes","no","daily report"]);
const fmtB = (b:number) => b>1_048_576?`${(b/1_048_576).toFixed(1)} MB`:`${(b/1024).toFixed(0)} KB`;
const pct = (a:number,b:number) => b>0?Math.round((a/b)*100):0;
const compColor = (p:number) => p>=80?"text-emerald-400":p>=50?"text-amber-400":"text-red-400";
const intgColor = (p:number) => p>=80?"text-cyan-400":p>=50?"text-amber-400":"text-red-400";
const compBg = (p:number) => p>=80?"#34d399":p>=50?"#fbbf24":"#f87171";
const ghostBadge = (s:number) => s>=60?{l:"HIGH RISK",c:"bg-red-500/20 text-red-400 border-red-500/30"}:s>=30?{l:"SUSPICIOUS",c:"bg-amber-500/20 text-amber-400 border-amber-500/30"}:{l:"CLEAN",c:"bg-emerald-500/20 text-emerald-400 border-emerald-500/30"};

// ─── FILE DETECTION ──────────────────────────────────────────────────────────
function detectKind(sheetNames: string[], fileName: string): FileKind {
  const fn = fileName.toLowerCase();
  if (fn.includes("employee_summary") || fn.includes("employee summary")) return "employee_summary";
  if (fn.includes("mobile_dep") || fn.includes("mobile dep")) return "mobile_dep";
  if (fn.includes("store_coverage") || fn.includes("store coverage")) return "store_coverage";
  if (fn.includes("submission_matrix") || fn.includes("submission matrix")) return "submission_matrix";
  if (fn.includes("weekly_summary") || fn.includes("weekly summary")) return "weekly_summary";
  // Fallback by sheet name
  if (sheetNames.includes("Employee Summary")) return "employee_summary";
  if (sheetNames.includes("Mobile")) return "mobile_dep";
  if (sheetNames.includes("Store Coverage")) return "store_coverage";
  if (sheetNames.includes("Submission Matrix")) return "submission_matrix";
  if (sheetNames.includes("Weekly Summary")) return "weekly_summary";
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

function getHour(d:string): number|null {
  const m = d.match(/[T ](\d{2}):/);
  return m?parseInt(m[1],10):null;
}

// ─── BUILD PROFILES ──────────────────────────────────────────────────────────
function buildProfiles(
  empSummary: EmployeeSummaryRow[],
  visits: VisitRow[],
  storeCoverage: StoreCoverageRow[],
  submissionMap: Map<string,SubmissionRow>,
  weeklyMap: Map<string,WeeklySummaryRow>,
): EmployeeProfile[] {

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

    // Visit integrity analysis
    const shops = new Set(rows.map(r=>r.shopCode));
    let blank=0, lowInfo=0, unsupported=0, lateNight=0, totalLen=0;
    const cc = new Map<string,number>();
    for(const r of rows) {
      const c = r.comment.toLowerCase().trim();
      totalLen += r.comment.length;
      if(!c) blank++;
      else if(LOW_INFO.has(c)||c.length<=4) lowInfo++;
      else cc.set(c,(cc.get(c)||0)+1);
      const shortage = r.samsungShortage&&!["n","no","none","","–"].includes(r.samsungShortage.toLowerCase().trim());
      if((shortage||r.selloutMovement.length>3)&&!c) unsupported++;
      const hr=getHour(r.date); if(hr!==null&&(hr>=23||hr<=4)) lateNight++;
    }
    let templatedRepeats=0, top:any=null;
    for(const [text,count] of cc.entries()){
      if(count>1) templatedRepeats+=count-1;
      if(!top||count>top.count) top={text,count};
    }
    const avgCommentLen = rows.length>0?Math.round(totalLen/rows.length):0;
    const singleShopLoop = shops.size===1&&rows.length>4;
    const blankPct = pct(blank,rows.length);
    const latePct = pct(lateNight,rows.length);

    const flags: string[] = [];
    if(blankPct>30) flags.push(`${blank} blank comments (${blankPct}% of visits)`);
    if(templatedRepeats>=3) flags.push(`Same comment copy-pasted ${templatedRepeats} extra times`);
    if(latePct>50&&rows.length>=4) flags.push(`${lateNight}/${rows.length} reports filed 23:00–04:00`);
    if(unsupported>0) flags.push(`${unsupported} shortage claims with zero explanation`);
    if(avgCommentLen<25&&rows.length>=5) flags.push(`Avg comment only ${avgCommentLen} chars`);
    if(singleShopLoop) flags.push(`All ${rows.length} visits at same single shop`);
    if(top&&top.count>=4) flags.push(`"${top.text.slice(0,55)}…" repeated ${top.count}×`);

    const ghostScore = Math.min(100,Math.round(
      blankPct*0.30+Math.min(100,templatedRepeats*8)*0.20+latePct*0.25+
      Math.min(100,unsupported*15)*0.15+(singleShopLoop?100:0)*0.10
    ));
    const penalty = templatedRepeats*4+lowInfo*1.5+unsupported*3+blank*1;
    const integrityScore = Math.max(0,Math.min(100,Math.round(100-penalty)));

    const submissionRate = pct(sub.submittedDays, sub.totalPossibleDays);
    const fieldTrust = Math.round(submissionRate*0.5+integrityScore*0.5);
    const trustTier: "Healthy"|"Watch"|"At Risk" = fieldTrust>=80?"Healthy":fieldTrust>=50?"Watch":"At Risk";

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
      unsupportedClaims: unsupported, lateNightCount: lateNight,
      singleShopLoop, avgCommentLen,
      integrityScore, ghostScore, suspiciousFlags: flags,
      topRepeatedComment: top&&top.count>1?top:null,
      uniquenessRatio: (rows.length-blank)>0?pct(cc.size+lowInfo,rows.length-blank):100,
      storesInCoverage: shops.size,
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
  if(n===0)return<span className="text-neutral-600 text-xs">—</span>;
  return(<div className="relative inline-block">
    <button onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}
      className="flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-200 transition-colors">
      <Zap className="w-3 h-3"/>{n} flag{n>1?"s":""}
    </button>
    {open&&(<div className="absolute z-50 bottom-full left-0 mb-2 w-80 bg-neutral-800 border border-amber-500/40 rounded-xl p-3 shadow-2xl shadow-black/60">
      <p className="text-[10px] text-amber-300 font-bold mb-2 tracking-widest">⚠ SUSPICIOUS SIGNALS</p>
      <div className="space-y-1.5">{p.suspiciousFlags.map((f,i)=>(<div key={i} className="flex items-start gap-2 text-xs text-neutral-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"/>{f}</div>))}</div>
      {p.topRepeatedComment&&(<div className="mt-2 pt-2 border-t border-neutral-700"><p className="text-[10px] text-neutral-500 mb-1">Top repeated ({p.topRepeatedComment.count}×):</p><p className="text-[10px] text-neutral-300 italic line-clamp-2">"{p.topRepeatedComment.text}"</p></div>)}
    </div>)}
  </div>);
}

// ─── WEEK SPARKLINE ──────────────────────────────────────────────────────────
function WeekSparkline({totals}:{totals:number[]}){
  if(!totals.length)return<span className="text-neutral-600 text-xs">—</span>;
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
function ScorecardModal({p,visits,storeCoverage,onClose}:{p:EmployeeProfile;visits:VisitRow[];storeCoverage:StoreCoverageRow[];onClose:()=>void}){
  const empVisits=visits.filter(v=>v.spvrCode===p.code);
  const shops=Array.from(new Set(empVisits.map(v=>v.shopName))).slice(0,6);
  const areas=Array.from(new Set(empVisits.map(v=>v.area))).filter(Boolean);
  const govs=Array.from(new Set(empVisits.map(v=>v.governorate))).filter(Boolean);
  const trustColor=p.fieldTrust>=80?"#34d399":p.fieldTrust>=50?"#fbbf24":"#f87171";
  const trustGlow=p.fieldTrust>=80?"glowGreen":p.fieldTrust>=50?"glowAmber":"glowRed";

  // Radar — 6 axes
  const radarData=[
    {axis:"Submission",score:p.submissionRate},
    {axis:"Comment Quality",score:Math.min(100,Math.round(((p.visitCount-p.blankComments)/Math.max(1,p.visitCount))*100-(p.lowInfoComments/Math.max(1,p.visitCount))*30))},
    {axis:"Originality",score:p.uniquenessRatio},
    {axis:"Coverage",score:Math.min(100,p.uniqueStores*3)},
    {axis:"Integrity",score:p.integrityScore},
    {axis:"Timeliness",score:Math.max(0,100-pct(p.lateNightCount,p.visitCount))},
  ];

  // Daily sparkline from visits
  const dailyMap=new Map<string,number>();
  for(const v of empVisits) dailyMap.set(v.date.slice(0,10),(dailyMap.get(v.date.slice(0,10))||0)+1);
  const sparkline=Array.from(dailyMap.entries()).sort((a,b)=>a[0].localeCompare(b[0])).map(([d,c])=>({d:d.slice(5),c}));

  // Week bars from weekTotals
  const weekBarData=p.weekTotals.map((v,i)=>({week:`W${i+1}`,visits:v}));

  // Store coverage cross-ref
  const myStores=storeCoverage.filter(s=>empVisits.some(v=>v.shopCode===s.shopCode));
  const avgStoreVisits=myStores.length>0?Math.round(myStores.reduce((s,st)=>s+st.totalVisits,0)/myStores.length):0;

  return(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" style={{background:"rgba(0,0,0,0.88)",backdropFilter:"blur(10px)"}}>
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-neutral-700 shadow-2xl"
        style={{background:"linear-gradient(135deg,#080810 0%,#0f0f1a 40%,#080808 100%)",boxShadow:`0 0 100px ${trustColor}18, 0 0 0 1px ${trustColor}22, 0 30px 60px rgba(0,0,0,0.9)`}}>

        {/* Scanline overlay */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-[0.04]" style={{background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,0.05) 2px,rgba(255,255,255,0.05) 4px)"}}/>
          <div className="absolute left-0 right-0 h-px opacity-20 animate-pulse" style={{background:`linear-gradient(to right,transparent,${trustColor},transparent)`,top:"25%"}}/>
          <div className="absolute left-0 right-0 h-px opacity-10 animate-pulse" style={{background:`linear-gradient(to right,transparent,${trustColor},transparent)`,top:"70%`,animationDelay:"1s"}}/>
        </div>

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 pt-6 pb-4 border-b border-neutral-800/80">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#1a1a2e" strokeWidth="4"/>
                <circle cx="32" cy="32" r="28" fill="none" stroke={trustColor} strokeWidth="4"
                  strokeDasharray={`${(p.fieldTrust/100)*175.9} 175.9`} strokeLinecap="round" opacity={0.9}/>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-black text-white">{p.name.split(" ").map(w=>w[0]).slice(0,2).join("")}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-lg font-black text-white tracking-wide">{p.name}</h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${p.trustTier==="At Risk"?"bg-red-500/20 text-red-400 border-red-500/30":p.trustTier==="Watch"?"bg-amber-500/20 text-amber-400 border-amber-500/30":"bg-emerald-500/20 text-emerald-400 border-emerald-500/30"}`}>{p.trustTier}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <span className="font-mono text-cyan-400">{p.code}</span>
                <span>·</span><span>{p.department}</span>
                <span>·</span><span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{govs.slice(0,3).join(", ")}{govs.length>3?` +${govs.length-3}`:""}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
                <span>Active: {p.firstReport?.slice(0,10)} → {p.lastReport?.slice(0,10)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-5 py-2.5 rounded-xl border" style={{borderColor:`${trustColor}44`,background:`${trustColor}10`}}>
              <p className="text-[9px] text-neutral-400 tracking-widest mb-0.5">FIELD TRUST</p>
              <p className="text-4xl font-black font-mono leading-none" style={{color:trustColor,textShadow:`0 0 24px ${trustColor}`}}>{p.fieldTrust}%</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors shrink-0">
              <X className="w-4 h-4 text-neutral-400"/>
            </button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Radar */}
          <div className="bg-neutral-900/70 rounded-xl border border-neutral-800 p-4">
            <p className="text-[10px] text-neutral-400 tracking-widest font-bold mb-2 flex items-center gap-2"><BarChart3 className="w-3 h-3 text-cyan-400"/>BEHAVIOURAL RADAR — 6 AXES</p>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} margin={{top:10,right:25,bottom:10,left:25}}>
                <defs>
                  <linearGradient id="rf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trustColor} stopOpacity={0.45}/><stop offset="100%" stopColor={trustColor} stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <PolarGrid stroke="#222232" radialLines/>
                <PolarAngleAxis dataKey="axis" tick={{fill:"#737373",fontSize:9,fontFamily:"monospace"}}/>
                <Radar dataKey="score" stroke={trustColor} fill="url(#rf)" strokeWidth={2} dot={{fill:trustColor,r:3,filter:`url(#${trustGlow})`}}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {label:"TOTAL REPORTS",val:p.totalReports,icon:"📋",color:"text-white"},
              {label:"UNIQUE STORES",val:p.uniqueStores,icon:"🏪",color:"text-cyan-400"},
              {label:"JUNE VISITS",val:p.juneTotal||p.visitCount,icon:"📅",color:"text-purple-400"},
              {label:"PENDING",val:p.pending,icon:"⏳",color:p.pending>0?"text-amber-400":"text-neutral-500"},
              {label:"BLANK COMMENTS",val:p.blankComments,icon:"💬",color:p.blankComments>0?"text-red-400":"text-emerald-400"},
              {label:"COPY-PASTE",val:p.templatedRepeats,icon:"📋",color:p.templatedRepeats>=3?"text-amber-400":"text-emerald-400"},
              {label:"LATE NIGHT",val:p.lateNightCount,icon:"🌙",color:p.lateNightCount>0?"text-violet-400":"text-emerald-400"},
              {label:"UNSUPPORTED",val:p.unsupportedClaims,icon:"⚠️",color:p.unsupportedClaims>0?"text-red-400":"text-emerald-400"},
              {label:"GHOST SCORE",val:`${p.ghostScore}/100`,icon:"👻",color:p.ghostScore>=60?"text-red-400":p.ghostScore>=30?"text-amber-400":"text-emerald-400"},
            ].map(k=>(
              <div key={k.label} className="bg-neutral-800/60 rounded-xl p-2.5 border border-neutral-700/50">
                <div className="flex items-center justify-between mb-1"><span className="text-[8px] text-neutral-500 tracking-wider font-bold leading-tight">{k.label}</span><span className="text-sm">{k.icon}</span></div>
                <p className={`text-lg font-black font-mono ${k.color}`}>{k.val}</p>
              </div>
            ))}
          </div>

          {/* Daily activity */}
          <div className="bg-neutral-900/70 rounded-xl border border-neutral-800 p-4">
            <p className="text-[10px] text-neutral-400 tracking-widest font-bold mb-2 flex items-center gap-2"><Activity className="w-3 h-3 text-cyan-400"/>DAILY VISIT PATTERN</p>
            {sparkline.length>0?(
              <ResponsiveContainer width="100%" height={80}>
                <AreaChart data={sparkline} margin={{top:4,right:4,bottom:0,left:0}}>
                  <defs><linearGradient id="spkFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={trustColor} stopOpacity={0.5}/><stop offset="100%" stopColor={trustColor} stopOpacity={0}/></linearGradient></defs>
                  <Area type="monotone" dataKey="c" stroke={trustColor} strokeWidth={2} fill="url(#spkFill)" dot={false}/>
                  <XAxis dataKey="d" tick={{fill:"#525252",fontSize:8}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                  <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:8,color:"#fff",fontSize:10}} formatter={(v:any)=>[`${v} visits`,""]}/>
                </AreaChart>
              </ResponsiveContainer>
            ):<p className="text-xs text-neutral-600 text-center py-5">No raw visit data</p>}
          </div>

          {/* Weekly bars */}
          <div className="bg-neutral-900/70 rounded-xl border border-neutral-800 p-4">
            <p className="text-[10px] text-neutral-400 tracking-widest font-bold mb-2 flex items-center gap-2"><Calendar className="w-3 h-3 text-purple-400"/>WEEKLY JUNE PERFORMANCE</p>
            {weekBarData.length>0?(
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={weekBarData} margin={{top:4,right:4,bottom:0,left:0}} barSize={22}>
                  <XAxis dataKey="week" tick={{fill:"#737373",fontSize:9}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:"#111",border:"1px solid #333",borderRadius:8,color:"#fff",fontSize:10}} formatter={(v:any)=>[`${v} visits`,""]}/>
                  <Bar dataKey="visits" radius={[4,4,0,0]}>
                    {weekBarData.map((_,i)=><Cell key={i} fill={trustColor} opacity={0.7+i*0.06}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ):<p className="text-xs text-neutral-600 text-center py-5">No weekly summary data</p>}
          </div>

          {/* Store footprint */}
          <div className="bg-neutral-900/70 rounded-xl border border-neutral-800 p-4">
            <p className="text-[10px] text-neutral-400 tracking-widest font-bold mb-3 flex items-center gap-2"><Store className="w-3 h-3 text-purple-400"/>STORE COVERAGE FOOTPRINT</p>
            <div className="space-y-2">
              {shops.length>0?shops.map((s,i)=>{
                const cnt=empVisits.filter(v=>v.shopName===s).length;
                const maxCnt=Math.max(...shops.map(sh=>empVisits.filter(v=>v.shopName===sh).length),1);
                return(<div key={i} className="space-y-0.5">
                  <div className="flex justify-between text-[10px]"><span className="text-neutral-300 truncate max-w-[170px]">{s}</span><span className="text-cyan-400 font-mono">{cnt}v</span></div>
                  <div className="h-1.5 bg-neutral-800 rounded-full"><div className="h-full rounded-full" style={{width:`${(cnt/maxCnt)*100}%`,background:`linear-gradient(to right,#0e7490,${trustColor})`}}/></div>
                </div>);
              }):<p className="text-xs text-neutral-600">No visit data available</p>}
              {areas.length>0&&(<div className="mt-3 pt-2 border-t border-neutral-800"><div className="flex flex-wrap gap-1 mt-1">{areas.map(a=>(<span key={a} className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/12 text-purple-300 border border-purple-500/20">{a}</span>))}</div></div>)}
            </div>
          </div>

          {/* Store Coverage cross-ref */}
          <div className="bg-neutral-900/70 rounded-xl border border-neutral-800 p-4">
            <p className="text-[10px] text-neutral-400 tracking-widest font-bold mb-3 flex items-center gap-2"><Building2 className="w-3 h-3 text-emerald-400"/>STORE COVERAGE INTEL</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-neutral-800/60 rounded-lg p-2.5">
                <p className="text-[9px] text-neutral-500 mb-1">STORES VISITED</p>
                <p className="text-2xl font-black font-mono text-cyan-400">{p.storesInCoverage}</p>
              </div>
              <div className="bg-neutral-800/60 rounded-lg p-2.5">
                <p className="text-[9px] text-neutral-500 mb-1">SUBMISSION RATE</p>
                <p className={`text-2xl font-black font-mono ${compColor(p.submissionRate)}`}>{p.submissionRate}%</p>
              </div>
              <div className="bg-neutral-800/60 rounded-lg p-2.5">
                <p className="text-[9px] text-neutral-500 mb-1">DAYS SUBMITTED</p>
                <p className="text-2xl font-black font-mono text-white">{p.submittedDays}<span className="text-xs text-neutral-600">/{p.totalPossibleDays}</span></p>
              </div>
              <div className="bg-neutral-800/60 rounded-lg p-2.5">
                <p className="text-[9px] text-neutral-500 mb-1">AVG COMMENT LEN</p>
                <p className={`text-2xl font-black font-mono ${p.avgCommentLen<25?"text-red-400":p.avgCommentLen<60?"text-amber-400":"text-emerald-400"}`}>{p.avgCommentLen}c</p>
              </div>
            </div>
          </div>

          {/* Evidence / flags */}
          {p.suspiciousFlags.length>0&&(
            <div className="md:col-span-2 bg-red-950/15 rounded-xl border border-red-500/20 p-4">
              <p className="text-[10px] text-red-300 tracking-widest font-bold mb-3 flex items-center gap-2"><Zap className="w-3 h-3"/>EVIDENCE LOG — SUSPICIOUS BEHAVIOUR ({p.suspiciousFlags.length} FLAG{p.suspiciousFlags.length>1?"S":""})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {p.suspiciousFlags.map((f,i)=>(<div key={i} className="flex items-start gap-2 bg-red-500/5 rounded-lg px-3 py-2 border border-red-500/10"><span className="text-red-400 mt-0.5 shrink-0">⚡</span><span className="text-xs text-neutral-200">{f}</span></div>))}
              </div>
              {p.topRepeatedComment&&(<div className="mt-3 p-3 bg-neutral-900/60 rounded-lg border border-neutral-700"><p className="text-[9px] text-neutral-500 mb-1">MOST-REUSED COMMENT ({p.topRepeatedComment.count}×)</p><p className="text-xs text-neutral-300 italic">"{p.topRepeatedComment.text}"</p></div>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ EXPORT ENGINE ════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
function exportEvidence(profiles:EmployeeProfile[], visits:VisitRow[], storeCoverage:StoreCoverageRow[], audit:{severity:string;message:string}[]){
  const wb=XLSX.utils.book_new();
  const ts=new Date().toLocaleString();

  // Executive Summary
  const s1=[
    ["FIELD VISIT COMPLIANCE & INTEGRITY — EVIDENCE REPORT"],
    [`Generated: ${ts}`],
    [`Total Staff: ${profiles.length} | Overall Submission Rate: ${pct(profiles.reduce((s,p)=>s+p.submittedDays,0),profiles.reduce((s,p)=>s+p.totalPossibleDays,0))}%`],
    [`Avg Integrity Score: ${Math.round(profiles.reduce((s,p)=>s+p.integrityScore,0)/Math.max(1,profiles.length))}% | At-Risk Staff: ${profiles.filter(p=>p.trustTier==="At Risk").length}`],
    [],
    ["EMPLOYEE","CODE","DEPT","TOTAL REPORTS","UNIQUE STORES","JUNE VISITS","SUBMITTED DAYS","POSSIBLE DAYS","SUBMISSION %","INTEGRITY %","GHOST SCORE","FIELD TRUST","TIER","BLANK COMMENTS","COPY-PASTE","LATE NIGHT","UNSUPPORTED","MISSING DATES (SAMPLE)"],
    ...profiles.map(p=>[p.name,p.code,p.department,p.totalReports,p.uniqueStores,p.juneTotal||p.visitCount,p.submittedDays,p.totalPossibleDays,`${p.submissionRate}%`,`${p.integrityScore}%`,p.ghostScore,`${p.fieldTrust}%`,p.trustTier,p.blankComments,p.templatedRepeats,p.lateNightCount,p.unsupportedClaims,p.missingDates.slice(0,120)]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s1),"Executive Summary");

  // Ghost & Fraud Analysis
  const s2=[
    ["GHOST ACTIVITY & FRAUD RISK ANALYSIS"],
    [`Generated: ${ts}`],[],
    ["EMPLOYEE","CODE","GHOST SCORE","RISK LEVEL","BLANK COMMENTS","COPY-PASTE REPEATS","LATE NIGHT","UNSUPPORTED CLAIMS","SINGLE SHOP LOOP","AVG COMMENT LEN","TOP REPEATED COMMENT","FLAGS"],
    ...[...profiles].sort((a,b)=>b.ghostScore-a.ghostScore).map(p=>[p.name,p.code,p.ghostScore,ghostBadge(p.ghostScore).l,p.blankComments,p.templatedRepeats,p.lateNightCount,p.unsupportedClaims,p.singleShopLoop?"YES":"NO",p.avgCommentLen,p.topRepeatedComment?`"${p.topRepeatedComment.text.slice(0,80)}" ×${p.topRepeatedComment.count}`:"",p.suspiciousFlags.join(" | ")]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s2),"Ghost & Fraud Analysis");

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
    ["RAW VISIT EVIDENCE LOG"],
    [`Generated: ${ts}`],[],
    ["DATE","SPVR CODE","SPVR NAME","SHOP CODE","SHOP NAME","AREA","GOVERNORATE","SAMSUNG SHORTAGE","COMP SHORTAGE","SELLOUT MOVEMENT","BRAND","MOVEMENT","COMMENT","ACTION 1","ACCOUNT FEEDBACK","ACTION 2"],
    ...visits.map(v=>[v.date,v.spvrCode,v.spvrName,v.shopCode,v.shopName,v.area,v.governorate,v.samsungShortage,v.compShortage,v.selloutMovement,v.brand,v.movement,v.comment,v.action1,v.accountFeedback,v.action2]),
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s4),"Raw Visit Evidence");

  // Audit
  const s5=[["DATA AUDIT ISSUES"],[`Generated: ${ts}`],[],["SEVERITY","ISSUE"],...audit.map(a=>[a.severity.toUpperCase(),a.message])];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(s5),"Audit Issues");

  XLSX.writeFile(wb,`VisitCompliance_Evidence_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ══ MAP PANEL ════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────
const GOV_POS: Record<string,{x:number;y:number;label:string}>={
  "cairo":{x:430,y:320,label:"Cairo"},"القاهرة":{x:430,y:320,label:"Cairo"},
  "giza":{x:390,y:350,label:"Giza"},"الجيزة":{x:390,y:350,label:"Giza"},
  "alexandria":{x:275,y:205,label:"Alexandria"},"الإسكندرية":{x:275,y:205,label:"Alexandria"},
  "dakahlia":{x:480,y:220,label:"Dakahlia"},"الدقهلية":{x:480,y:220,label:"Dakahlia"},
  "sharqia":{x:510,y:262,label:"Sharqia"},"الشرقية":{x:510,y:262,label:"Sharqia"},
  "sharqiyah":{x:510,y:262,label:"Sharqia"},
  "qalyubia":{x:442,y:275,label:"Qalyubia"},"القليوبية":{x:442,y:275,label:"Qalyubia"},
  "beheira":{x:318,y:248,label:"Beheira"},"البحيرة":{x:318,y:248,label:"Beheira"},
  "behira":{x:318,y:248,label:"Beheira"},
  "gharbia":{x:378,y:250,label:"Gharbia"},"الغربية":{x:378,y:250,label:"Gharbia"},
  "monufia":{x:400,y:272,label:"Monufia"},"المنوفية":{x:400,y:272,label:"Monufia"},
  "menufia":{x:400,y:272,label:"Menufia"},
  "kafr el sheikh":{x:358,y:218,label:"Kafr El Sheikh"},"كفر الشيخ":{x:358,y:218,label:"Kafr El Sheikh"},
  "kafr el shaikh":{x:358,y:218,label:"Kafr El Sheikh"},
  "port said":{x:548,y:228,label:"Port Said"},"بورسعيد":{x:548,y:228,label:"Port Said"},
  "ismailia":{x:528,y:290,label:"Ismailia"},"الإسماعيلية":{x:528,y:290,label:"Ismailia"},
  "suez":{x:538,y:338,label:"Suez"},"السويس":{x:538,y:338,label:"Suez"},
  "fayoum":{x:390,y:392,label:"Fayoum"},"الفيوم":{x:390,y:392,label:"Fayoum"},
  "faiyum":{x:390,y:392,label:"Fayoum"},
  "beni suef":{x:422,y:432,label:"Beni Suef"},"بني سويف":{x:422,y:432,label:"Beni Suef"},
  "minya":{x:430,y:490,label:"Minya"},"المنيا":{x:430,y:490,label:"Minya"},
  "assiut":{x:440,y:548,label:"Assiut"},"أسيوط":{x:440,y:548,label:"Assiut"},
  "asyut":{x:440,y:548,label:"Assiut"},
  "sohag":{x:450,y:608,label:"Sohag"},"سوهاج":{x:450,y:608,label:"Sohag"},
  "qena":{x:458,y:658,label:"Qena"},"قنا":{x:458,y:658,label:"Qena"},
  "luxor":{x:458,y:698,label:"Luxor"},"الأقصر":{x:458,y:698,label:"Luxor"},
  "aswan":{x:458,y:758,label:"Aswan"},"أسوان":{x:458,y:758,label:"Aswan"},
  "damietta":{x:498,y:200,label:"Damietta"},"دمياط":{x:498,y:200,label:"Damietta"},
  "red sea":{x:550,y:420,label:"Red Sea"},"البحر الأحمر":{x:550,y:420,label:"Red Sea"},
};

function MapPanel({visits,storeCoverage}:{visits:VisitRow[];storeCoverage:StoreCoverageRow[]}){
  const [selArea,setSelArea]=useState("All");
  const [selGov,setSelGov]=useState("All");
  const [selDate,setSelDate]=useState("All");
  const [hov,setHov]=useState<string|null>(null);
  const [mapMode,setMapMode]=useState<"visits"|"stores">("visits");

  const areas=["All",...Array.from(new Set(visits.map(v=>v.area).filter(Boolean))).sort()];
  const govs=["All",...Array.from(new Set(visits.map(v=>v.governorate).filter(Boolean))).sort()];
  const dates=["All",...Array.from(new Set(visits.map(v=>v.date.slice(0,10)))).sort()];

  const filteredVisits=visits.filter(v=>
    (selArea==="All"||v.area===selArea)&&
    (selGov==="All"||v.governorate===selGov)&&
    (selDate==="All"||v.date.slice(0,10)===selDate)
  );

  // Aggregate dots
  const govData=new Map<string,{count:number;label:string;x:number;y:number;spvrs:Set<string>;stores:Set<string>}>();
  for(const v of filteredVisits){
    const key=(v.governorate||"").toLowerCase().trim();
    const pos=GOV_POS[key];if(!pos)continue;
    if(!govData.has(key))govData.set(key,{count:0,label:pos.label,x:pos.x,y:pos.y,spvrs:new Set(),stores:new Set()});
    const d=govData.get(key)!;d.count++;d.spvrs.add(v.spvrCode);d.stores.add(v.shopCode);
  }

  // Store coverage overlay
  const storeGovData=new Map<string,{count:number;label:string;x:number;y:number}>();
  if(mapMode==="stores"){
    for(const s of storeCoverage){
      const key=s.governorate.toLowerCase().trim();const pos=GOV_POS[key];if(!pos)continue;
      if(!storeGovData.has(key))storeGovData.set(key,{count:0,label:pos.label,x:pos.x,y:pos.y});
      storeGovData.get(key)!.count+=s.totalVisits;
    }
  }

  const activeData=mapMode==="stores"?storeGovData:govData;
  const maxCount=Math.max(...Array.from(activeData.values()).map(d=>d.count),1);
  const ledColor=(c:number)=>{
    const t=c/maxCount;
    if(t>0.66)return{fill:"#f87171",glow:"glowRed",ring:"#f8717133"};
    if(t>0.33)return{fill:"#fbbf24",glow:"glowAmber",ring:"#fbbf2433"};
    return{fill:"#22d3ee",glow:"glowCyan",ring:"#22d3ee33"};
  };

  return(
    <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400"/>
          <span className="text-xs text-neutral-300 tracking-wider font-semibold">FIELD ACTIVITY MAP — EGYPT</span>
          <span className="text-[10px] text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full font-mono">{filteredVisits.length.toLocaleString()} visits · {govData.size} governorates</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Map mode */}
          <div className="flex gap-0.5 p-0.5 bg-neutral-800 rounded-lg border border-neutral-700">
            {(["visits","stores"] as const).map(m=>(
              <button key={m} onClick={()=>setMapMode(m)} className={`text-[10px] px-2.5 py-1 rounded font-semibold capitalize transition-all ${mapMode===m?"bg-neutral-600 text-white":"text-neutral-500 hover:text-neutral-300"}`}>{m}</button>
            ))}
          </div>
          {/* Filters */}
          {[{val:selArea,set:setSelArea,opts:areas,placeholder:"Area"},{val:selGov,set:setSelGov,opts:govs,placeholder:"Governorate"},{val:selDate,set:setSelDate,opts:dates,placeholder:"Date"}].map((f,i)=>(
            <div key={i} className="relative">
              <select value={f.val} onChange={e=>f.set(e.target.value)} className="appearance-none bg-neutral-800 border border-neutral-700 text-xs text-neutral-300 rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-emerald-500 max-w-[120px] truncate">
                {f.opts.map(o=><option key={o}>{o}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none"/>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* Legend */}
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          {[{c:"#22d3ee",l:"Low"},{c:"#fbbf24",l:"Medium"},{c:"#f87171",l:"High"}].map(d=>(
            <div key={d.l} className="flex items-center gap-1.5 text-[10px] text-neutral-400"><div className="w-2.5 h-2.5 rounded-full" style={{background:d.c,boxShadow:`0 0 6px ${d.c}`}}/>{d.l} volume</div>
          ))}
          <span className="text-[10px] text-neutral-600 ml-auto">Dot size = visit density · Hover for details</span>
        </div>

        {/* SVG MAP */}
        <div className="relative rounded-xl overflow-hidden" style={{background:"linear-gradient(135deg,#030308 0%,#08081a 50%,#030308 100%)"}}>
          <svg viewBox="150 150 510 700" width="100%" className="block">
            <defs><Defs/></defs>
            {/* Grid */}
            {Array.from({length:22}).map((_,i)=>(<line key={`h${i}`} x1="150" y1={150+i*33} x2="660" y2={150+i*33} stroke="#fff" strokeOpacity="0.02" strokeWidth="0.5"/>))}
            {Array.from({length:16}).map((_,i)=>(<line key={`v${i}`} x1={150+i*33} y1="150" x2={150+i*33} y2="860" stroke="#fff" strokeOpacity="0.02" strokeWidth="0.5"/>))}
            {/* Mediterranean */}
            <path d="M 230 185 Q 310 170 400 172 Q 475 174 550 188" stroke="#0ea5e9" strokeWidth="2.5" fill="none" strokeOpacity="0.45"/>
            <text x="300" y="168" fill="#0ea5e9" fontSize="7" opacity="0.5" fontFamily="monospace">Mediterranean Sea</text>
            {/* Nile */}
            <path d="M 440 800 Q 435 700 440 610 Q 445 510 432 410 Q 422 355 435 285 Q 440 255 405 228" stroke="#1d4ed8" strokeWidth="2.5" fill="none" strokeOpacity="0.3" strokeDasharray="5 3"/>
            <text x="415" y="520" fill="#1d4ed8" fontSize="7" opacity="0.3" fontFamily="monospace" transform="rotate(-80,415,520)">Nile River</text>
            {/* Red Sea coast */}
            <path d="M 555 250 Q 600 350 610 480 Q 605 560 580 650" stroke="#0ea5e9" strokeWidth="1.5" fill="none" strokeOpacity="0.25" strokeDasharray="3 4"/>

            {/* LED dots */}
            {Array.from(activeData.entries()).map(([key,d])=>{
              const{fill,glow,ring}=ledColor(d.count);
              const r=Math.max(9,Math.min(24,9+Math.round((d.count/maxCount)*15)));
              const isH=hov===key;
              return(
                <g key={key} style={{cursor:"pointer"}} onMouseEnter={()=>setHov(key)} onMouseLeave={()=>setHov(null)}>
                  {/* Pulse ring */}
                  <circle cx={d.x} cy={d.y} r={r+10} fill={ring} opacity={isH?0.55:0.22} style={{transition:"all 0.2s"}}/>
                  {/* 3D shadow */}
                  <ellipse cx={d.x+2} cy={d.y+5} rx={r*0.9} ry={r*0.3} fill="#000" opacity={0.45}/>
                  {/* Main dot */}
                  <circle cx={d.x} cy={d.y} r={r} fill={fill} filter={`url(#${glow})`} opacity={isH?1:0.82} style={{transition:"r 0.2s"}}/>
                  {/* Shine */}
                  <circle cx={d.x-r*0.32} cy={d.y-r*0.32} r={r*0.28} fill="white" opacity={0.22}/>
                  {/* Count */}
                  <text x={d.x} y={d.y+r*0.38} textAnchor="middle" fill="white" fontSize={r<12?7:9} fontFamily="monospace" fontWeight="bold">{d.count}</text>
                  {/* Label */}
                  <text x={d.x} y={d.y+r+12} textAnchor="middle" fill="#a3a3a3" fontSize={8} fontFamily="monospace">{d.label}</text>
                  {/* Hover card */}
                  {isH&&(
                    <g>
                      <rect x={d.x-68} y={d.y-r-60} width={136} height={50} rx={7} fill="#0d0d1a" stroke={fill} strokeWidth={0.8} strokeOpacity={0.8} filter="url(#shadow)"/>
                      <text x={d.x} y={d.y-r-44} textAnchor="middle" fill={fill} fontSize={11} fontWeight="bold" fontFamily="monospace">{d.label}</text>
                      <text x={d.x} y={d.y-r-30} textAnchor="middle" fill="#d4d4d4" fontSize={9} fontFamily="monospace">{d.count} {mapMode==="stores"?"visits":"visits"}</text>
                      {'spvrs' in d&&<text x={d.x} y={d.y-r-17} textAnchor="middle" fill="#737373" fontSize={8} fontFamily="monospace">{(d as any).spvrs?.size} SPVRs · {(d as any).stores?.size} shops</text>}
                    </g>
                  )}
                </g>
              );
            })}
            {activeData.size===0&&<text x="400" y="500" textAnchor="middle" fill="#404040" fontSize="13" fontFamily="monospace">No data for selected filters</text>}
          </svg>
        </div>

        {/* Top governorate pills */}
        {activeData.size>0&&(
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from(activeData.entries()).sort((a,b)=>b[1].count-a[1].count).slice(0,10).map(([k,d])=>{
              const{fill}=ledColor(d.count);
              return(<span key={k} className="text-[10px] px-2.5 py-1 rounded-full border font-mono cursor-pointer hover:opacity-80 transition-opacity" style={{borderColor:`${fill}44`,background:`${fill}12`,color:fill}} onClick={()=>{setSelGov(d.label);}}>{d.label} · {d.count}</span>);
            })}
          </div>
        )}
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
  const [files,setFiles]=useState<LoadedFile[]>([]);
  const [isDragging,setIsDragging]=useState(false);
  const [isProcessing,setIsProcessing]=useState(false);
  // UI
  const [section,setSection]=useState<"dashboard"|"map"|"stores">("dashboard");
  const [lowestTab,setLowestTab]=useState<"trust"|"ghost">("trust");
  const [deptFilter,setDeptFilter]=useState("All");
  const [empSearch,setEmpSearch]=useState("");
  const [scorecardEmp,setScorecardEmp]=useState<EmployeeProfile|null>(null);

  const handleFiles=useCallback(async(fileList:FileList)=>{
    setIsProcessing(true);
    const newLoaded:LoadedFile[]=[];
    let nEmp:EmployeeSummaryRow[]|null=null, nVisits:VisitRow[]|null=null;
    let nStore:StoreCoverageRow[]|null=null;
    let nSub:Map<string,SubmissionRow>|null=null, nWeekly:Map<string,WeeklySummaryRow>|null=null;
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
        else{newLoaded.push({name:file.name,kind:"unknown",size:fmtB(file.size),rows:0});}
      }catch(e){newLoaded.push({name:file.name,kind:"unknown",size:"—",rows:0});}
    }
    setFiles(prev=>{const ex=new Set(prev.map(f=>f.name));return[...prev,...newLoaded.filter(f=>!ex.has(f.name))];});
    if(nEmp) setEmpSummary(nEmp);
    if(nVisits) setVisits(nVisits);
    if(nStore) setStoreCoverage(nStore);
    if(nSub) setSubmissionMap(nSub);
    if(nWeekly) setWeeklyMap(nWeekly);
    setIsProcessing(false);
  },[]);

  const profiles=useMemo(()=>buildProfiles(empSummary,visits,storeCoverage,submissionMap,weeklyMap),[empSummary,visits,storeCoverage,submissionMap,weeklyMap]);

  const audit=useMemo(()=>{
    const issues:{severity:"high"|"medium";message:string}[]=[];
    const seen=new Set<string>();
    for(const p of profiles){
      if(seen.has(p.code))issues.push({severity:"high",message:`Duplicate code ${p.code} (${p.name})`});seen.add(p.code);
      if(!submissionMap.has(p.code))issues.push({severity:"medium",message:`${p.name} (${p.code}) — missing from Submission Matrix`});
      if(!weeklyMap.has(p.code))issues.push({severity:"medium",message:`${p.name} (${p.code}) — missing from Weekly Summary`});
      if(p.totalPossibleDays>0&&p.submittedDays===0)issues.push({severity:"high",message:`${p.name} (${p.code}) — zero days submitted in entire period`});
      if(p.unsupportedClaims>0)issues.push({severity:"high",message:`${p.name}: ${p.unsupportedClaims} shortage/movement claims with blank comments`});
      if(p.lateNightCount>p.visitCount*0.6&&p.visitCount>=4)issues.push({severity:"high",message:`${p.name}: ${p.lateNightCount}/${p.visitCount} reports filed 23:00–04:00 — batch backdating likely`});
      if(p.topRepeatedComment&&p.topRepeatedComment.count>=4)issues.push({severity:"medium",message:`${p.name}: reused same comment ${p.topRepeatedComment.count}× — copy-paste detected`});
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
  const atRisk=profiles.filter(p=>p.trustTier==="At Risk").length;
  const totalVisitsAll=visits.length;
  const totalStoresAll=storeCoverage.length;

  const statusBuckets=useMemo(()=>[
    {name:"Healthy",value:profiles.filter(p=>p.trustTier==="Healthy").length,color:"#34d399"},
    {name:"Watch",value:profiles.filter(p=>p.trustTier==="Watch").length,color:"#fbbf24"},
    {name:"At Risk",value:profiles.filter(p=>p.trustTier==="At Risk").length,color:"#f87171"},
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

  const kindLabel:Record<FileKind,string>={employee_summary:"Employee Summary",mobile_dep:"Mobile Visits",store_coverage:"Store Coverage",submission_matrix:"Submission Matrix",weekly_summary:"Weekly Summary",unknown:"Unrecognised"};
  const kindColor:Record<FileKind,string>={employee_summary:"text-cyan-400",mobile_dep:"text-purple-400",store_coverage:"text-emerald-400",submission_matrix:"text-amber-400",weekly_summary:"text-blue-400",unknown:"text-red-400"};

  return(
    <div className="p-4 sm:p-6 space-y-5 max-w-full">

      {/* SCORECARD */}
      {scorecardEmp&&<ScorecardModal p={scorecardEmp} visits={visits} storeCoverage={storeCoverage} onClose={()=>setScorecardEmp(null)}/>}

      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-9 rounded-full" style={{background:"linear-gradient(to bottom,#22d3ee,#a855f7,#f87171)"}}/>
            <div>
              <h1 className="text-xl font-black text-white tracking-widest">FIELD COMPLIANCE & INTEGRITY AUDITOR</h1>
              <p className="text-[10px] text-neutral-500 mt-0.5">5-source data fusion · 3D scorecards · ghost detection · field map · evidence export</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasData&&(<button onClick={()=>exportEvidence(profiles,visits,storeCoverage,audit)}
            className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl hover:bg-emerald-500/20 transition-colors">
            <Download className="w-3.5 h-3.5"/>Export Evidence
          </button>)}
          {files.length>0&&(<button onClick={()=>{setFiles([]);setEmpSummary([]);setVisits([]);setStoreCoverage([]);setSubmissionMap(new Map());setWeeklyMap(new Map());}}
            className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 px-3 py-2 rounded-xl hover:bg-red-500/20 transition-colors">Clear all</button>)}
        </div>
      </div>

      {/* UPLOAD */}
      <div onDragOver={e=>{e.preventDefault();setIsDragging(true);}} onDragLeave={()=>setIsDragging(false)}
        onDrop={e=>{e.preventDefault();setIsDragging(false);if(e.dataTransfer.files.length)handleFiles(e.dataTransfer.files);}}
        className={`relative border-2 border-dashed rounded-xl p-7 text-center transition-all ${isDragging?"border-cyan-500 bg-cyan-500/5":"border-neutral-700 hover:border-neutral-600 bg-neutral-900"}`}>
        <input type="file" accept=".xlsx,.xls" multiple onChange={e=>{if(e.target.files?.length)handleFiles(e.target.files);}} className="absolute inset-0 opacity-0 cursor-pointer"/>
        <Upload className={`w-8 h-8 mx-auto mb-2.5 ${isDragging?"text-cyan-400":"text-neutral-500"}`}/>
        <p className="text-sm font-bold text-white mb-1">Drop all 5 files here — or click to browse</p>
        <div className="flex flex-wrap justify-center gap-2 text-[10px]">
          {[{label:"Employee_Summary.xlsx",color:"text-cyan-400"},{label:"Mobile_Dep.xlsx",color:"text-purple-400"},{label:"Store_Coverage.xlsx",color:"text-emerald-400"},{label:"Submission_Matrix.xlsx",color:"text-amber-400"},{label:"Weekly_Summary.xlsx",color:"text-blue-400"}].map(f=>(<span key={f.label} className={`font-mono ${f.color}`}>{f.label}</span>))}
        </div>
        {isProcessing&&<div className="mt-3 flex items-center justify-center gap-2 text-xs text-cyan-400"><RefreshCw className="w-3.5 h-3.5 animate-spin"/>Parsing workbooks…</div>}
      </div>

      {/* FILE CHIPS */}
      {files.length>0&&(
        <div className="flex flex-wrap gap-2">
          {files.map(f=>(<div key={f.name} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-700 bg-neutral-900 text-xs">
            <FileSpreadsheet className={`w-3.5 h-3.5 ${kindColor[f.kind]}`}/>
            <span className="text-neutral-300 max-w-[160px] truncate">{f.name}</span>
            <span className="text-neutral-600">{f.size}</span>
            <span className={`${kindColor[f.kind]} font-semibold`}>{kindLabel[f.kind]}</span>
            <span className="text-neutral-600 font-mono">{f.rows}r</span>
          </div>))}
        </div>
      )}

      {!hasData&&files.length===0&&(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {icon:Users,color:"cyan",title:"Employee Summary",desc:"SPVR profiles, total reports, unique stores, activity dates"},
            {icon:Activity,color:"purple",title:"Mobile Dep",desc:"Raw daily visits — comments, shortage claims, brands, actions"},
            {icon:Store,color:"emerald",title:"Store Coverage",desc:"Shop-level visit counts, SPVR reach, first/last visit dates"},
            {icon:CheckCircle,color:"amber",title:"Submission Matrix",desc:"Daily submission timestamps, missing date audit trail"},
            {icon:Calendar,color:"blue",title:"Weekly Summary",desc:"Week-by-week visit counts, June performance grid"},
          ].map((c,i)=>(<div key={i} className={`bg-neutral-900 border border-${c.color}-500/25 rounded-xl p-4`}>
            <c.icon className={`w-5 h-5 mb-2 text-${c.color}-400`}/>
            <p className="text-white font-bold text-sm mb-1">{c.title}</p>
            <p className="text-xs text-neutral-500 leading-relaxed">{c.desc}</p>
          </div>))}
        </div>
      )}

      {/* NAV */}
      {hasData&&(
        <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-700 rounded-xl w-fit">
          {([["dashboard","📊 Dashboard"],["map","🗺️ Field Map"],["stores","🏪 Stores"]] as const).map(([id,label])=>(
            <button key={id} onClick={()=>setSection(id)} className={`text-xs px-4 py-2 rounded-lg font-bold tracking-wide transition-all ${section===id?"bg-neutral-700 text-white":"text-neutral-500 hover:text-neutral-300"}`}>{label}</button>
          ))}
        </div>
      )}

      {/* ══ MAP ══════════════════════════════════════════════════════════════ */}
      {hasData&&section==="map"&&<MapPanel visits={visits} storeCoverage={storeCoverage}/>}

      {/* ══ STORES ═══════════════════════════════════════════════════════════ */}
      {hasData&&section==="stores"&&(
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700">
            <div className="flex items-center gap-2"><Store className="w-4 h-4 text-emerald-400"/><span className="text-xs text-neutral-300 font-semibold tracking-wider">STORE COVERAGE INTELLIGENCE — {storeCoverage.length} SHOPS</span></div>
            <span className="text-xs text-neutral-500">{Array.from(new Set(storeCoverage.map(s=>s.governorate))).length} governorates</span>
          </div>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-neutral-800">
            {[
              {label:"TOTAL STORES",val:storeCoverage.length,color:"text-white"},
              {label:"TOTAL VISITS",val:storeCoverage.reduce((s,st)=>s+st.totalVisits,0),color:"text-cyan-400"},
              {label:"AVG VISITS/STORE",val:Math.round(storeCoverage.reduce((s,st)=>s+st.totalVisits,0)/Math.max(1,storeCoverage.length)),color:"text-purple-400"},
              {label:"MAX VISITS (1 STORE)",val:Math.max(...storeCoverage.map(s=>s.totalVisits)),color:"text-amber-400"},
            ].map(k=>(<div key={k.label} className="bg-neutral-800/60 rounded-xl p-3 border border-neutral-700/50">
              <p className="text-[9px] text-neutral-500 tracking-wider font-bold mb-1">{k.label}</p>
              <p className={`text-2xl font-black font-mono ${k.color}`}>{k.val.toLocaleString()}</p>
            </div>))}
          </div>
          {/* Store table */}
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] text-neutral-500 border-b border-neutral-800 sticky top-0 bg-neutral-900">
                {["SHOP CODE","SHOP NAME","AREA","GOVERNORATE","TOTAL VISITS","UNIQUE SPVRs","FIRST VISIT","LAST VISIT","ACTIVITY"].map(h=>(<th key={h} className="text-left py-2.5 px-3 font-semibold tracking-wider whitespace-nowrap">{h}</th>))}
              </tr></thead>
              <tbody>{storeCoverage.sort((a,b)=>b.totalVisits-a.totalVisits).map(s=>{
                const actColor=s.totalVisits>=5?"text-emerald-400":s.totalVisits>=2?"text-amber-400":"text-red-400";
                const daysSinceFirst=s.firstVisit&&s.lastVisit?Math.round((new Date(s.lastVisit).getTime()-new Date(s.firstVisit).getTime())/86400000):0;
                return(<tr key={s.shopCode} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors">
                  <td className="py-2 px-3 font-mono text-cyan-400 text-xs">{s.shopCode}</td>
                  <td className="py-2 px-3 text-white text-xs font-medium">{s.shopName}</td>
                  <td className="py-2 px-3 text-neutral-400 text-xs">{s.area||"—"}</td>
                  <td className="py-2 px-3 text-neutral-400 text-xs">{s.governorate}</td>
                  <td className={`py-2 px-3 font-mono font-bold text-xs text-center ${actColor}`}>{s.totalVisits}</td>
                  <td className="py-2 px-3 font-mono text-neutral-300 text-xs text-center">{s.uniqueSPVRs}</td>
                  <td className="py-2 px-3 text-neutral-500 text-xs">{s.firstVisit}</td>
                  <td className="py-2 px-3 text-neutral-500 text-xs">{s.lastVisit}</td>
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
            {label:"AVG INTEGRITY",val:`${avgIntegrity}%`,sub:"",color:intgColor(avgIntegrity),border:"border-cyan-500/20",icon:Gauge},
            {label:"AT-RISK",val:atRisk,sub:"staff",color:"text-red-400",border:"border-red-500/20",icon:ShieldAlert},
            {label:"TOTAL VISITS",val:totalVisitsAll.toLocaleString(),sub:"raw visits",color:"text-purple-400",border:"border-purple-500/20",icon:Activity},
            {label:"STORES COVERED",val:totalStoresAll.toLocaleString(),sub:"shops",color:"text-emerald-400",border:"border-emerald-500/20",icon:Store},
          ].map(k=>(<div key={k.label} className={`bg-neutral-900 border ${k.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-2"><span className="text-[9px] text-neutral-400 tracking-wider font-bold">{k.label}</span><k.icon className={`w-4 h-4 ${k.color}`}/></div>
            <p className={`text-2xl font-black font-mono ${k.color}`}>{k.val}</p>
            {k.sub&&<p className="text-[9px] text-neutral-600 mt-0.5">{k.sub}</p>}
          </div>))}
        </div>

        {/* CHARTS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Area trend */}
          <div className="lg:col-span-2 bg-neutral-900 border border-neutral-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-cyan-400"/><p className="text-xs text-neutral-300 font-semibold tracking-wider">DAILY VISIT VOLUME TREND</p></div>
              {visits.length>0&&<span className="text-sm font-bold font-mono text-cyan-400">{avgVolume} <span className="text-[10px] text-neutral-600">avg/day</span></span>}
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
            ):<div className="h-[210px] flex items-center justify-center"><p className="text-xs text-neutral-600">Upload Mobile_Dep.xlsx to see trend</p></div>}
          </div>

          {/* Trust donut */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4"><Target className="w-4 h-4 text-purple-400"/><p className="text-xs text-neutral-300 font-semibold tracking-wider">FIELD TRUST SPLIT</p></div>
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <ResponsiveContainer width="100%" height={175}>
                <PieChart><defs><Defs/></defs>
                  <Pie data={statusBuckets} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={5} style={{filter:"url(#shadow)"}}>
                    {statusBuckets.map((s,i)=>(<Cell key={i} fill={s.color} style={{filter:s.name==="At Risk"&&s.value>0?"drop-shadow(0 0 10px #f87171)":"none"}}/>))}
                  </Pie>
                  <Tooltip contentStyle={{background:"#0a0a0a",border:"1px solid #2a2a2a",borderRadius:8,color:"#fff",fontSize:11}}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-black font-mono text-white">{profiles.length}</p>
                <p className="text-[10px] text-neutral-500">staff</p>
              </div>
            </div>
            <div className="flex justify-center gap-2 mt-2 flex-wrap">
              {statusBuckets.map(s=>(<span key={s.name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border" style={{borderColor:`${s.color}44`,background:`${s.color}14`,color:s.color}}><span className="w-1.5 h-1.5 rounded-full" style={{background:s.color}}/>{s.name} {s.value}</span>))}
            </div>
          </div>
        </div>

        {/* DEPT RANKING */}
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700">
            <div className="flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400"/><span className="text-xs text-neutral-300 font-semibold tracking-wider">DEPARTMENT RANKING</span></div>
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
          <table className="w-full text-sm border-t border-neutral-800">
            <thead><tr className="text-[9px] text-neutral-500 bg-neutral-950/60">{["#","DEPARTMENT","STAFF","SUBMISSION","AVG INTEGRITY","AVG TRUST","CHRONIC"].map(h=>(<th key={h} className="text-left py-2 px-4 font-bold tracking-wider">{h}</th>))}</tr></thead>
            <tbody>{deptRollup.map((d,i)=>(<tr key={d.dept} className="border-t border-neutral-800 hover:bg-neutral-800/40 transition-colors">
              <td className="py-2.5 px-4 text-neutral-500 font-mono text-xs">#{i+1}</td>
              <td className="py-2.5 px-4 text-white font-bold">{d.dept}</td>
              <td className="py-2.5 px-4 font-mono text-neutral-300 text-xs">{d.headcount}</td>
              <td className={`py-2.5 px-4 font-mono font-bold text-xs ${compColor(d.compliance)}`}>{d.compliance}%</td>
              <td className={`py-2.5 px-4 font-mono font-bold text-xs ${intgColor(d.avgIntegrity)}`}>{d.avgIntegrity}%</td>
              <td className={`py-2.5 px-4 font-mono font-bold text-xs ${compColor(d.avgTrust)}`}>{d.avgTrust}%</td>
              <td className="py-2.5 px-4 font-mono text-xs">{d.chronic>0?<span className="text-red-400 font-bold">{d.chronic}</span>:<span className="text-neutral-600">—</span>}</td>
            </tr>))}</tbody>
          </table>
        </div>

        {/* MANAGER ACTION DESK */}
        <div className="bg-neutral-900 border border-purple-500/20 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700 flex-wrap gap-3">
            <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-purple-400"/><span className="text-xs text-purple-300 font-bold tracking-wider">MANAGER ACTION DESK — DATA NEVER LIES</span></div>
            <div className="flex gap-1 p-1 bg-neutral-800 border border-neutral-700 rounded-lg">
              {([["trust","⬇ Lowest Trust"],["ghost","👻 Ghost Activity"]] as const).map(([id,label])=>(
                <button key={id} onClick={()=>setLowestTab(id)} className={`text-[10px] px-3 py-1.5 rounded font-bold tracking-wider transition-all ${lowestTab===id?id==="ghost"?"bg-red-500/20 text-red-300 border border-red-500/30":"bg-purple-500/20 text-purple-300 border border-purple-500/30":"text-neutral-500 hover:text-neutral-300"}`}>{label}</button>
              ))}
            </div>
          </div>

          {lowestTab==="trust"&&(<>
            <div className="px-5 py-2 border-b border-neutral-800 bg-neutral-950/40">
              <p className="text-[10px] text-neutral-500">Field Trust = submission rate (50%) + integrity score (50%). Click any row or 🔍 button to open 3D employee scorecard. Uses all 5 file sources.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[9px] text-neutral-500 border-b border-neutral-800 bg-neutral-950/40 sticky top-0">
                  {["EMPLOYEE","DEPT","REPORTS","JUNE VISITS","SUBMITTED","SUBMISSION%","BLANK","COPY-PASTE","LATE NIGHT","WEEKS","INTEGRITY","TRUST","WHY FOLLOW UP","CARD"].map(h=>(<th key={h} className="text-left py-2.5 px-3 font-bold tracking-wider whitespace-nowrap">{h}</th>))}
                </tr></thead>
                <tbody>{lowestTrust.slice(0,18).map(p=>(
                  <tr key={p.code} className={`border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors cursor-pointer ${p.trustTier==="At Risk"?"bg-red-950/8":""}`} onClick={()=>setScorecardEmp(p)}>
                    <td className="py-2.5 px-3"><p className="text-white text-xs font-bold leading-tight">{p.name}</p><p className="text-cyan-400 font-mono text-[9px]">{p.code}</p></td>
                    <td className="py-2.5 px-3 text-neutral-400 text-xs">{p.department}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-300 text-xs text-center">{p.totalReports}</td>
                    <td className="py-2.5 px-3 font-mono text-purple-400 text-xs text-center font-bold">{p.juneTotal||p.visitCount}</td>
                    <td className="py-2.5 px-3 font-mono text-neutral-300 text-xs text-center">{p.submittedDays}<span className="text-neutral-600">/{p.totalPossibleDays}</span></td>
                    <td className={`py-2.5 px-3 font-mono font-bold text-xs text-center ${compColor(p.submissionRate)}`}>{p.submissionRate}%</td>
                    <td className="py-2.5 px-3 text-center text-xs font-mono">{p.blankComments>0?<span className="text-red-400 font-bold">{p.blankComments}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-mono">{p.templatedRepeats>0?<span className="flex items-center justify-center gap-1 text-amber-400"><Copy className="w-3 h-3"/>{p.templatedRepeats}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3 text-center text-xs font-mono">{p.lateNightCount>0?<span className="flex items-center justify-center gap-1 text-violet-400"><Clock className="w-3 h-3"/>{p.lateNightCount}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3"><WeekSparkline totals={p.weekTotals}/></td>
                    <td className={`py-2.5 px-3 text-center font-mono font-bold text-xs ${intgColor(p.integrityScore)}`}>{p.integrityScore}%</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${p.trustTier==="At Risk"?"bg-red-500/15 text-red-300 border-red-500/30":p.trustTier==="Watch"?"bg-amber-500/15 text-amber-300 border-amber-500/30":"bg-emerald-500/15 text-emerald-300 border-emerald-500/30"}`}>{p.fieldTrust}%</span>
                    </td>
                    <td className="py-2.5 px-3 min-w-[160px]" onClick={e=>e.stopPropagation()}>
                      <ul className="space-y-0.5">
                        {[
                          p.submissionRate<50&&`Only ${p.submissionRate}% submission rate`,
                          p.blankComments>0&&`${p.blankComments} blank comments`,
                          p.templatedRepeats>=3&&"Repeated copy-paste detected",
                          p.lateNightCount>p.visitCount*0.5&&p.visitCount>=4&&"Batch late-night filing",
                          p.unsupportedClaims>0&&`${p.unsupportedClaims} unsupported claims`,
                        ].filter(Boolean).slice(0,3).map((r,i)=>(<li key={i} className="text-[9px] text-neutral-300 flex items-start gap-1"><span className="text-red-400 shrink-0">•</span>{r}</li>))}
                      </ul>
                    </td>
                    <td className="py-2.5 px-3" onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setScorecardEmp(p)} className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg hover:bg-cyan-500/20 transition-colors whitespace-nowrap">
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
              <p className="text-[10px] text-neutral-500">Ghost Score: blank (30%) + copy-paste (20%) + late-night batch (25%) + unsupported claims (15%) + single-shop loop (10%). Powered by Mobile_Dep.xlsx raw data.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-[9px] text-neutral-500 border-b border-neutral-800 bg-neutral-950/40 sticky top-0">
                  {["EMPLOYEE","VISITS","SHOPS","AVG COMMENT","LATE NIGHT","BLANK %","UNSUPPORTED","GHOST SCORE","RISK","FLAGS","CARD"].map(h=>(<th key={h} className="text-left py-2.5 px-3 font-bold tracking-wider whitespace-nowrap">{h}</th>))}
                </tr></thead>
                <tbody>{ghostRanking.slice(0,18).map(p=>{
                  const badge=ghostBadge(p.ghostScore);
                  return(<tr key={p.code} className={`border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors cursor-pointer ${p.ghostScore>=60?"bg-red-950/8":""}`} onClick={()=>setScorecardEmp(p)}>
                    <td className="py-2.5 px-3"><p className="text-white text-xs font-bold">{p.name}</p><p className="text-cyan-400 font-mono text-[9px]">{p.code}</p></td>
                    <td className="py-2.5 px-3 font-mono text-neutral-300 text-xs text-center">{p.visitCount}</td>
                    <td className="py-2.5 px-3 font-mono text-xs text-center">{p.singleShopLoop?<span className="text-red-400 font-bold">{p.storesInCoverage}</span>:p.storesInCoverage}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-xs"><span className={p.avgCommentLen<25?"text-red-400":p.avgCommentLen<60?"text-amber-400":"text-emerald-400"}>{p.avgCommentLen}c</span></td>
                    <td className="py-2.5 px-3 text-center font-mono text-xs">{p.lateNightCount>0?<span className="flex items-center justify-center gap-1 text-violet-400"><Clock className="w-3 h-3"/>{p.lateNightCount}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3 text-center font-mono text-xs"><span className={p.blankComments>0?"text-red-400":"text-neutral-600"}>{pct(p.blankComments,p.visitCount)}%</span></td>
                    <td className="py-2.5 px-3 text-center font-mono text-xs">{p.unsupportedClaims>0?<span className="flex items-center justify-center gap-1 text-red-400"><FileWarning className="w-3 h-3"/>{p.unsupportedClaims}</span>:<span className="text-neutral-600">—</span>}</td>
                    <td className="py-2.5 px-3"><div className="flex flex-col gap-1"><GhostMeter score={p.ghostScore}/><p className="text-[9px] font-mono text-neutral-400">{p.ghostScore}/100</p></div></td>
                    <td className="py-2.5 px-3"><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badge.c}`}>{badge.l}</span></td>
                    <td className="py-2.5 px-3" onClick={e=>e.stopPropagation()}><FlagTooltip p={p}/></td>
                    <td className="py-2.5 px-3" onClick={e=>e.stopPropagation()}><button onClick={()=>setScorecardEmp(p)} className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg hover:bg-cyan-500/20 transition-colors whitespace-nowrap"><Fingerprint className="w-3 h-3"/>3D Card</button></td>
                  </tr>);
                })}</tbody>
              </table>
            </div>
          </>)}
        </div>

        {/* AUDIT */}
        {audit.length>0&&(
          <div className="bg-neutral-900 border border-amber-500/25 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-amber-400"/><span className="text-xs text-amber-300 font-bold tracking-wider">DATA AUDIT — {audit.length} ISSUE{audit.length>1?"S":""} DETECTED</span></div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {audit.map((a,i)=>(<div key={i} className={`text-xs flex items-start gap-2 ${a.severity==="high"?"text-red-300":"text-neutral-400"}`}>
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${a.severity==="high"?"bg-red-400":"bg-amber-400"}`}/>{a.message}
              </div>))}
            </div>
          </div>
        )}

        {/* EMPLOYEE TABLE */}
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700 flex-wrap gap-2">
            <span className="text-xs text-neutral-300 font-bold tracking-wider">ALL EMPLOYEES — FULL PROFILE</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500"/><input value={empSearch} onChange={e=>setEmpSearch(e.target.value)} placeholder="Search name/code…" className="bg-neutral-800 border border-neutral-600 text-xs text-neutral-300 rounded-lg pl-7 pr-3 py-1.5 focus:outline-none focus:border-cyan-500 w-40"/></div>
              <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="bg-neutral-800 border border-neutral-600 text-xs text-neutral-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500">
                {departments.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-[9px] text-neutral-500 border-b border-neutral-800 sticky top-0 bg-neutral-900">
                {["EMPLOYEE","CODE","DEPT","REPORTS","UNIQUE STORES","JUNE VISITS","SUBMISSION%","INTEGRITY","PENDING","GHOST","TRUST","WEEKS","CARD"].map(h=>(<th key={h} className="text-left py-2.5 px-3 font-bold tracking-wider whitespace-nowrap">{h}</th>))}
              </tr></thead>
              <tbody>{filteredProfiles.map(p=>(
                <tr key={p.code} className="border-b border-neutral-800 hover:bg-neutral-800/30 transition-colors cursor-pointer" onClick={()=>setScorecardEmp(p)}>
                  <td className="py-2 px-3 text-white text-xs font-bold">{p.name}</td>
                  <td className="py-2 px-3 font-mono text-cyan-400 text-xs">{p.code}</td>
                  <td className="py-2 px-3 text-neutral-400 text-xs">{p.department}</td>
                  <td className="py-2 px-3 font-mono text-neutral-300 text-xs text-center">{p.totalReports}</td>
                  <td className="py-2 px-3 font-mono text-neutral-300 text-xs text-center">{p.uniqueStores}</td>
                  <td className="py-2 px-3 font-mono text-purple-400 text-xs text-center font-bold">{p.juneTotal||p.visitCount}</td>
                  <td className={`py-2 px-3 font-mono font-bold text-xs text-center ${compColor(p.submissionRate)}`}>{p.submissionRate}%</td>
                  <td className={`py-2 px-3 font-mono font-bold text-xs text-center ${intgColor(p.integrityScore)}`}>{p.integrityScore}%</td>
                  <td className="py-2 px-3 font-mono text-xs text-center">{p.pending>0?<span className="text-amber-400 font-bold">{p.pending}</span>:<span className="text-neutral-600">—</span>}</td>
                  <td className="py-2 px-3 text-center"><GhostMeter score={p.ghostScore}/></td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${p.trustTier==="At Risk"?"bg-red-500/20 text-red-300 border-red-500/30":p.trustTier==="Watch"?"bg-amber-500/20 text-amber-300 border-amber-500/30":"bg-emerald-500/20 text-emerald-300 border-emerald-500/30"}`}>{p.fieldTrust}%</span>
                  </td>
                  <td className="py-2 px-3"><WeekSparkline totals={p.weekTotals}/></td>
                  <td className="py-2 px-3" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>setScorecardEmp(p)} className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-1 rounded-lg hover:bg-cyan-500/20 transition-colors whitespace-nowrap">
                      <Fingerprint className="w-3 h-3"/>3D
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>

      </>)}
    </div>
  );
}
