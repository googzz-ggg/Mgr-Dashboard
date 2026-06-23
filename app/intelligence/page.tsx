"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Users, MapPin, Phone, Mail, Store, TrendingUp, ChevronDown } from "lucide-react"

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState<typeof employees[0] | null>(null)

  const employees = [
    {
      id: "EMP-0142",
      name: "Ahmed Hassan",
      role: "Sales Representative",
      area: "Cairo",
      assignedShops: 5,
      totalSales: 12450,
      revenue: "1.8M",
      phone: "+20 100 123 4567",
      email: "ahmed.h@company.com",
      status: "active",
      performance: 95,
    },
    {
      id: "EMP-0156",
      name: "Mohamed Ali",
      role: "Sales Representative",
      area: "Alex",
      assignedShops: 4,
      totalSales: 10230,
      revenue: "1.5M",
      phone: "+20 100 234 5678",
      email: "mohamed.a@company.com",
      status: "active",
      performance: 88,
    },
    {
      id: "EMP-0178",
      name: "Youssef Mahmoud",
      role: "Senior Sales Rep",
      area: "Delta",
      assignedShops: 7,
      totalSales: 18920,
      revenue: "2.7M",
      phone: "+20 100 345 6789",
      email: "youssef.m@company.com",
      status: "active",
      performance: 97,
    },
    {
      id: "EMP-0189",
      name: "Omar Khaled",
      role: "Sales Representative",
      area: "Upper",
      assignedShops: 6,
      totalSales: 8750,
      revenue: "1.2M",
      phone: "+20 100 456 7890",
      email: "omar.k@company.com",
      status: "warning",
      performance: 72,
    },
    {
      id: "EMP-0201",
      name: "Karim Samir",
      role: "Team Lead",
      area: "Cairo",
      assignedShops: 12,
      totalSales: 35600,
      revenue: "5.1M",
      phone: "+20 100 567 8901",
      email: "karim.s@company.com",
      status: "active",
      performance: 99,
    },
    {
      id: "EMP-0215",
      name: "Tamer Fathy",
      role: "Sales Representative",
      area: "Alex",
      assignedShops: 4,
      totalSales: 9870,
      revenue: "1.4M",
      phone: "+20 100 678 9012",
      email: "tamer.f@company.com",
      status: "active",
      performance: 85,
    },
    {
      id: "EMP-0228",
      name: "Mahmoud Nasser",
      role: "Sales Representative",
      area: "Delta",
      assignedShops: 5,
      totalSales: 11200,
      revenue: "1.6M",
      phone: "+20 100 789 0123",
      email: "mahmoud.n@company.com",
      status: "inactive",
      performance: 0,
    },
    {
      id: "EMP-0241",
      name: "Hassan Ibrahim",
      role: "Junior Sales Rep",
      area: "Cairo",
      assignedShops: 3,
      totalSales: 5430,
      revenue: "780K",
      phone: "+20 100 890 1234",
      email: "hassan.i@company.com",
      status: "active",
      performance: 78,
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-500/20 text-emerald-400"
      case "warning":
        return "bg-amber-500/20 text-amber-400"
      case "inactive":
        return "bg-neutral-500/20 text-neutral-400"
      default:
        return "bg-neutral-500/20 text-neutral-300"
    }
  }

  const getPerformanceColor = (perf: number) => {
    if (perf >= 90) return "text-emerald-400"
    if (perf >= 75) return "text-cyan-400"
    if (perf >= 50) return "text-amber-400"
    return "text-red-400"
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.area.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">EMPLOYEE MANAGEMENT</h1>
          <p className="text-sm text-neutral-400">Manage sales staff and performance tracking</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">Add Employee</Button>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            Export
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">TOTAL EMPLOYEES</p>
                <p className="text-2xl font-bold text-white font-mono">843</p>
              </div>
              <Users className="w-8 h-8 text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">ACTIVE TODAY</p>
                <p className="text-2xl font-bold text-emerald-400 font-mono">789</p>
              </div>
              <Users className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">AVG PERFORMANCE</p>
                <p className="text-2xl font-bold text-purple-400 font-mono">87%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">SHOPS COVERED</p>
                <p className="text-2xl font-bold text-amber-400 font-mono">3,973</p>
              </div>
              <Store className="w-8 h-8 text-amber-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="bg-neutral-900/50 border border-neutral-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500"
            />
          </div>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            Area <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            Role <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            Status <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="ghost" className="text-neutral-400 hover:text-white">
            Clear
          </Button>
        </div>
      </div>

      {/* Employee List */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              EMPLOYEE ROSTER
            </CardTitle>
            <span className="text-xs text-neutral-500">843 employees</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-500 border-b border-neutral-700">
                  <th className="text-left py-3 px-2 font-medium">EMPLOYEE</th>
                  <th className="text-left py-3 px-2 font-medium">ROLE</th>
                  <th className="text-left py-3 px-2 font-medium">AREA</th>
                  <th className="text-center py-3 px-2 font-medium">SHOPS</th>
                  <th className="text-right py-3 px-2 font-medium">SALES</th>
                  <th className="text-right py-3 px-2 font-medium">REVENUE</th>
                  <th className="text-center py-3 px-2 font-medium">PERFORMANCE</th>
                  <th className="text-left py-3 px-2 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedEmployee(employee)}
                  >
                    <td className="py-3 px-2">
                      <div>
                        <div className="text-white font-medium">{employee.name}</div>
                        <div className="text-xs text-cyan-400 font-mono">{employee.id}</div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-neutral-300">{employee.role}</td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-1.5 text-neutral-400">
                        <MapPin className="w-3 h-3" />
                        {employee.area}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-white">{employee.assignedShops}</td>
                    <td className="py-3 px-2 text-right font-mono text-emerald-400">
                      {employee.totalSales.toLocaleString()}
                    </td>
                    <td className="py-3 px-2 text-right font-mono text-amber-400">{employee.revenue}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`font-mono font-bold ${getPerformanceColor(employee.performance)}`}>
                        {employee.performance}%
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <Badge className={getStatusColor(employee.status)}>
                        {employee.status.toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="bg-neutral-900 border-neutral-700 w-full max-w-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-white tracking-wider">
                  {selectedEmployee.name}
                </CardTitle>
                <p className="text-sm text-cyan-400 font-mono">{selectedEmployee.id}</p>
              </div>
              <Button
                variant="ghost"
                onClick={() => setSelectedEmployee(null)}
                className="text-neutral-400 hover:text-white"
              >
                X
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-neutral-400 mb-1">ROLE</h3>
                    <p className="text-white">{selectedEmployee.role}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-neutral-400 mb-1">AREA</h3>
                    <div className="flex items-center gap-2 text-white">
                      <MapPin className="w-4 h-4 text-cyan-400" />
                      {selectedEmployee.area}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-neutral-400 mb-1">CONTACT</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-neutral-300">
                        <Phone className="w-4 h-4 text-neutral-500" />
                        {selectedEmployee.phone}
                      </div>
                      <div className="flex items-center gap-2 text-neutral-300">
                        <Mail className="w-4 h-4 text-neutral-500" />
                        {selectedEmployee.email}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-neutral-400 mb-1">PERFORMANCE</h3>
                    <div className="flex items-center gap-3">
                      <span className={`text-3xl font-bold font-mono ${getPerformanceColor(selectedEmployee.performance)}`}>
                        {selectedEmployee.performance}%
                      </span>
                      <Badge className={getStatusColor(selectedEmployee.status)}>
                        {selectedEmployee.status.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-neutral-400 mb-1">SHOPS</h3>
                      <p className="text-2xl font-bold text-white font-mono">{selectedEmployee.assignedShops}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-neutral-400 mb-1">SALES</h3>
                      <p className="text-2xl font-bold text-emerald-400 font-mono">
                        {selectedEmployee.totalSales.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-neutral-400 mb-1">REVENUE</h3>
                    <p className="text-2xl font-bold text-amber-400 font-mono">{selectedEmployee.revenue}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4 border-t border-neutral-700">
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">View Activity</Button>
                <Button variant="outline" className="bg-transparent border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                  Assign Shops
                </Button>
                <Button variant="outline" className="bg-transparent border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                  Edit Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
