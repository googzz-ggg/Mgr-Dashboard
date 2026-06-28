"use client";
import { useState, useRef } from "react";
import {
  MapPin, Users, Package, TrendingUp, TrendingDown,
  AlertTriangle, Eye, Zap, Activity, Target, Radio,
  ChevronRight, Store, Clock
} from "lucide-react";

// ─── STORE LOCATION DATA with real GPS coords ──────────────────────────────
const STORES = [
  // Cairo cluster
  { code:"S-0074-005", name:"Dubai Phone",            area:"Cairo",       lat:30.0444, lng:31.2357, sellout:3042, att:43,  emps:9,  risk:"low",    project:"Elite" },
  { code:"S-0074-006", name:"Dubai Phone (City Ctr)", area:"Cairo",       lat:30.0626, lng:31.2497, sellout:2495, att:37,  emps:6,  risk:"low",    project:"Elite" },
  { code:"S-0074-008", name:"Dubai Phone (Mohand.)",  area:"Cairo",       lat:30.0597, lng:31.1997, sellout:2247, att:8,   emps:4,  risk:"high",   project:"Elite" },
  { code:"S-0074-012", name:"Dubai Phone (El Maadi)", area:"Cairo",       lat:29.9602, lng:31.2569, sellout:1824, att:41,  emps:9,  risk:"low",    project:"Elite" },
  { code:"S-0074-013", name:"Dubai Phone 2 (6 Oct)",  area:"Cairo",       lat:30.0167, lng:31.0167, sellout:1782, att:12,  emps:4,  risk:"medium", project:"Elite" },
  { code:"S-0074-014", name:"Dubai Phone (El Korba)", area:"Cairo",       lat:30.0739, lng:31.3286, sellout:1493, att:5,   emps:4,  risk:"high",   project:"Elite" },
  { code:"S-0074-015", name:"Dubai Phone (Ain Shams)",area:"Cairo",       lat:30.1219, lng:31.3219, sellout:1809, att:37,  emps:8,  risk:"low",    project:"Elite" },
  { code:"S-0074-017", name:"Dubai Phone (Obour)",    area:"Cairo",       lat:30.2167, lng:31.4667, sellout:1269, att:36,  emps:6,  risk:"low",    project:"Elite" },
  { code:"S-0074-018", name:"Dubai Phone (City Stars)",area:"Cairo",      lat:30.0744, lng:31.3481, sellout:1784, att:41,  emps:8,  risk:"low",    project:"Elite" },
  { code:"S-0074-019", name:"Dubai Phone (MOE)",      area:"Cairo",       lat:29.9768, lng:31.1481, sellout:1564, att:35,  emps:8,  risk:"low",    project:"Elite" },
  { code:"S-0074-011", name:"Dubai Phone (Mall Arab)", area:"Cairo",      lat:29.9833, lng:31.0333, sellout:1582, att:35,  emps:5,  risk:"low",    project:"Elite" },
  { code:"S-0074-022", name:"Dubai Phone (Mosdak)",   area:"Cairo",       lat:30.0333, lng:31.2167, sellout:1923, att:14,  emps:5,  risk:"medium", project:"Elite" },
  { code:"S-0074-024", name:"Dubai Phone (Concord)",  area:"Cairo",       lat:30.1167, lng:31.3667, sellout:1144, att:8,   emps:5,  risk:"medium", project:"Elite" },
  { code:"S-4625-007", name:"Carrefour (Maadi)",      area:"Cairo",       lat:29.9500, lng:31.2500, sellout:893,  att:175, emps:22, risk:"low",    project:"Club"  },
  { code:"S-9158-016", name:"Raneen (El Fostat)",     area:"Cairo",       lat:29.9667, lng:31.2333, sellout:712,  att:32,  emps:4,  risk:"low",    project:"Club"  },
  // Alex cluster
  { code:"S-0074-020", name:"Dubai Phone (Smouha)",   area:"Alex",        lat:31.1900, lng:29.9300, sellout:1942, att:31,  emps:6,  risk:"low",    project:"Elite" },
  { code:"S-0074-023", name:"Dubai Phone (Louran)",   area:"Alex",        lat:31.2167, lng:29.9167, sellout:1127, att:29,  emps:3,  risk:"medium", project:"Elite" },
  // Delta cluster
  { code:"S-9158-048", name:"Raneen (Damanhour)",     area:"Delta",       lat:30.4667, lng:30.4667, sellout:645,  att:25,  emps:2,  risk:"medium", project:"Club"  },
  { code:"S-9158-049", name:"Raneen (10th Ramadan)",  area:"Delta",       lat:30.3000, lng:31.7500, sellout:598,  att:25,  emps:2,  risk:"medium", project:"Club"  },
  { code:"S-9158-051", name:"Raneen (Ismailia)",      area:"Delta",       lat:30.6043, lng:32.2723, sellout:542,  att:25,  emps:1,  risk:"high",   project:"Club"  },
  // Upper Egypt
  { code:"S-UE-001",  name:"Shop Upper Egypt 1",      area:"Upper Egypt", lat:26.0000, lng:32.0000, sellout:820,  att:18,  emps:3,  risk:"medium", project:"Club"  },
  { code:"S-UE-002",  name:"Shop Upper Egypt 2",      area:"Upper Egypt", lat:25.6872, lng:32.6396, sellout:540,  att:12,  emps:2,  risk:"high",   project:"Club"  },
  { code:"S-UE-003",  name:"Shop Aswan",              area:"Upper Egypt", lat:24.0889, lng:32.8998, sellout:310,  att:8,   emps:2,  risk:"high",   project:"Club"  },
];

