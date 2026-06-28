"use client";
import { useState, useRef, useEffect } from "react";
import ImportReportsPage from "./import-reports/ImportReportsPage";
import EgyptMapPage from "./egypt-map/EgyptMapPage";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Tooltip, Legend
} from "recharts";
import {
  LayoutDashboard, Settings, BarChart3, Users, Bell, RefreshCw, Map,
  Ghost, AlertTriangle, Database, X, Search, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Clock, MapPin, Send, Bot, Loader2,
  TrendingUp, TrendingDown, Minus, Store, Package,
  Upload, FileSpreadsheet, Merge, Eye
} from "lucide-react";

// ─── REAL DATA FROM EXCEL FILES ───────────────────────────────────────────
const WEEK_SALES = [
  { week: "W19", sellout: 49458 },
  { week: "W20", sellout: 49051 },
  { week: "W21", sellout: 46825 },
  { week: "W22", sellout: 42421 },
];

const AREA_SALES = [
  { area: "Cairo",       sellout: 72514, color: "#06b6d4" },
  { area: "Delta",       sellout: 49198, color: "#8b5cf6" },
  { area: "Upper Egypt", sellout: 38718, color: "#f59e0b" },
  { area: "Alex",        sellout: 27325, color: "#22c55e" },
];

const PROJECT_SALES = [
  { project: "Club",  sellout: 88871, color: "#06b6d4" },
  { project: "Elite", sellout: 34813, color: "#8b5cf6" },
  { project: "Hero",  sellout: 24371, color: "#f59e0b" },
  { project: "Star",  sellout: 23650, color: "#22c55e" },
  { project: "One",   sellout: 16050, color: "#ef4444" },
];

const BRAND_SALES = [
  { name: "Samsung", sales: 84618 },
  { name: "Oppo",    sales: 34453 },
  { name: "Xiaomi",  sales: 19383 },
  { name: "Realme",  sales: 16292 },
  { name: "Infinix", sales: 10069 },
  { name: "Vivo",    sales:  9206 },
  { name: "Honor",   sales:  7827 },
  { name: "Apple",   sales:  4645 },
];

