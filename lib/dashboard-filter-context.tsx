"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { RegionKey } from "@/lib/dashboard-data";

interface DashboardFilterState {
  selectedRegion: RegionKey | null;
  setSelectedRegion: (region: RegionKey | null) => void;
}

const DashboardFilterContext = createContext<DashboardFilterState | null>(null);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [selectedRegion, setSelectedRegion] = useState<RegionKey | null>(null);
  return (
    <DashboardFilterContext.Provider value={{ selectedRegion, setSelectedRegion }}>
      {children}
    </DashboardFilterContext.Provider>
  );
}

// Use this in ANY page/component that needs to read or change the active
// region filter — Dashboard, Sales Analytics, Attendance, Employees, etc.
// Previously selectedRegion only lived inside app/page.tsx's local state and
// was passed as a prop into just EgyptMap/NexusCopilot/the Dashboard tab —
// every other section page had no way to see or react to it, so switching
// tabs silently dropped the filter. This context fixes that: call
// useDashboardFilter() from any page and it reads/writes the same shared state.
export function useDashboardFilter() {
  const ctx = useContext(DashboardFilterContext);
  if (!ctx) {
    throw new Error("useDashboardFilter must be used within a DashboardFilterProvider (wrap your app in layout.tsx or page.tsx)");
  }
  return ctx;
}