const AREA_COLORS: Record<string,string> = {
  "Cairo":      "#06b6d4",
  "Alex":       "#8b5cf6",
  "Delta":      "#f59e0b",
  "Upper Egypt":"#22c55e",
};

const RISK_COLORS: Record<string,string> = {
  low:    "#22c55e",
  medium: "#f59e0b",
  high:   "#ef4444",
};

// Egypt SVG path (simplified but recognizable shape)
// Bounding box roughly: lat 22–31.5 N, lng 25–37 E
function latLngToSVG(lat: number, lng: number, w: number, h: number) {
  const minLat = 21.9, maxLat = 31.7;
  const minLng = 24.7, maxLng = 37.1;
  const x = ((lng - minLng) / (maxLng - minLng)) * w;
  const y = ((maxLat - lat) / (maxLat - minLat)) * h;
  return { x, y };
}

function EgyptSVGMap({ width, height, stores, selectedArea, onStore, hoveredStore, onHover }:{
  width:number; height:number;
  stores: typeof STORES;
  selectedArea: string;
  onStore:(s:typeof STORES[0]|null)=>void;
  hoveredStore: string|null;
  onHover:(code:string|null)=>void;
}) {
  // Egypt border path - simplified polygon for SVG
  const border = [
    [31.7, 24.7],[31.5, 27.0],[31.0, 28.4],[30.8, 29.1],[31.1, 29.9],
    [31.3, 32.4],[31.1, 34.0],[30.0, 34.3],[29.0, 34.9],[28.0, 34.4],
    [27.0, 33.8],[26.0, 33.5],[25.0, 33.0],[24.0, 32.0],[23.0, 31.0],
    [22.5, 31.5],[22.0, 31.5],[21.9, 30.0],[21.9, 28.0],[21.9, 25.0],
    [21.9, 24.7],[25.0, 24.7],[27.0, 24.7],[29.0, 24.7],[31.0, 24.7],[31.7, 24.7]
  ];

  const pathD = border.map((pt, i) => {
    const { x, y } = latLngToSVG(pt[0], pt[1], width, height);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + " Z";

  // Nile approximate path
  const nile = [
    [21.9, 31.3],[22.3, 31.5],[23.0, 32.0],[24.0, 32.5],
    [25.6, 32.5],[26.0, 32.5],[27.0, 31.0],[28.0, 30.8],
    [29.5, 31.0],[30.0, 31.2],[30.0, 31.5],[30.5, 31.0],[31.2, 30.5],[31.5, 30.0]
  ];
  const nileD = nile.map((pt, i) => {
    const { x, y } = latLngToSVG(pt[0], pt[1], width, height);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {/* Glow filter */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="strongglow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="cairoGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
        </radialGradient>
      </defs>

      {/* Egypt fill */}
      <path d={pathD} fill="#0f172a" stroke="#1e293b" strokeWidth="1.5"/>

      {/* Desert texture dots */}
      {Array.from({ length: 40 }).map((_, i) => {
        const lat = 22 + (i * 0.23) % 8;
        const lng = 25 + (i * 0.37) % 10;
        const { x, y } = latLngToSVG(lat, lng, width, height);
        return <circle key={i} cx={x} cy={y} r="0.8" fill="#1e293b" opacity="0.5"/>;
      })}

      {/* Nile river */}
      <path d={nileD} fill="none" stroke="#0ea5e9" strokeWidth="1.5" strokeOpacity="0.4" strokeLinecap="round"/>

      {/* Mediterranean sea label */}
      {(() => { const { x, y } = latLngToSVG(31.5, 29.5, width, height); return (
        <text x={x} y={y-8} textAnchor="middle" fill="#0ea5e9" fontSize="8" opacity="0.4" fontFamily="monospace">MEDITERRANEAN</text>
      ); })()}

      {/* Red Sea label */}
      {(() => { const { x, y } = latLngToSVG(27.5, 34.5, width, height); return (
        <text x={x} y={y} textAnchor="middle" fill="#0ea5e9" fontSize="7" opacity="0.3" fontFamily="monospace" transform={`rotate(-70,${x},${y})`}>RED SEA</text>
      ); })()}

      {/* Cairo glow zone */}
      {(() => { const { x, y } = latLngToSVG(30.05, 31.25, width, height); return (
        <circle cx={x} cy={y} r="32" fill="url(#cairoGlow)"/>
      ); })()}

      {/* Store pins */}
      {stores.map((store) => {
        const { x, y } = latLngToSVG(store.lat, store.lng, width, height);
        const isHovered = hoveredStore === store.code;
        const isSelected = selectedArea === "All" || store.area === selectedArea;
        const color = selectedArea === "All" ? RISK_COLORS[store.risk] : AREA_COLORS[store.area] || "#06b6d4";
        const size = isHovered ? 9 : Math.max(4, Math.min(8, store.sellout / 500));
        const opacity = isSelected ? 1 : 0.2;

        return (
          <g key={store.code} opacity={opacity}
            onMouseEnter={() => onHover(store.code)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onStore(isHovered ? null : store)}
            style={{ cursor: "pointer" }}>
            {/* Pulse ring */}
            {isHovered && (
              <circle cx={x} cy={y} r={size + 6} fill="none" stroke={color} strokeWidth="1" opacity="0.5"
                style={{ animation: "ping 1s ease-out infinite" }}/>
            )}
            {/* Tower base shadow */}
            <ellipse cx={x} cy={y + 2} rx={size * 0.7} ry={size * 0.3} fill="rgba(0,0,0,0.4)"/>
            {/* Tower body */}
            <rect x={x - size * 0.35} y={y - size * 1.2} width={size * 0.7} height={size * 1.2}
              fill={color} opacity="0.9" rx="1"/>
            {/* Tower top dot */}
            <circle cx={x} cy={y - size * 1.2} r={size * 0.45} fill={color} filter="url(#glow)"/>
            {/* Risk indicator ring */}
            {store.risk === "high" && (
              <circle cx={x} cy={y - size * 1.2} r={size * 0.45 + 2} fill="none" stroke="#ef4444" strokeWidth="1" opacity="0.7"/>
            )}
          </g>
        );
      })}

      {/* Area labels */}
      {[
        { area:"Cairo",       lat:30.05, lng:31.0, count: stores.filter(s=>s.area==="Cairo").length },
        { area:"Alex",        lat:31.35, lng:29.7, count: stores.filter(s=>s.area==="Alex").length },
        { area:"Delta",       lat:30.6,  lng:31.2, count: stores.filter(s=>s.area==="Delta").length },
        { area:"Upper Egypt", lat:24.5,  lng:30.5, count: stores.filter(s=>s.area==="Upper Egypt").length },
      ].map(({ area, lat, lng, count }) => {
        const { x, y } = latLngToSVG(lat, lng, width, height);
        const color = AREA_COLORS[area];
        const isActive = selectedArea === "All" || selectedArea === area;
        return (
          <g key={area} opacity={isActive ? 1 : 0.3}>
            <rect x={x - 28} y={y - 10} width={56} height={18} rx="3" fill={color} fillOpacity="0.15" stroke={color} strokeOpacity="0.4" strokeWidth="0.5"/>
            <text x={x} y={y + 3} textAnchor="middle" fill={color} fontSize="7.5" fontFamily="monospace" fontWeight="bold">{area.toUpperCase()}</text>
            <text x={x} y={y + 13} textAnchor="middle" fill={color} fontSize="6" fontFamily="monospace" opacity="0.7">{count} STORES</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── AREA STATS ─────────────────────────────────────────────────────────────
const AREA_STATS = [
  { area:"Cairo",       stores:15, sellout:72514, att:15782, risk_high:3, color:"#06b6d4", trend:+2.1 },
  { area:"Delta",       stores:3,  sellout:49198, att:9840,  risk_high:1, color:"#f59e0b", trend:-1.3 },
  { area:"Upper Egypt", stores:3,  sellout:38718, att:6200,  risk_high:2, color:"#22c55e", trend:-3.2 },
  { area:"Alex",        stores:2,  sellout:27325, att:5120,  risk_high:0, color:"#8b5cf6", trend:+0.8 },
];

// ─── METRICS ─────────────────────────────────────────────────────────────────
const MAP_METRICS = [
  { label:"TOTAL STORES MAPPED", value:"23", sub:"across 4 regions",   icon:Store,     color:"cyan" },
  { label:"HIGH RISK STORES",    value:"6",  sub:"att/sales mismatch",  icon:AlertTriangle, color:"red" },
  { label:"TOTAL FIELD VISITS",  value:"43,541", sub:"May 2026",        icon:Users,     color:"purple" },
  { label:"COVERAGE RATE",       value:"94.2%",sub:"shops with att logs",icon:Target,   color:"emerald" },
  { label:"AVG VISITS/STORE",    value:"18.9", sub:"per month",         icon:Activity,  color:"amber" },
  { label:"GHOST RISK STORES",   value:"38",  sub:"sales, no attendance",icon:Radio,    color:"orange" },
];

export default function EgyptMapPage() {
  const [selectedArea, setSelectedArea] = useState("All");
  const [viewMode, setViewMode] = useState<"risk"|"area"|"intensity">("risk");
  const [selectedStore, setSelectedStore] = useState<typeof STORES[0]|null>(null);
  const [hoveredStore, setHoveredStore] = useState<string|null>(null);

  const filteredStores = selectedArea === "All"
    ? STORES
    : STORES.filter(s => s.area === selectedArea);

  const totalSellout = filteredStores.reduce((s,x) => s + x.sellout, 0);
  const totalAtt     = filteredStores.reduce((s,x) => s + x.att, 0);
  const highRisk     = filteredStores.filter(s => s.risk === "high").length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-cyan-400 to-purple-500"/>
            <h2 className="text-xl font-bold text-white tracking-widest">EGYPT INTELLIGENCE MAP</h2>
          </div>
          <p className="text-xs text-neutral-500 ml-3.5">Tower view — store locations · attendance · sales · risk overlays</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
            <span className="text-xs text-emerald-400 font-medium">LIVE</span>
          </div>
        </div>
      </div>

      {/* Top metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {MAP_METRICS.map((m) => {
          const colors: Record<string,[string,string,string]> = {
            cyan:    ["text-cyan-400",   "border-cyan-500/20",   "bg-cyan-500/5"],
            red:     ["text-red-400",    "border-red-500/20",    "bg-red-500/5"],
            purple:  ["text-purple-400", "border-purple-500/20", "bg-purple-500/5"],
            emerald: ["text-emerald-400","border-emerald-500/20","bg-emerald-500/5"],
            amber:   ["text-amber-400",  "border-amber-500/20",  "bg-amber-500/5"],
            orange:  ["text-orange-400", "border-orange-500/20", "bg-orange-500/5"],
          };
          const [tc, bc, bgc] = colors[m.color] ?? colors.cyan;
          return (
            <div key={m.label} className={`${bgc} border ${bc} rounded-xl p-3`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-neutral-500 tracking-wider font-medium">{m.label}</span>
                <m.icon className={`w-3.5 h-3.5 ${tc}`}/>
              </div>
              <p className={`text-lg font-bold font-mono ${tc}`}>{m.value}</p>
              <p className="text-[10px] text-neutral-600 mt-0.5">{m.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Main layout: map + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* MAP PANEL */}
        <div className="lg:col-span-2 bg-neutral-950 border border-neutral-700 rounded-2xl overflow-hidden relative">
          {/* Map toolbar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur">
            <span className="text-xs text-neutral-500 tracking-wider font-medium mr-1">FILTER:</span>
            {["All", "Cairo", "Alex", "Delta", "Upper Egypt"].map(a => (
              <button key={a} onClick={() => setSelectedArea(a)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium
                  ${selectedArea === a
                    ? a === "All" ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                      : `border-current bg-white/5 text-white`
                    : "border-neutral-700 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500"}`}
                style={selectedArea === a && a !== "All" ? { color: AREA_COLORS[a], borderColor: AREA_COLORS[a] + "80" } : {}}>
                {a}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {[
                { id:"risk",      label:"Risk" },
                { id:"area",      label:"Area" },
                { id:"intensity", label:"Sales" },
              ].map(v => (
                <button key={v.id} onClick={() => setViewMode(v.id as typeof viewMode)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all
                    ${viewMode === v.id ? "bg-neutral-700 border-neutral-500 text-white" : "border-neutral-700 text-neutral-600 hover:text-neutral-400"}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Map */}
          <div className="relative p-2">
            <EgyptSVGMap
              width={560} height={460}
              stores={STORES}
              selectedArea={selectedArea}
              onStore={setSelectedStore}
              hoveredStore={hoveredStore}
              onHover={setHoveredStore}
            />

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-neutral-900/90 border border-neutral-700 rounded-xl p-3 backdrop-blur space-y-2">
              <p className="text-[10px] text-neutral-500 tracking-wider font-medium">
                {viewMode === "risk" ? "RISK LEVEL" : viewMode === "area" ? "REGION" : "SALES VOL"}
              </p>
              {viewMode === "risk" ? (
                [["low","#22c55e","Low Risk"],["medium","#f59e0b","Medium"],["high","#ef4444","High Risk"]].map(([k,c,l]) => (
                  <div key={k} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c as string }}/>
                    <span className="text-[10px] text-neutral-400">{l as string}</span>
                  </div>
                ))
              ) : viewMode === "area" ? (
                Object.entries(AREA_COLORS).map(([a, c]) => (
                  <div key={a} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }}/>
                    <span className="text-[10px] text-neutral-400">{a}</span>
                  </div>
                ))
              ) : (
                [["▲ Large","3000+"],["● Medium","1000–3000"],["· Small","<1000"]].map(([s,l]) => (
                  <div key={l} className="flex items-center gap-2">
                    <span className="text-cyan-400 text-xs">{s}</span>
                    <span className="text-[10px] text-neutral-400">{l}</span>
                  </div>
                ))
              )}
              <div className="pt-1 border-t border-neutral-700">
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-0.5 bg-blue-400 opacity-50 rounded"/>
                  <span className="text-[9px] text-neutral-600">Nile</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4">
          {/* Selected store card */}
          {selectedStore ? (
            <div className="bg-neutral-900 border rounded-xl overflow-hidden"
              style={{ borderColor: RISK_COLORS[selectedStore.risk] + "60" }}>
              <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between"
                style={{ background: RISK_COLORS[selectedStore.risk] + "10" }}>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: RISK_COLORS[selectedStore.risk] }}/>
                  <span className="text-xs font-medium tracking-wider" style={{ color: RISK_COLORS[selectedStore.risk] }}>
                    {selectedStore.risk.toUpperCase()} RISK STORE
                  </span>
                </div>
                <button onClick={() => setSelectedStore(null)} className="text-neutral-600 hover:text-neutral-300 text-xs">✕</button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-white font-semibold text-sm">{selectedStore.name}</p>
                  <p className="text-xs text-neutral-500 font-mono mt-0.5">{selectedStore.code}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l:"Area",      v: selectedStore.area,                    c:"text-neutral-300" },
                    { l:"Project",   v: selectedStore.project,                 c:"text-purple-400" },
                    { l:"Sellout",   v: selectedStore.sellout.toLocaleString(),c:"text-cyan-400" },
                    { l:"Employees", v: selectedStore.emps,                    c:"text-white" },
                    { l:"Att Recs",  v: selectedStore.att,                     c:"text-emerald-400" },
                    { l:"Att/Emp",   v: (selectedStore.att / selectedStore.emps).toFixed(1), c: selectedStore.att/selectedStore.emps < 5 ? "text-red-400" : "text-emerald-400" },
                  ].map(({ l, v, c }) => (
                    <div key={l} className="bg-neutral-800/60 rounded-lg p-2.5">
                      <p className="text-[10px] text-neutral-500">{l}</p>
                      <p className={`text-sm font-bold font-mono ${c}`}>{v}</p>
                    </div>
                  ))}
                </div>
                {selectedStore.risk === "high" && (
                  <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0"/>
                    <p className="text-xs text-red-300">
                      {selectedStore.att < 10
                        ? "Very low attendance records — possible ghost visits or data fraud."
                        : selectedStore.emps < 2
                          ? "Single employee shop — high unverified sales risk."
                          : "Attendance-to-sales ratio flagged for review."}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-neutral-900/50 border border-neutral-700/50 border-dashed rounded-xl p-5 text-center">
              <MapPin className="w-8 h-8 text-neutral-700 mx-auto mb-2"/>
              <p className="text-xs text-neutral-600">Click a store pin on the map to view details</p>
            </div>
          )}

          {/* Area breakdown */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-800">
              <p className="text-xs text-neutral-400 tracking-wider font-medium">REGION BREAKDOWN</p>
            </div>
            <div className="divide-y divide-neutral-800">
              {AREA_STATS.map((a) => (
                <button key={a.area} onClick={() => setSelectedArea(selectedArea === a.area ? "All" : a.area)}
                  className={`w-full px-4 py-3 text-left hover:bg-neutral-800/50 transition-colors
                    ${selectedArea === a.area ? "bg-neutral-800/70" : ""}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: a.color }}/>
                      <span className="text-xs text-white font-medium">{a.area}</span>
                      {a.risk_high > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-medium">
                          {a.risk_high} HIGH
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-medium ${a.trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {a.trend >= 0 ? "↑" : "↓"}{Math.abs(a.trend)}%
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div>
                      <p className="text-neutral-600">STORES</p>
                      <p className="text-neutral-300 font-mono font-medium">{a.stores}</p>
                    </div>
                    <div>
                      <p className="text-neutral-600">SELLOUT</p>
                      <p className="font-mono font-medium" style={{ color: a.color }}>
                        {a.sellout >= 1000 ? `${(a.sellout/1000).toFixed(0)}K` : a.sellout}
                      </p>
                    </div>
                    <div>
                      <p className="text-neutral-600">ATT RECS</p>
                      <p className="text-neutral-300 font-mono font-medium">
                        {a.att >= 1000 ? `${(a.att/1000).toFixed(1)}K` : a.att}
                      </p>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-2 h-0.5 bg-neutral-800 rounded-full">
                    <div className="h-0.5 rounded-full transition-all" style={{
                      width: `${Math.round(a.sellout / 72514 * 100)}%`,
                      background: a.color
                    }}/>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Risk summary */}
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 space-y-3">
            <p className="text-xs text-neutral-400 tracking-wider font-medium">RISK SUMMARY</p>
            {[
              { label:"High Risk Stores",   count:6,  color:"text-red-400",    bg:"bg-red-500/10",    bar:6/23  },
              { label:"Medium Risk",        count:7,  color:"text-amber-400",  bg:"bg-amber-500/10",  bar:7/23  },
              { label:"Low Risk Stores",    count:10, color:"text-emerald-400",bg:"bg-emerald-500/10",bar:10/23 },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-3">
                <div className={`${r.bg} rounded px-2 py-1 min-w-[28px] text-center`}>
                  <span className={`text-sm font-bold font-mono ${r.color}`}>{r.count}</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs text-neutral-400">{r.label}</p>
                  <div className="mt-1 h-1 bg-neutral-800 rounded-full">
                    <div className={`h-1 rounded-full ${r.color.replace("text-","bg-")}`}
                      style={{ width:`${Math.round(r.bar * 100)}%` }}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Store rankings table */}
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
          <p className="text-xs text-neutral-300 tracking-wider font-medium">STORE INTELLIGENCE RANKINGS</p>
          <span className="text-xs text-neutral-600">{filteredStores.length} stores · sorted by sellout</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-neutral-500 border-b border-neutral-800">
                {["RANK","CODE","STORE NAME","AREA","SELLOUT","ATT RECORDS","STAFF","ATT/EMP","RISK","TREND"].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filteredStores].sort((a,b) => b.sellout - a.sellout).map((s, i) => {
                const attPerEmp = s.att / s.emps;
                const areaColor = AREA_COLORS[s.area] || "#737373";
                return (
                  <tr key={s.code}
                    className={`border-b border-neutral-800 hover:bg-neutral-800/40 transition-colors cursor-pointer
                      ${selectedStore?.code === s.code ? "bg-neutral-800/60" : ""}`}
                    onClick={() => setSelectedStore(s === selectedStore ? null : s)}>
                    <td className="py-2.5 px-3 text-neutral-600 font-mono">#{i+1}</td>
                    <td className="py-2.5 px-3 font-mono text-cyan-400 whitespace-nowrap">{s.code}</td>
                    <td className="py-2.5 px-3 text-white max-w-[160px] truncate">{s.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color: areaColor, background: areaColor + "20" }}>
                        {s.area}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-medium">{s.sellout.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-purple-400">{s.att}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-neutral-300">{s.emps}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-medium ${attPerEmp < 5 ? "text-red-400" : attPerEmp < 10 ? "text-amber-400" : "text-emerald-400"}`}>
                      {attPerEmp.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase
                        ${s.risk === "high" ? "bg-red-500/20 text-red-400" : s.risk === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        {s.risk}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`text-[10px] font-medium ${Math.random() > 0.4 ? "text-emerald-400" : "text-red-400"}`}>
                        {Math.random() > 0.4 ? "↑" : "↓"}{(Math.random() * 5).toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