const MERGED_SHOPS = [
  { shop_code:"S-0074-005", shop_name:"Dubai Phone",                area:"Cairo", project:"Elite", sellout:3042, revenue:63090168, top_brand:"Oppo",    att_records:43, emp_count:9  },
  { shop_code:"S-0074-006", shop_name:"Dubai Phone (City Center)",      area:"Cairo", project:"Elite", sellout:2495, revenue:63398321, top_brand:"Samsung", att_records:37, emp_count:6  },
  { shop_code:"S-0074-008", shop_name:"Dubai Phone (Mohandseen)",       area:"Cairo", project:"Elite", sellout:2247, revenue:49207560, top_brand:"Samsung", att_records:8,  emp_count:4  },
  { shop_code:"S-0074-020", shop_name:"Dubai Phone (Smouha)",           area:"Alex",  project:"Elite", sellout:1942, revenue:51674556, top_brand:"Samsung", att_records:31, emp_count:6  },
  { shop_code:"S-0074-022", shop_name:"Dubai Phone (Mosdak)",           area:"Cairo", project:"Elite", sellout:1923, revenue:39900325, top_brand:"Oppo",    att_records:14, emp_count:5  },
  { shop_code:"S-0074-012", shop_name:"Dubai Phone (El Maadi)",         area:"Cairo", project:"Elite", sellout:1824, revenue:49522494, top_brand:"Samsung", att_records:41, emp_count:9  },
  { shop_code:"S-0074-015", shop_name:"Dubai Phone (Ain Shams)",        area:"Cairo", project:"Elite", sellout:1809, revenue:35291071, top_brand:"Oppo",    att_records:37, emp_count:8  },
  { shop_code:"S-0074-018", shop_name:"Dubai Phone (City Stars)",       area:"Cairo", project:"Elite", sellout:1784, revenue:47770879, top_brand:"Oppo",    att_records:41, emp_count:8  },
  { shop_code:"S-0074-013", shop_name:"Dubai Phone 2 (6 Oct)",          area:"Cairo", project:"Elite", sellout:1782, revenue:37689348, top_brand:"Oppo",    att_records:12, emp_count:4  },
  { shop_code:"S-0074-011", shop_name:"Dubai Phone (Mall Of Arab)",     area:"Cairo", project:"Elite", sellout:1582, revenue:51050570, top_brand:"Oppo",    att_records:35, emp_count:5  },
  { shop_code:"S-0074-019", shop_name:"Dubai Phone (MOE)",              area:"Cairo", project:"Elite", sellout:1564, revenue:44042678, top_brand:"Oppo",    att_records:35, emp_count:8  },
  { shop_code:"S-0074-014", shop_name:"Dubai Phone (El Korba)",         area:"Cairo", project:"Elite", sellout:1493, revenue:40579754, top_brand:"Oppo",    att_records:5,  emp_count:4  },
  { shop_code:"S-0074-017", shop_name:"Dubai Phone (Obour)",            area:"Cairo", project:"Elite", sellout:1269, revenue:35535201, top_brand:"Oppo",    att_records:36, emp_count:6  },
  { shop_code:"S-0074-024", shop_name:"Dubai Phone (Concord Plaza)",    area:"Cairo", project:"Elite", sellout:1144, revenue:44800530, top_brand:"Apple",   att_records:8,  emp_count:5  },
  { shop_code:"S-0074-023", shop_name:"Dubai Phone (Louran)",           area:"Alex",  project:"Elite", sellout:1127, revenue:30813302, top_brand:"Oppo",    att_records:29, emp_count:3  },
  { shop_code:"S-4625-007", shop_name:"Carrefour (Maadi)",              area:"Cairo", project:"Club",  sellout:893,  revenue:18240000, top_brand:"Samsung", att_records:175,emp_count:22 },
  { shop_code:"S-9158-016", shop_name:"Raneen (El Fostat)",              area:"Cairo", project:"Club",  sellout:712,  revenue:14580000, top_brand:"Samsung", att_records:32, emp_count:4  },
  { shop_code:"S-9158-048", shop_name:"Raneen (Damanhour)",              area:"Delta", project:"Club",  sellout:645,  revenue:12960000, top_brand:"Oppo",    att_records:25, emp_count:2  },
  { shop_code:"S-9158-049", shop_name:"Raneen (10th Of Ramadan)",       area:"Delta", project:"Club",  sellout:598,  revenue:11920000, top_brand:"Samsung", att_records:25, emp_count:2  },
  { shop_code:"S-9158-051", shop_name:"Raneen (Ismailia)",              area:"Delta", project:"Club",  sellout:542,  revenue:10830000, top_brand:"Samsung", att_records:25, emp_count:1  },
];

const ATTENDANCE_RECORDS = [
  { id:"ATT-001", emp_code:"A-1757", emp_name:"Abd El Geliel El Sayed",    shop_code:"S-4625-007", shop_name:"Carrefour (Maadi)",      date:"2026-05-01", start:"12:51", end:"21:18", duration:"08:26", status:"present" },
  { id:"ATT-002", emp_code:"A-3481", emp_name:"Abd El Rahman Adel Fathy",  shop_code:"S-9158-048", shop_name:"Raneen (Damanhour)",      date:"2026-05-01", start:"12:54", end:"21:00", duration:"08:06", status:"present" },
  { id:"ATT-003", emp_code:"A-3165", emp_name:"Abd El Rahman Mahmoud",     shop_code:"S-9158-016", shop_name:"Raneen (El Fostat)",      date:"2026-05-01", start:"13:00", end:"21:08", duration:"08:07", status:"present" },
  { id:"ATT-004", emp_code:"A-3149", emp_name:"Abd El Rahman Reda Attia",  shop_code:"S-9158-051", shop_name:"Raneen (Ismailia)",       date:"2026-05-01", start:"12:58", end:"21:01", duration:"08:02", status:"present" },
  { id:"ATT-005", emp_code:"A-1167", emp_name:"Ahmed Hassan Mohamed",      shop_code:"S-4625-007", shop_name:"Carrefour (Maadi)",      date:"2026-05-01", start:"12:49", end:"21:22", duration:"08:33", status:"present" },
  { id:"ATT-006", emp_code:"A-2370", emp_name:"Ahmed Ibrahim Ali",         shop_code:"S-0074-005", shop_name:"Dubai Phone",            date:"2026-05-02", start:"11:00", end:"20:30", duration:"09:30", status:"present" },
  { id:"ATT-007", emp_code:"A-1042", emp_name:"Mohamed Kamal Sayed",       shop_code:"S-4625-007", shop_name:"Carrefour (Maadi)",      date:"2026-05-03", start:"13:10", end:"20:55", duration:"07:45", status:"present" },
  { id:"ATT-008", emp_code:"A-3229", emp_name:"Youssef Mahmoud Nasser",    shop_code:"S-4625-007", shop_name:"Carrefour (Maadi)",      date:"2026-05-03", start:"--:--", end:"--:--", duration:"00:00", status:"absent"  },
  { id:"ATT-009", emp_code:"A-1379", emp_name:"Omar Khaled Ibrahim",       shop_code:"S-9158-049", shop_name:"Raneen (10th Ramadan)",  date:"2026-05-04", start:"10:00", end:"18:30", duration:"08:30", status:"late"    },
  { id:"ATT-010", emp_code:"A-2687", emp_name:"Karim Samir Fathy",         shop_code:"S-0074-012", shop_name:"Dubai Phone (El Maadi)", date:"2026-05-04", start:"09:00", end:"18:00", duration:"09:00", status:"present" },
];

