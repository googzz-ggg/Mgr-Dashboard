"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, MapPin, Clock, Users, CheckCircle, XCircle, ChevronDown } from "lucide-react"

export default function AttendancePage() {
  const [searchTerm, setSearchTerm] = useState("")

  const attendanceRecords = [
    {
      id: "ATT-001",
      employeeId: "EMP-0142",
      employeeName: "Ahmed Hassan",
      shopCode: "S-0074-006",
      shopName: "SAMIR STORES",
      area: "Cairo",
      date: "2026-05-31",
      checkIn: "09:15",
      checkOut: "17:45",
      status: "present",
      hoursWorked: 8.5,
    },
    {
      id: "ATT-002",
      employeeId: "EMP-0156",
      employeeName: "Mohamed Ali",
      shopCode: "S-0089-012",
      shopName: "AL NOUR MOBILE",
      area: "Alex",
      date: "2026-05-31",
      checkIn: "08:30",
      checkOut: "16:30",
      status: "present",
      hoursWorked: 8.0,
    },
    {
      id: "ATT-003",
      employeeId: "EMP-0178",
      employeeName: "Youssef Mahmoud",
      shopCode: "S-0123-008",
      shopName: "TECH ZONE DELTA",
      area: "Delta",
      date: "2026-05-31",
      checkIn: "--:--",
      checkOut: "--:--",
      status: "absent",
      hoursWorked: 0,
    },
    {
      id: "ATT-004",
      employeeId: "EMP-0189",
      employeeName: "Omar Khaled",
      shopCode: "S-0156-003",
      shopName: "PHONE HOUSE UPPER",
      area: "Upper",
      date: "2026-05-31",
      checkIn: "10:00",
      checkOut: "18:30",
      status: "late",
      hoursWorked: 8.5,
    },
    {
      id: "ATT-005",
      employeeId: "EMP-0201",
      employeeName: "Karim Samir",
      shopCode: "S-0178-009",
      shopName: "MOBILE WORLD CAIRO",
      area: "Cairo",
      date: "2026-05-31",
      checkIn: "09:00",
      checkOut: "17:00",
      status: "present",
      hoursWorked: 8.0,
    },
    {
      id: "ATT-006",
      employeeId: "EMP-0215",
      employeeName: "Tamer Fathy",
      shopCode: "S-0201-015",
      shopName: "SMART PHONES ALEX",
      area: "Alex",
      date: "2026-05-31",
      checkIn: "08:45",
      checkOut: "17:15",
      status: "present",
      hoursWorked: 8.5,
    },
    {
      id: "ATT-007",
      employeeId: "EMP-0228",
      employeeName: "Mahmoud Nasser",
      shopCode: "S-0234-007",
      shopName: "GALAXY STORE",
      area: "Delta",
      date: "2026-05-31",
      checkIn: "09:30",
      checkOut: "18:00",
      status: "present",
      hoursWorked: 8.5,
    },
    {
      id: "ATT-008",
      employeeId: "EMP-0241",
      employeeName: "Hassan Ibrahim",
      shopCode: "S-0267-011",
      shopName: "DIGITAL HUB",
      area: "Cairo",
      date: "2026-05-31",
      checkIn: "--:--",
      checkOut: "--:--",
      status: "absent",
      hoursWorked: 0,
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-emerald-500/20 text-emerald-400"
      case "absent":
        return "bg-red-500/20 text-red-400"
      case "late":
        return "bg-amber-500/20 text-amber-400"
      default:
        return "bg-neutral-500/20 text-neutral-300"
    }
  }

  const filteredRecords = attendanceRecords.filter(
    (record) =>
      record.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.shopName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.shopCode.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">ATTENDANCE TRACKER</h1>
          <p className="text-sm text-neutral-400">Employee attendance and shop visit records</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">Export Report</Button>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            <Calendar className="w-4 h-4 mr-2" />
            May 2026
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">TOTAL ATTENDANCE</p>
                <p className="text-2xl font-bold text-white font-mono">43,541</p>
              </div>
              <Users className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">PRESENT TODAY</p>
                <p className="text-2xl font-bold text-emerald-400 font-mono">789</p>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">ABSENT TODAY</p>
                <p className="text-2xl font-bold text-red-400 font-mono">54</p>
              </div>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900 border-neutral-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-400 tracking-wider">ATTENDANCE RATE</p>
                <p className="text-2xl font-bold text-cyan-400 font-mono">93.6%</p>
              </div>
              <Clock className="w-8 h-8 text-cyan-400" />
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
              placeholder="Search employees or shops..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500"
            />
          </div>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            Area <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            Status <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
          <Button variant="ghost" className="text-neutral-400 hover:text-white">
            Clear
          </Button>
        </div>
      </div>

      {/* Attendance Records Table */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
              ATTENDANCE RECORDS
            </CardTitle>
            <span className="text-xs text-neutral-500">43,541 records</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-neutral-500 border-b border-neutral-700">
                  <th className="text-left py-3 px-2 font-medium">EMPLOYEE</th>
                  <th className="text-left py-3 px-2 font-medium">SHOP</th>
                  <th className="text-left py-3 px-2 font-medium">AREA</th>
                  <th className="text-left py-3 px-2 font-medium">DATE</th>
                  <th className="text-center py-3 px-2 font-medium">CHECK IN</th>
                  <th className="text-center py-3 px-2 font-medium">CHECK OUT</th>
                  <th className="text-center py-3 px-2 font-medium">HOURS</th>
                  <th className="text-left py-3 px-2 font-medium">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-neutral-800 hover:bg-neutral-800/50 transition-colors"
                  >
                    <td className="py-3 px-2">
                      <div>
                        <div className="text-white">{record.employeeName}</div>
                        <div className="text-xs text-neutral-500 font-mono">{record.employeeId}</div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div>
                        <div className="text-neutral-300">{record.shopName}</div>
                        <div className="text-xs text-cyan-400 font-mono">{record.shopCode}</div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-neutral-400">{record.area}</td>
                    <td className="py-3 px-2 text-neutral-400 font-mono">{record.date}</td>
                    <td className="py-3 px-2 text-center font-mono text-emerald-400">{record.checkIn}</td>
                    <td className="py-3 px-2 text-center font-mono text-amber-400">{record.checkOut}</td>
                    <td className="py-3 px-2 text-center font-mono text-white">{record.hoursWorked}h</td>
                    <td className="py-3 px-2">
                      <Badge className={getStatusColor(record.status)}>
                        {record.status.toUpperCase()}
                      </Badge>
                    </td>
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
