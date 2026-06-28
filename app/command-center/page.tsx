"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  ShoppingCart,
  Users,
  Store,
  Ghost,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  TrendingUp,
} from "lucide-react"

// Stable pulse heights (no Math.random on render) for the audio/data stream visualizer
const pulseHeights = [
  18, 28, 15, 32, 22, 19, 27, 14, 31, 25, 20, 29, 16, 33, 21, 17, 26, 13, 30, 24, 
  19, 28, 15, 32, 22, 18, 27, 14, 31, 23
]

const weeklyData = [
  { week: "W19", sellout: 49458 },
  { week: "W20", sellout: 49051 },
  { week: "W21", sellout: 46825 },
  { week: "W22", sellout: 42421 },
]

const areaData = [
  { name: "Cairo", value: 72514, color: "#06b6d4" },
  { name: "Delta", value: 49198, color: "#8b5cf6" },
  { name: "Upper Egypt", value: 38718, color: "#22c55e" },
  { name: "Alex", value: 27325, color: "#f59e0b" },
]

const topBrands = [
  { name: "Samsung", sales: 84618 },
  { name: "Oppo",    sales: 34453 },
  { name: "Xiaomi",  sales: 19383 },
  { name: "Realme",  sales: 16292 },
  { name: "Infinix", sales: 10069 },
]