const NETWORK_STATS = {
  activeShops: 3973,
  totalSellout: 187755,
  attRecords: 43541,
  shopsWithSalesNoAtt: 38,
  attShopsNoSales: 2386,
  commonShops: 3973,
  dataAccuracy: 99.2,
  employees: 843,
};

// ─── UTILITIES & HELPER STYLES ─────────────────────────────────────────────
const fmtM = (n: number) => n >= 1e6 ? `${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : n;
const fmtEGP = (n: number) => `EGP ${(n/1e6).toFixed(1)}M`;
const statusBg = (s: string) => ({ present:"bg-emerald-500/20 text-emerald-400", absent:"bg-red-500/20 text-red-400", late:"bg-amber-500/20 text-amber-400" }[s] || "bg-neutral-500/20 text-neutral-400");

function StatCard({ label, value, color = "text-white", icon: Icon, iconColor = "text-cyan-400" }: any) {
  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-neutral-400 tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
      </div>
      {Icon && <Icon className={`w-8 h-8 ${iconColor}`} />}
    </div>
  );
}

function SectionHeader({ title, sub, actions }: any) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-wider">{title}</h1>
        {sub && <p className="text-sm text-neutral-400">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

const EXTRA_METRICS = {
  revenuePerUnit: Math.round(MERGED_SHOPS.reduce((s,x)=>s+x.revenue,0) / MERGED_SHOPS.reduce((s,x)=>s+x.sellout,0)),
  samsung_share: ((84618 / 187755)*100).toFixed(0),
  attCoverage: ((3973 / 4011) * 100).toFixed(1),
  ghostRiskRate: ((38 / 4011) * 100).toFixed(1),
  eliteRevShare: ((MERGED_SHOPS.filter(s=>s.project==="Elite").reduce((s,x)=>s+x.revenue,0)/MERGED_SHOPS.reduce((s,x)=>s+x.revenue,0))*100).toFixed(0),
  weeklyDecline: (((42421-49458)/49458)*100).toFixed(1),
};

// ─── SUB-COMPONENTS FOR VIEWS ──────────────────────────────────────────────
function DashboardPage() {
  const [activeMetricTab, setActiveMetricTab] = useState("core");

  const coreKPIs = [
    { label:"TOTAL SELLOUT",      value: fmtM(NETWORK_STATS.totalSellout), sub:"W19–W22",          color:"text-cyan-400",    border:"border-cyan-500/30",    bg:"bg-cyan-500/5",    icon:TrendingUp,   trend:"-14.2%" },
    { label:"ACTIVE SHOPS",       value: NETWORK_STATS.activeShops.toLocaleString(), sub:"4 regions", color:"text-white",    border:"border-neutral-600",    bg:"bg-neutral-800/40",icon:Store,        trend:null },
    { label:"ATT RECORDS (MAY)",  value: NETWORK_STATS.attRecords.toLocaleString(), sub:"43K+ logs", color:"text-emerald-400",border:"border-emerald-500/30",bg:"bg-emerald-500/5", icon:Users,        trend:null },
    { label:"GHOST RISK STORES",  value: NETWORK_STATS.shopsWithSalesNoAtt, sub:"sales/no att",    color:"text-red-400",     border:"border-red-500/30",     bg:"bg-red-500/5",     icon:AlertTriangle,trend:null },
  ];

  const advancedKPIs = [
    { label:"AVG REVENUE/UNIT",   value: `EGP ${EXTRA_METRICS.revenuePerUnit.toLocaleString()}`, sub:"blended ASP",        color:"text-amber-400",   border:"border-amber-500/30",  bg:"bg-amber-500/5"   },
    { label:"SAMSUNG DOMINANCE",  value: `${EXTRA_METRICS.samsung_share}%`,  sub:"of total sellout",                        color:"text-blue-400",    border:"border-blue-500/30",   bg:"bg-blue-500/5"    },
    { label:"ATT COVERAGE",       value: `${EXTRA_METRICS.attCoverage}%`,    sub:"shops with att logs",                     color:"text-emerald-400", border:"border-emerald-500/30",bg:"bg-emerald-500/5" },
    { label:"GHOST RISK RATE",    value: `${EXTRA_METRICS.ghostRiskRate}%`,  sub:"shops = sales/no att",                    color:"text-red-400",     border:"border-red-500/30",    bg:"bg-red-500/5"      },
    { label:"ELITE REV SHARE",    value: `${EXTRA_METRICS.eliteRevShare}%`,  sub:"of total revenue",                        color:"text-purple-400",  border:"border-purple-500/30", bg:"bg-purple-500/5"   },
    { label:"WoW DECLINE W19→W22",value: `${EXTRA_METRICS.weeklyDecline}%`, sub:"sellout regression",                      color:"text-orange-400",  border:"border-orange-500/30", bg:"bg-orange-500/5"   },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full bg-gradient-to-b from-cyan-400 to-purple-500"/>
            <h1 className="text-xl font-bold text-white tracking-widest">COMMAND CENTER</h1>
            <span className="text-[10px] font-mono text-cyan-500 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">W19–W22 · 2026</span>
          </div>
          <p className="text-xs text-neutral-500 ml-4">Real-time retail intelligence · Egypt network · 4,011 shops</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
          <span className="text-[10px] text-emerald-400 font-medium tracking-wider">LIVE</span>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-700 rounded-xl w-fit">
        {[["core","Core KPIs"],["advanced","Advanced Metrics"]].map(([id,label])=>(
          <button key={id} onClick={()=>setActiveMetricTab(id)}
            className={`text-xs px-4 py-2 rounded-lg font-medium transition-all ${activeMetricTab===id?"bg-cyan-500/20 text-cyan-400 border border-cyan-500/30":"text-neutral-500 hover:text-neutral-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {activeMetricTab === "core" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {coreKPIs.map(k => (
            <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-4 relative overflow-hidden`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] text-neutral-500 tracking-wider font-medium">{k.label}</span>
                <k.icon className={`w-4 h-4 ${k.color}`}/>
              </div>
              <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-neutral-600">{k.sub}</p>
                {k.trend && <span className="text-[10px] text-red-400 font-medium">{k.trend}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeMetricTab === "advanced" && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {advancedKPIs.map(k => (
            <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-4`}>
              <p className="text-[10px] text-neutral-500 tracking-wider mb-2 font-medium">{k.label}</p>
              <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
              <p className="text-[10px] text-neutral-600 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-neutral-400 tracking-wider font-medium">WEEKLY SELLOUT TREND</p>
            <span className="text-[10px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded font-mono">-14.2% WoW</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={WEEK_SALES}>
              <XAxis dataKey="week" tick={{ fill:"#737373", fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#737373", fontSize:10 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background:"#111", border:"1px solid #333", borderRadius:8, color:"#fff", fontSize:11 }} />
              <Line type="monotone" dataKey="sellout" stroke="#06b6d4" strokeWidth={2.5} dot={{ r:4, fill:"#06b6d4", strokeWidth:0 }} activeDot={{ r:6, fill:"#22d3ee" }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4">
          <p className="text-xs text-neutral-400 tracking-wider mb-4 font-medium">SELLOUT BY AREA</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={AREA_SALES}>
              <XAxis dataKey="area" tick={{ fill:"#737373", fontSize:9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#737373", fontSize:10 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={{ background:"#111", border:"1px solid #333", borderRadius:8, color:"#fff", fontSize:11 }} />
              <Bar dataKey="sellout" radius={[5,5,0,0]}>
                {AREA_SALES.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4">
          <p className="text-xs text-neutral-400 tracking-wider mb-4 font-medium">SELLOUT BY PROJECT</p>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={PROJECT_SALES} dataKey="sellout" nameKey="project" cx="50%" cy="50%" outerRadius={72} innerRadius={30} paddingAngle={3}>
                {PROJECT_SALES.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background:"#111", border:"1px solid #333", borderRadius:8, color:"#fff", fontSize:11 }} />
              <Legend wrapperStyle={{ fontSize:10, color:"#737373" }}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-neutral-900 border border-neutral-700 rounded-xl p-4">
          <p className="text-xs text-neutral-400 tracking-wider mb-4 font-medium">BRAND PERFORMANCE RANKING</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={BRAND_SALES} layout="vertical">
              <XAxis type="number" tick={{ fill:"#737373", fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill:"#a3a3a3", fontSize:11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip contentStyle={{ background:"#111", border:"1px solid #333", borderRadius:8, color:"#fff", fontSize:11 }} />
              <Bar dataKey="sales" fill="#f59e0b" radius={[0,5,5,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 space-y-3">
          <p className="text-xs text-neutral-400 tracking-wider font-medium">DATA INTEGRITY SCORE</p>
          <div className="text-center py-2">
            <p className="text-5xl font-bold font-mono text-emerald-400">99.2<span className="text-2xl text-emerald-600">%</span></p>
            <p className="text-[10px] text-neutral-600 mt-1">overall accuracy</p>
          </div>
          <div className="space-y-2">
            {[
              { label:"Matched shops",   value:"3,973", color:"text-emerald-400", pct:99 },
              { label:"Sales/no-att",    value:"38",    color:"text-amber-400",   pct:1  },
              { label:"Att/no-sales",    value:"2,386", color:"text-blue-400",    pct:60 },
            ].map(m=>(
              <div key={m.label}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-neutral-500">{m.label}</span>
                  <span className={m.color}>{m.value}</span>
                </div>
                <div className="h-1 bg-neutral-800 rounded-full">
                  <div className={`h-1 rounded-full ${m.color.replace("text-","bg-")}`} style={{width:`${m.pct}%`}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 rounded-xl">
        <div className="flex items-center gap-2 shrink-0">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-300 font-medium tracking-wider">LIVE FLAGS</span>
        </div>
        <div className="h-4 w-px bg-neutral-700"/>
        <span className="text-xs text-amber-200"><span className="font-bold text-amber-400">38</span> shops — sales with zero attendance</span>
        <span className="text-xs text-neutral-500"><span className="text-blue-400 font-bold">2,386</span> shops — attendance, no W19–W22 sales</span>
        <span className="text-xs text-neutral-500"><span className="text-emerald-400 font-bold">3,973</span> shops matched across both files</span>
        <span className="text-xs text-red-400 ml-auto font-medium">↓ W22 sellout lowest in 4-week window</span>
      </div>
    </div>
  );
}

function SalesPage() {
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("All");
  const [filterProject, setFilterProject] = useState("All");

  const areas = ["All", ...Array.from(new Set(MERGED_SHOPS.map(s => s.area)))];
  const projects = ["All", ...Array.from(new Set(MERGED_SHOPS.map(s => s.project)))];

  const filtered = MERGED_SHOPS.filter(s => {
    const matchSearch = !search || s.shop_name.toLowerCase().includes(search.toLowerCase()) || s.shop_code.toLowerCase().includes(search.toLowerCase());
    const matchArea = filterArea === "All" || s.area === filterArea;
    const matchProject = filterProject === "All" || s.project === filterProject;
    return matchSearch && matchArea && matchProject;
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="SALES ANALYTICS" sub="MBL Raw Data W19–W22 · 4,011 shops · 230,378 records" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="TOTAL SELLOUT"  value={fmtM(187755)} color="text-cyan-400"    icon={Package}    iconColor="text-cyan-400" />
        <StatCard label="UNIQUE SHOPS"   value="4,011"        color="text-white"        icon={Store}      iconColor="text-purple-400" />
        <StatCard label="WEEKS COVERED"  value="W19–W22"      color="text-purple-400"   icon={BarChart3}  iconColor="text-purple-400" />
        <StatCard label="TOP BRAND"      value="Samsung"      color="text-amber-400"    icon={TrendingUp} iconColor="text-amber-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4">
          <p className="text-xs text-neutral-400 tracking-wider mb-4">SELLOUT BY PROJECT</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={PROJECT_SALES}>
              <XAxis dataKey="project" tick={{ fill:"#737373", fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:"#737373", fontSize:10 }} axisLine={false} tickLine={false} width={50} />
              <Tooltip contentStyle={{ background:"#171717", border:"1px solid #404040", borderRadius:6, color:"#fff", fontSize:11 }} />
              <Bar dataKey="sellout" radius={[4,4,0,0]}>
                {PROJECT_SALES.map((d,i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-4">
          <p className="text-xs text-neutral-400 tracking-wider mb-4">TOP 8 BRANDS</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={BRAND_SALES} layout="vertical">
              <XAxis type="number" tick={{ fill:"#737373", fontSize:10 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill:"#a3a3a3", fontSize:11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip contentStyle={{ background:"#171717", border:"1px solid #404040", borderRadius:6, color:"#fff", fontSize:11 }} />
              <Bar dataKey="sales" fill="#06b6d4" radius={[0,4,4,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-neutral-900/50 border border-neutral-700 rounded-lg p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500"
            placeholder="Search shop name or code..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)}
          className="bg-neutral-800 border border-neutral-600 text-sm text-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-cyan-500">
          {areas.map(o => <option key={o}>{o}</option>)}
        </select>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="bg-neutral-800 border border-neutral-600 text-sm text-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-cyan-500">
          {projects.map(o => <option key={o}>{o}</option>)}
        </select>
        <button onClick={() => { setSearch(""); setFilterArea("All"); setFilterProject("All"); }}
          className="text-xs text-neutral-400 hover:text-white px-3 py-2">Clear</button>
      </div>

      <div className="bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-700">
          <span className="text-xs text-neutral-300 tracking-wider font-medium">SHOP SALES — MERGED WITH ATTENDANCE</span>
          <span className="text-xs text-neutral-500">{filtered.length} of {MERGED_SHOPS.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-neutral-500 border-b border-neutral-700 bg-neutral-900/80">
                {["SHOP CODE","SHOP NAME","AREA","PROJECT","SELLOUT","REVENUE","TOP BRAND","ATT RECORDS","STAFF"].map(h => (
                  <th key={h} className="text-left py-3 px-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.shop_code} className="border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-cyan-400 text-xs whitespace-nowrap">{s.shop_code}</td>
                  <td className="py-3 px-3 text-white max-w-[180px] truncate">{s.shop_name}</td>
                  <td className="py-3 px-3 text-neutral-400 text-xs">{s.area}</td>
                  <td className="py-3 px-3 text-neutral-400 text-xs">{s.project}</td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-400">{s.sellout.toLocaleString()}</td>
                  <td className="py-3 px-3 text-right font-mono text-amber-400 text-xs">{fmtEGP(s.revenue)}</td>
                  <td className="py-3 px-3 text-neutral-300 text-xs">{s.top_brand}</td>
                  <td className="py-3 px-3 text-right font-mono text-purple-400">
                    {s.att_records > 0 ? s.att_records : <span className="text-red-400">0</span>}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-neutral-300">{s.emp_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AttendancePage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const filtered = ATTENDANCE_RECORDS.filter(r => {
    const matchSearch = !search || r.emp_name.toLowerCase().includes(search.toLowerCase()) || r.shop_code.toLowerCase().includes(search.toLowerCase()) || r.shop_name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "All" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const present = ATTENDANCE_RECORDS.filter(r => r.status === "present").length;
  const absent  = ATTENDANCE_RECORDS.filter(r => r.status === "absent").length;
  const late    = ATTENDANCE_RECORDS.filter(r => r.status === "late").length;

  return (
    <div className="space-y-6">
      <SectionHeader title="ATTENDANCE TRACKER" sub="May 2026 · 43,541 records · attend_start_end_per_store" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="TOTAL RECORDS"  value="43,541"                         color="text-white"       icon={Users}       iconColor="text-purple-400" />
        <StatCard label="PRESENT (SAMPLE)" value={present}                      color="text-emerald-400" icon={CheckCircle} iconColor="text-emerald-400" />
        <StatCard label="ABSENT (SAMPLE)"  value={absent}                       color="text-red-400"     icon={XCircle}     iconColor="text-red-400" />
        <StatCard label="LATE (SAMPLE)"    value={late}                         color="text-amber-400"   icon={Clock}       iconColor="text-amber-400" />
      </div>

      <div className="bg-neutral-900/50 border border-neutral-700 rounded-lg p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-600 rounded text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500"
            placeholder="Search employee or shop..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-neutral-800 border border-neutral-600 text-sm text-neutral-300 rounded px-3 py-2 focus:outline-none focus:border-cyan-500">
          {["All","present","absent","late"].map(o => <option key={o}>{o}</option>)}
        </select>
        <button onClick={() => { setSearch(""); setFilterStatus("All"); }}
          className="text-xs text-neutral-400 hover:text-white px-3 py-2">Clear</button>
      </div>

      <div className="bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-neutral-500 border-b border-neutral-700 bg-neutral-900/80">
              {["EMP CODE","NAME","SHOP NAME","DATE","SHIFT","DURATION","STATUS"].map(h => (
                <th key={h} className="text-left py-3 px-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-neutral-800 hover:bg-neutral-800/40 text-xs">
                <td className="py-3 px-4 font-mono text-purple-400 font-medium">{r.emp_code}</td>
                <td className="py-3 px-4 text-white font-medium">{r.emp_name}</td>
                <td className="py-3 px-4 text-neutral-400 truncate max-w-[160px]">{r.shop_name}</td>
                <td className="py-3 px-4 text-neutral-500 font-mono">{r.date}</td>
                <td className="py-3 px-4 text-neutral-400 font-mono">{r.start} - {r.end}</td>
                <td className="py-3 px-4 text-neutral-400 font-mono">{r.duration}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] uppercase font-bold tracking-wider ${statusBg(r.status)}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── MAIN MASTER CONTAINER COMPONENT WITH AGENT INTERFACE ──────────────────
export default function DataNexusDashboard() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Nexus Prime retail terminal online. All Excel data vectors successfully loaded. Ask me anything about regional performance, brand rankings, or attendance exceptions." }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isTyping) return;

    const userText = chatInput.trim();
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", content: userText }]);
    setIsTyping(true);

    // Context snapshot injected straight into system prompt so the LLM knows everything
    const performanceContext = `
      Current system context:
      Total Retail Network Sellout: 187,755 units. Total Active Matched Stores: 3,973.
      Regional Sales Performance Breakdown:
      - Cairo: 72,514 units sold
      - Delta: 49,198 units sold
      - Upper Egypt: 38,718 units sold
      - Alexandria: 27,325 units sold
      Brand Rankings: Samsung leads with 84,618 units, followed by Oppo (34,453), Xiaomi (19,383), and Realme (16,292).
      Integrity Anomaly Flags: There are 38 shops recording sales with zero attendance logs. There are 2,386 shops logging attendance but generating no sales in the W19-W22 window.
    `;

    try {
      const response = await fetch("/api/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: `You are Nexus Prime, an expert data analytics AI assistant specializing in retail operations and distribution networks in Egypt. Answer succinctly using this real dashboard context: ${performanceContext}`,
          messages: [{ role: "user", content: userText }]
        })
      });

      if (!response.ok) throw new Error("Backend query failure");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No readable stream channel");

      // Seed an empty response block to safely stream into
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      
      let runningText = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        runningText += chunk;

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: runningText };
          return updated;
        });
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error communicating with the OpenRouter analytics stream engine. Confirm your Vercel pipeline variables." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-200 font-sans flex antialiased selection:bg-cyan-500/30 selection:text-white">
      
      {/* Structural Sidebar Navigation */}
      <aside className="w-64 border-r border-neutral-800 bg-neutral-950 flex flex-col shrink-0 hidden md:flex">
        <div className="p-5 border-b border-neutral-800 flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 shadow-md">
            <Database className="w-4 h-4 text-white" />
            <div className="absolute -inset-0.5 bg-cyan-500 rounded-lg blur opacity-30 animate-pulse" />
          </div>
          <div>
            <span className="font-black text-white text-sm tracking-wider block">NEXUS // PRIME</span>
            <span className="text-[9px] text-neutral-500 font-mono tracking-widest block uppercase">Retail Core v1.1</span>
          </div>
        </div>

        <nav className="p-4 space-y-1 flex-1">
          {[
            { id: "dashboard", label: "Command Center", icon: LayoutDashboard },
            { id: "sales", label: "Sales Analytics", icon: BarChart3 },
            { id: "attendance", label: "Attendance Tracker", icon: Users },
            { id: "map", label: "Geospatial Map", icon: Map },
            { id: "import", label: "Ingest Reports", icon: Upload }
          ].map(item => {
            const Icon = item.icon;
            const active = currentView === item.id;
            return (
              <button key={item.id} onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${active ? "bg-neutral-900 text-cyan-400 border border-neutral-800" : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40"}`}>
                <Icon className={`w-4 h-4 ${active ? "text-cyan-400" : "text-neutral-500"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800 bg-neutral-900/20 flex items-center justify-between text-[10px] font-mono text-neutral-600">
          <span>SERVER STABLE</span>
          <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full shadow-[0_0_8px_#22d3ee]" />
        </div>
      </aside>

      {/* Primary Workspace Panel */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        
        {/* Workspace Toolbar */}
        <header className="h-14 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur px-6 flex items-center justify-between z-10 shrink-0">
          <span className="text-xs font-mono text-neutral-500 tracking-wider">SYSTEM REGION: <span className="text-neutral-300">EG_ALL</span></span>
          <div className="flex items-center gap-4">
            <button onClick={() => setChatOpen(!chatOpen)} className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 hover:border-cyan-500/40 transition-colors">
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold text-white tracking-wide">Query Nexus</span>
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
            </button>
            <div className="h-4 w-px bg-neutral-800" />
            <Bell className="w-4 h-4 text-neutral-500 hover:text-neutral-300 cursor-pointer" />
          </div>
        </header>

        {/* Dynamic Frame Selector */}
        <main className="flex-1 overflow-y-auto bg-black p-6">
          <div className="max-w-7xl mx-auto">
            {currentView === "dashboard" && <DashboardPage />}
            {currentView === "sales" && <SalesPage />}
            {currentView === "attendance" && <AttendancePage />}
            {currentView === "map" && <EgyptMapPage />}
            {currentView === "import" && <ImportReportsPage />}
          </div>
        </main>
      </div>

      {/* Sliding Nexus Interactive AI Terminal Drawer */}
      {chatOpen && (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
          <div className="p-4 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-cyan-400" />
              <h2 className="text-xs font-black tracking-widest text-white uppercase">Nexus Analysis Terminal</h2>
            </div>
            <button onClick={() => setChatOpen(false)} className="p-1 rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Window Frame */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-xs">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 border leading-relaxed ${m.role === "user" ? "bg-cyan-950/40 text-cyan-200 border-cyan-800/50 font-medium" : "bg-neutral-900 text-neutral-300 border-neutral-800"}`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 flex items-center gap-2 text-neutral-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                  <span className="font-mono text-[10px] tracking-wider uppercase animate-pulse">Processing live vectors...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Console Wrapper */}
          <form onSubmit={handleSendChat} className="p-3 border-t border-neutral-800 bg-neutral-900/30 flex gap-2">
            <input
              type="text" value={chatInput} onChange={e => setChatInput(e.target.value)}
              placeholder="Ask about regional vectors or stores..."
              disabled={isTyping}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-50"
            />
            <button type="submit" disabled={!chatInput.trim() || isTyping}
              className="p-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors flex items-center justify-center disabled:opacity-40 shrink-0">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}