"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { regionData, governorates, type RegionKey, type Governorate } from "@/lib/dashboard-data";

// world-atlas is the actively-maintained successor to the old deldersveld/topojson
// repo (which is gone — that 404 was the original bug here). Served off jsDelivr's
// CDN, which mirrors npm packages with proper CORS headers.
// Using the 10m (highest-resolution) variant instead of 50m so Egypt's coastline,
// Sinai, and the Red Sea/Libya borders render with much finer detail when zoomed in.
const WORLD_ATLAS_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-10m.json";
const EGYPT_ISO_NUMERIC = "818";

// Continuous red -> amber -> cyan -> neon-green scale so the map reads as a
// real heatmap instead of four flat blocks of color.
const COLOR_STOPS: [number, [number, number, number]][] = [
  [0, [239, 68, 68]], // red-500 — needs attention
  [0.55, [234, 179, 8]], // amber-500
  [0.78, [6, 182, 212]], // cyan-500
  [1, [57, 255, 20]], // brand neon — excelling
];

function performanceColor(score: number): string {
  const t = Math.max(0, Math.min(100, score)) / 100;
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [t0, c0] = COLOR_STOPS[i];
    const [t1, c1] = COLOR_STOPS[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0 || 1);
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return "rgb(57, 255, 20)";
}

function trendArrow(trend: "up" | "down" | "flat") {
  if (trend === "up") return { glyph: "▲", color: "#39ff14" };
  if (trend === "down") return { glyph: "▼", color: "#f87171" };
  return { glyph: "–", color: "#888" };
}

interface EgyptMapProps {
  onRegionClick?: (region: RegionKey) => void;
  selectedRegion?: RegionKey | null;
  /** Optional hook to hand the selected region off to the Nexus copilot. */
  onAskNexus?: (region: RegionKey) => void;
}