const topShops = [
  { code: "S-0074-005", name: "Dubai Phone",                area: "Cairo", project: "Elite", sellout: 3042, revenue: "EGP 63.1M", brand: "Oppo"    },
  { code: "S-0074-006", name: "Dubai Phone (City Center)",      area: "Cairo", project: "Elite", sellout: 2495, revenue: "EGP 63.4M", brand: "Samsung" },
  { code: "S-0074-008", name: "Dubai Phone (Mohandseen)",       area: "Cairo", project: "Elite", sellout: 2247, revenue: "EGP 49.2M", brand: "Samsung" },
  { code: "S-0074-020", name: "Dubai Phone (Smouha)",           area: "Alex",  project: "Elite", sellout: 1942, revenue: "EGP 51.7M", brand: "Samsung" },
  { code: "S-0074-022", name: "Dubai Phone (Mosdak)",           area: "Cairo", project: "Elite", sellout: 1923, revenue: "EGP 39.9M", brand: "Oppo"    },
]

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 bg-black text-neutral-200">
      
      {/* Live Data Stream Header */}
      <div className="bg-neutral-900/50 border border-neutral-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium tracking-wider">LIVE DATA STREAM</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <span>May 1–31, 2026</span>
            <span className="bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">W19 — W22</span>
          </div>
        </div>

        {/* Animated Wave */}
        <div className="flex items-center justify-center gap-1 mb-6 h-12">
          {pulseHeights.map((height, i) => (
            <div
              key={i}
              className="w-1 bg-cyan-400/60 rounded-full animate-pulse"
              style={{
                height: `${height}px`,
                animationDelay: `${(i * 0.035).toFixed(2)}s`,
              }}
            />
          ))}
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: ShoppingCart, value: "230,378", label: "SALES RECORDS",   color: "text-cyan-400"   },
            { icon: Users,        value: "43,541",  label: "ATTENDANCE",       color: "text-purple-400" },
            { icon: Store,        value: "3,973",   label: "BRIDGED SHOPS",    color: "text-emerald-400"},
            { icon: Ghost,        value: "38",      label: "SALES / NO ATT",   color: "text-amber-400"  },
            { icon: AlertTriangle,value: "2,386",   label: "ATT / NO SALES",   color: "text-orange-400" },
            { icon: CheckCircle,  value: "99.2%",   label: "DATA ACCURACY",    color: "text-emerald-400"},
          ].map((metric, i) => (
            <div key={i} className="text-center">
              <metric.icon className={`w-5 h-5 mx-auto mb-2 ${metric.color}`} />
              <div className={`text-2xl font-bold ${metric.color} font-mono`}>{metric.value}</div>
              <div className="text-xs text-neutral-500 font-medium tracking-wide">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Total Sellout */}
        <Card className="lg:col-span-2 bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400 font-medium">TOTAL SELLOUT</span>
              <ShoppingCart className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-white font-mono">188K</div>
            <div className="text-xs text-neutral-500">187,755 units W19–W22</div>
          </CardContent>
        </Card>

        {/* Total Revenue */}
        <Card className="lg:col-span-3 bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400 font-medium">TOTAL REVENUE</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-400 font-mono">EGP 2.73B</div>
            <div className="text-xs text-neutral-500">Estimated from sellout × price</div>
          </CardContent>
        </Card>

        {/* Active Shops */}
        <Card className="lg:col-span-2 bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400 font-medium">ACTIVE SHOPS</span>
              <Store className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white font-mono">3,973</div>
            <div className="text-xs text-neutral-500">Matched sales + attendance</div>
          </CardContent>
        </Card>

        {/* Employees */}
        <Card className="lg:col-span-2 bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400 font-medium">EMPLOYEES</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-white font-mono">843</div>
            <div className="text-xs text-neutral-500">Unique staff members</div>
          </CardContent>
        </Card>

        {/* Integrity Flag */}
        <Card className="lg:col-span-3 bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400 font-medium">INTEGRITY FLAGS</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-400 font-mono">38</div>
            <div className="text-xs text-neutral-500">Shops: sales but no attendance</div>
          </CardContent>
        </Card>

        {/* Weekly Sellout Trend */}
        <Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              Weekly Sellout Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weeklyData}>
                <XAxis dataKey="week" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Bar dataKey="sellout" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Sales by Area */}
        <Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              Sales by Area
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={areaData} cx="50%" cy="50%" innerRadius={42} outerRadius={70} dataKey="value" paddingAngle={2}>
                  {areaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
              {areaData.map((area) => (
                <div key={area.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: area.color }} />
                  <span className="text-neutral-400">{area.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Brands */}
        <Card className="lg:col-span-4 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              Top 5 Brands
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topBrands.map((brand) => (
                <div key={brand.name} className="flex items-center justify-between">
                  <span className="text-sm text-neutral-300">{brand.name}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-28 sm:w-32 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${(brand.sales / topBrands[0].sales) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-amber-400 w-16 text-right">
                      {brand.sales.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Shops */}
        <Card className="lg:col-span-12 bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                Top Shops by Sellout (Real Data)
              </CardTitle>
              <span className="text-[11px] font-mono text-neutral-500">from MBL_Raw_Data_W19_W22</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-neutral-500 border-b border-neutral-700">
                    <th className="text-left py-3 px-2 font-medium tracking-wide">SHOP CODE</th>
                    <th className="text-left py-3 px-2 font-medium tracking-wide">SHOP NAME</th>
                    <th className="text-left py-3 px-2 font-medium tracking-wide">AREA</th>
                    <th className="text-left py-3 px-2 font-medium tracking-wide">PROJECT</th>
                    <th className="text-right py-3 px-2 font-medium tracking-wide">SELLOUT</th>
                    <th className="text-right py-3 px-2 font-medium tracking-wide">REVENUE</th>
                    <th className="text-left py-3 px-2 font-medium tracking-wide">TOP BRAND</th>
                  </tr>
                </thead>
                <tbody>
                  {topShops.map((shop) => (
                    <tr key={shop.code} className="border-b border-neutral-800 hover:bg-neutral-800/40 transition-colors text-xs">
                      <td className="py-3 px-2 font-mono text-cyan-400 font-medium">{shop.code}</td>
                      <td className="py-3 px-2 text-white font-medium">{shop.name}</td>
                      <td className="py-3 px-2 text-neutral-400">{shop.area}</td>
                      <td className="py-3 px-2">
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded text-[10px] font-medium uppercase tracking-wider">
                          {shop.project}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-emerald-400 font-medium">{shop.sellout.toLocaleString()}</td>
                      <td className="py-3 px-2 text-right font-mono text-amber-400 font-medium">{shop.revenue}</td>
                      <td className="py-3 px-2 text-neutral-300">{shop.brand}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}