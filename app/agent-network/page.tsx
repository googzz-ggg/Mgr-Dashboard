"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts"
import { Search, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Sample data based on Data Nexus Sales Analytics
const areaData = [
  { area: "Cairo", sales: 68000 },
  { area: "Alex", sales: 72000 },
  { area: "Delta", sales: 45000 },
  { area: "Upper", sales: 42000 },
]

const projectData = [
  { project: "Elite", sales: 95000 },
  { project: "Club", sales: 78000 },
  { project: "Star", sales: 35000 },
  { project: "Hero", sales: 28000 },
  { project: "One", sales: 18000 },
]

const topBrands = [
  { name: "Oppo", sales: 98000 },
  { name: "Realme", sales: 45000 },
  { name: "Vivo", sales: 32000 },
  { name: "Apple", sales: 18000 },
  { name: "Tecno", sales: 8000 },
]

const shopDetails = [
  { code: "S-0074-006", name: "SAMIR STORES", area: "Cairo", sellout: 2847, revenue: "4,215,000", brand: "Samsung" },
  { code: "S-0089-012", name: "AL NOUR MOBILE", area: "Alex", sellout: 2156, revenue: "3,845,000", brand: "Samsung" },
  { code: "S-0123-008", name: "TECH ZONE DELTA", area: "Delta", sellout: 1923, revenue: "3,212,000", brand: "Oppo" },
  { code: "S-0156-003", name: "PHONE HOUSE UPPER", area: "Upper", sellout: 1845, revenue: "2,956,000", brand: "Samsung" },
  { code: "S-0178-009", name: "MOBILE WORLD CAIRO", area: "Cairo", sellout: 1756, revenue: "2,734,000", brand: "Xiaomi" },
  { code: "S-0201-015", name: "SMART PHONES ALEX", area: "Alex", sellout: 1698, revenue: "2,612,000", brand: "Realme" },
  { code: "S-0234-007", name: "GALAXY STORE", area: "Delta", sellout: 1567, revenue: "2,489,000", brand: "Samsung" },
  { code: "S-0267-011", name: "DIGITAL HUB", area: "Cairo", sellout: 1489, revenue: "2,345,000", brand: "Oppo" },
]

export default function SalesAnalyticsPage() {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredShops = shopDetails.filter(
    (shop) =>
      shop.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shop.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      {/* Search and Filters */}
      <div className="bg-neutral-900/50 border border-neutral-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input
              placeholder="Search shops..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500"
            />
          </div>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            Area <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            Brand <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            Project <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="ghost" className="text-neutral-400 hover:text-white">
            Clear
          </Button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Area */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              By Area
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={areaData}>
                <XAxis dataKey="area" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Bar dataKey="sales" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By Project */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              By Project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={projectData}>
                <XAxis dataKey="project" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Bar dataKey="sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Brands */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              Top Brands
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topBrands} layout="vertical">
                <XAxis type="number" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#737373", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                <Bar dataKey="sales" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Shop Sales Details */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              Shop Sales Details
            </CardTitle>
            <span className="text-xs text-neutral-500">4,011 records</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-500 border-b border-neutral-700">
                  <th className="text-left py-3 px-2 font-medium">SHOP CODE</th>
                  <th className="text-left py-3 px-2 font-medium">SHOP NAME</th>
                  <th className="text-left py-3 px-2 font-medium">AREA</th>
                  <th className="text-right py-3 px-2 font-medium">SELLOUT</th>
                  <th className="text-right py-3 px-2 font-medium">REVENUE</th>
                  <th className="text-left py-3 px-2 font-medium">TOP BRAND</th>
                </tr>
              </thead>
              <tbody>
                {filteredShops.map((shop) => (
                  <tr
                    key={shop.code}
                    className="border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-2 font-mono text-cyan-400">{shop.code}</td>
                    <td className="py-3 px-2 text-white">{shop.name}</td>
                    <td className="py-3 px-2 text-neutral-400">{shop.area}</td>
                    <td className="py-3 px-2 text-right font-mono text-emerald-400">
                      {shop.sellout.toLocaleString()}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-amber-400">{shop.revenue}</td>
                    <td className="py-3 px-2 text-neutral-300">{shop.brand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