export default function EgyptMap({ onRegionClick, selectedRegion: controlledRegion, onAskNexus }: EgyptMapProps) {
  const [hoveredGov, setHoveredGov] = useState<Governorate | null>(null);
  const [internalSelected, setInternalSelected] = useState<RegionKey | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([30, 26.2]);
  const [geoData, setGeoData] = useState<Record<string, any> | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [activeBand, setActiveBand] = useState<number | null>(null); // index into BANDS, or null = show all
  const containerRef = useRef<HTMLDivElement>(null);

  // Performance band ranges that match the legend gradient, used for the
  // clickable legend filter ("show me only the red/struggling governorates" etc).
  const BANDS: { label: string; min: number; max: number; color: string }[] = [
    { label: "Needs attention", min: 0, max: 55, color: "rgb(239,68,68)" },
    { label: "Improving", min: 55, max: 78, color: "rgb(234,179,8)" },
    { label: "Strong", min: 78, max: 95, color: "rgb(6,182,212)" },
    { label: "Excelling", min: 95, max: 100, color: "rgb(57,255,20)" },
  ];

  const searchMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return governorates.filter((g) => g.name.toLowerCase().includes(q));
  }, [search]);

  const flyTo = useCallback((gov: Governorate) => {
    setCenter(gov.coordinates);
    setZoom((z) => Math.max(z, 3));
  }, []);

  const selectedRegion = controlledRegion ?? internalSelected;

  useEffect(() => {
    let cancelled = false;
    fetch(WORLD_ATLAS_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setGeoData(data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleSelect = (region: RegionKey) => {
    setInternalSelected(region);
    onRegionClick?.(region);
  };

  const handleSelectGov = (gov: Governorate) => {
    handleSelect(gov.region);
    flyTo(gov);
  };

  const displayed = hoveredGov
    ? { gov: hoveredGov, region: hoveredGov.region }
    : selectedRegion
    ? { gov: null, region: selectedRegion }
    : null;

  const stat = displayed ? regionData[displayed.region] : null;
  const arrow = stat ? trendArrow(stat.trend) : null;

  const cairoHub = useMemo(() => governorates.find((g) => g.name === "Cairo")!, []);

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Egypt Performance Heatmap</h3>
        <div className="text-sm text-neutral-400">Hover a city · click to filter the dashboard</div>
      </div>

      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative h-[420px] bg-black/40 rounded-lg overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle at 30% 20%, rgba(57,255,20,0.06), transparent 45%), radial-gradient(circle at 75% 80%, rgba(6,182,212,0.06), transparent 45%)",
        }}
      >
        {/* Search box */}
        <div className="absolute top-3 left-3 z-10 w-44">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search governorate…"
            className="w-full text-xs bg-neutral-800/90 border border-neutral-700 rounded px-2.5 py-1.5 text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-[#39ff14]"
          />
          {searchMatches.length > 0 && (
            <div className="mt-1 bg-neutral-900/95 border border-neutral-700 rounded shadow-lg overflow-hidden max-h-40 overflow-y-auto">
              {searchMatches.map((g) => (
                <button
                  key={g.name}
                  onClick={() => {
                    handleSelectGov(g);
                    setSearch("");
                  }}
                  className="w-full text-left text-xs px-2.5 py-1.5 text-neutral-300 hover:bg-[#39ff14]/10 hover:text-[#39ff14] flex justify-between"
                >
                  <span>{g.name}</span>
                  <span className="text-neutral-500">{g.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          {[
            { label: "+", action: () => setZoom((z) => Math.min(8, +(z + 0.6).toFixed(2))) },
            { label: "–", action: () => setZoom((z) => Math.max(1, +(z - 0.6).toFixed(2))) },
            { label: "⟲", action: () => { setZoom(1); setCenter([30, 26.2]); setActiveBand(null); } },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="w-7 h-7 rounded bg-neutral-800/90 border border-neutral-700 text-neutral-300 hover:border-[#39ff14] hover:text-[#39ff14] text-sm transition-colors"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
            <span className="text-neutral-400 text-sm">Map uplink unavailable — couldn't load Egypt's outline.</span>
            <button
              onClick={() => {
                setLoadError(false);
                setGeoData(null);
                fetch(WORLD_ATLAS_URL)
                  .then((r) => r.json())
                  .then(setGeoData)
                  .catch(() => setLoadError(true));
              }}
              className="text-xs px-3 py-1 rounded border border-neutral-600 text-neutral-300 hover:border-[#39ff14] hover:text-[#39ff14]"
            >
              Retry
            </button>
          </div>
        )}

        {!geoData && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-neutral-500 text-xs tracking-wide animate-pulse">CALIBRATING SATELLITE UPLINK…</span>
          </div>
        )}

        {geoData && (
          <ComposableMap projection="geoMercator" projectionConfig={{ scale: 2200, center: [30, 26.2] }}>
            <defs>
              <filter id="nexusGlow" x="-75%" y="-75%" width="250%" height="250%">
                <feGaussianBlur stdDeviation="3.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <ZoomableGroup
              zoom={zoom}
              center={center}
              minZoom={1}
              maxZoom={8}
              onMoveEnd={({ zoom: z, coordinates }) => {
                setZoom(z);
                setCenter(coordinates as [number, number]);
              }}
            >
              <Geographies geography={geoData}>
                {({ geographies }) =>
                  geographies
                    .filter((geo: any) => String(geo.id) === EGYPT_ISO_NUMERIC)
                    .map((geo: any) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        style={{
                          default: { fill: "#161616", stroke: "#39ff14", strokeWidth: 0.6, strokeOpacity: 0.35, outline: "none" },
                          hover: { fill: "#1a1a1a", stroke: "#39ff14", strokeWidth: 0.6, strokeOpacity: 0.35, outline: "none" },
                          pressed: { fill: "#1a1a1a", outline: "none" },
                        }}
                      />
                    ))
                }
              </Geographies>

              {/* Signature element: HQ pulse radiating from Cairo, the network's command center */}
              <Marker coordinates={cairoHub.coordinates}>
                {[0, 1, 2].map((i) => (
                  <circle key={i} r={4} className="nexus-hq-ring" style={{ animationDelay: `${i * 0.9}s` }} fill="none" stroke="#39ff14" strokeWidth={1} />
                ))}
              </Marker>

              {governorates.map((gov) => {
                const stat = regionData[gov.region];
                const color = performanceColor(stat.performance);
                const isHovered = hoveredGov?.name === gov.name;
                const isSelected = selectedRegion === gov.region;
                const baseRadius = gov.hub ? 7 : 3.6;
                const band = activeBand !== null ? BANDS[activeBand] : null;
                const inBand = !band || (stat.performance >= band.min && stat.performance <= band.max);

                return (
                  <Marker
                    key={gov.name}
                    coordinates={gov.coordinates}
                    onMouseEnter={() => setHoveredGov(gov)}
                    onMouseLeave={() => setHoveredGov((cur) => (cur?.name === gov.name ? null : cur))}
                    onClick={() => handleSelectGov(gov)}
                    style={{ default: { opacity: inBand ? 1 : 0.15 }, hover: { opacity: 1 }, pressed: { opacity: 1 } }}
                  >
                    <circle
                      r={baseRadius * 2.4}
                      fill={color}
                      opacity={inBand ? 0.25 : 0}
                      className="nexus-marker-pulse"
                      style={{ pointerEvents: "none" }}
                    />
                    <circle
                      r={baseRadius}
                      fill={color}
                      stroke={isSelected ? "#fff" : "#0a0a0a"}
                      strokeWidth={isSelected ? 2 : 1}
                      style={{
                        cursor: "pointer",
                        filter: isHovered || isSelected ? "url(#nexusGlow)" : undefined,
                        transition: "r 0.15s ease, filter 0.15s ease, opacity 0.2s ease",
                      }}
                    />
                    {gov.hub && (
                      <text
                        textAnchor="middle"
                        y={-baseRadius - 6}
                        style={{
                          fontFamily: "system-ui, sans-serif",
                          fontSize: 9,
                          fontWeight: 600,
                          fill: isHovered || isSelected ? "#39ff14" : "#999",
                          paintOrder: "stroke",
                          stroke: "#0a0a0a",
                          strokeWidth: 3,
                        }}
                      >
                        {gov.name}
                      </text>
                    )}
                  </Marker>
                );
              })}
            </ZoomableGroup>
          </ComposableMap>
        )}

        {/* Tooltip that follows the cursor */}
        {hoveredGov && (
          <div
            className="absolute z-20 pointer-events-none px-3 py-2 rounded-lg border border-[#39ff14]/40 bg-neutral-900/95 backdrop-blur-sm shadow-lg"
            style={{ left: mousePos.x + 14, top: mousePos.y + 14, minWidth: "150px" }}
          >
            <div className="text-white text-sm font-semibold">{hoveredGov.name}</div>
            <div className="text-[11px] text-neutral-400 mb-1">{hoveredGov.region} region</div>
            <div className="text-xs" style={{ color: performanceColor(regionData[hoveredGov.region].performance) }}>
              {regionData[hoveredGov.region].performance}% performance
            </div>
          </div>
        )}

        {/* Legend — click a band to highlight only governorates in that range */}
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 bg-neutral-900/80 rounded px-2 py-1.5 border border-neutral-800">
          {BANDS.map((b, i) => (
            <button
              key={b.label}
              onClick={() => setActiveBand((cur) => (cur === i ? null : i))}
              title={`${b.label} (${b.min}-${b.max}%)`}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors"
              style={{
                background: activeBand === i ? `${b.color}22` : "transparent",
                border: `1px solid ${activeBand === i ? b.color : "transparent"}`,
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
              <span className="text-[10px] text-neutral-400 whitespace-nowrap">{b.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel: persists last hovered/selected region's stats */}
      {stat ? (
        <div className="mt-3 p-3 bg-neutral-800 rounded-lg text-sm flex items-center justify-between gap-4">
          <div>
            <strong className="text-white">
              {displayed?.gov ? `${displayed.gov.name} · ` : ""}
              {displayed?.region}
            </strong>
            <span className="text-neutral-400"> — {stat.performance}% performance · {stat.sales} · {stat.shops} shops</span>
            <div className="text-xs text-neutral-500 mt-0.5">{stat.note}</div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {arrow && (
              <span className="text-lg" style={{ color: arrow.color }}>
                {arrow.glyph}
              </span>
            )}
            {onAskNexus && displayed && (
              <button
                onClick={() => onAskNexus(displayed.region)}
                className="text-[11px] px-2.5 py-1 rounded border border-[#39ff14]/40 text-[#39ff14] hover:bg-[#39ff14]/10 whitespace-nowrap"
              >
                Ask Nexus →
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 p-3 bg-neutral-800/50 rounded-lg text-xs text-neutral-500">
          Hover a marker to inspect a governorate, or click one to filter the dashboard to its region.
        </div>
      )}

      <style>{`
        @keyframes nexus-marker-pulse {
          0% { transform: scale(0.6); opacity: 0.5; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .nexus-marker-pulse {
          transform-origin: center;
          transform-box: fill-box;
          animation: nexus-marker-pulse 2.4s ease-out infinite;
        }
        @keyframes nexus-hq-ring {
          0% { r: 4; stroke-opacity: 0.8; }
          100% { r: 34; stroke-opacity: 0; }
        }
        .nexus-hq-ring {
          transform-origin: center;
          transform-box: fill-box;
          animation: nexus-hq-ring 2.7s ease-out infinite;
        }
      `}</style>
    </div>
  );
}
