"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Settings,
  Bell,
  Shield,
  Database,
  Users,
  Globe,
  Palette,
  Clock,
  Save,
  RefreshCw,
} from "lucide-react"

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    anomalyAlerts: true,
    dailyReports: true,
    ghostVisitAlerts: true,
    performanceAlerts: false,
    systemUpdates: true,
  })

  const [dataSettings, setDataSettings] = useState({
    autoSync: true,
    syncInterval: "15",
    dataRetention: "90",
  })

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wider">SETTINGS</h1>
          <p className="text-sm text-neutral-400">Configure system preferences and notifications</p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-cyan-500 hover:bg-cyan-600 text-white">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
          <Button variant="outline" className="bg-neutral-800 border-neutral-600 text-neutral-300 hover:bg-neutral-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notification Settings */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-cyan-400" />
              <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                NOTIFICATION SETTINGS
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-neutral-800">
              <div>
                <p className="text-white font-medium">Data Anomaly Alerts</p>
                <p className="text-xs text-neutral-500">Get notified when data anomalies are detected</p>
              </div>
              <Switch
                checked={notifications.anomalyAlerts}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, anomalyAlerts: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-neutral-800">
              <div>
                <p className="text-white font-medium">Daily Summary Reports</p>
                <p className="text-xs text-neutral-500">Receive daily sales and attendance summaries</p>
              </div>
              <Switch
                checked={notifications.dailyReports}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, dailyReports: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-neutral-800">
              <div>
                <p className="text-white font-medium">Ghost Visit Alerts</p>
                <p className="text-xs text-neutral-500">Alert when ghost visits are detected</p>
              </div>
              <Switch
                checked={notifications.ghostVisitAlerts}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, ghostVisitAlerts: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-neutral-800">
              <div>
                <p className="text-white font-medium">Performance Alerts</p>
                <p className="text-xs text-neutral-500">Notify when employee performance drops</p>
              </div>
              <Switch
                checked={notifications.performanceAlerts}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, performanceAlerts: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-white font-medium">System Updates</p>
                <p className="text-xs text-neutral-500">Get notified about system updates</p>
              </div>
              <Switch
                checked={notifications.systemUpdates}
                onCheckedChange={(checked) =>
                  setNotifications({ ...notifications, systemUpdates: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Sync Settings */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-emerald-400" />
              <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                DATA SYNC SETTINGS
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-neutral-800">
              <div>
                <p className="text-white font-medium">Auto Sync</p>
                <p className="text-xs text-neutral-500">Automatically sync data from sources</p>
              </div>
              <Switch
                checked={dataSettings.autoSync}
                onCheckedChange={(checked) =>
                  setDataSettings({ ...dataSettings, autoSync: checked })
                }
              />
            </div>
            <div className="py-3 border-b border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-medium">Sync Interval</p>
                <Badge className="bg-cyan-500/20 text-cyan-400">{dataSettings.syncInterval} min</Badge>
              </div>
              <p className="text-xs text-neutral-500 mb-3">How often to sync data from sources</p>
              <Input
                type="number"
                value={dataSettings.syncInterval}
                onChange={(e) => setDataSettings({ ...dataSettings, syncInterval: e.target.value })}
                className="bg-neutral-800 border-neutral-600 text-white w-32"
                min="5"
                max="60"
              />
            </div>
            <div className="py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white font-medium">Data Retention</p>
                <Badge className="bg-purple-500/20 text-purple-400">{dataSettings.dataRetention} days</Badge>
              </div>
              <p className="text-xs text-neutral-500 mb-3">How long to keep historical data</p>
              <Input
                type="number"
                value={dataSettings.dataRetention}
                onChange={(e) => setDataSettings({ ...dataSettings, dataRetention: e.target.value })}
                className="bg-neutral-800 border-neutral-600 text-white w-32"
                min="30"
                max="365"
              />
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-400" />
              <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                SECURITY SETTINGS
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="py-3 border-b border-neutral-800">
              <p className="text-white font-medium mb-1">Session Timeout</p>
              <p className="text-xs text-neutral-500 mb-3">Auto-logout after inactivity</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  defaultValue="30"
                  className="bg-neutral-800 border-neutral-600 text-white w-24"
                />
                <span className="text-neutral-400 text-sm">minutes</span>
              </div>
            </div>
            <div className="py-3 border-b border-neutral-800">
              <p className="text-white font-medium mb-1">Two-Factor Authentication</p>
              <p className="text-xs text-neutral-500 mb-3">Add extra security to your account</p>
              <Button variant="outline" className="bg-transparent border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
                Enable 2FA
              </Button>
            </div>
            <div className="py-3">
              <p className="text-white font-medium mb-1">API Keys</p>
              <p className="text-xs text-neutral-500 mb-3">Manage API access keys</p>
              <Button variant="outline" className="bg-transparent border-neutral-600 text-neutral-300 hover:bg-neutral-800">
                Manage Keys
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-purple-400" />
              <CardTitle className="text-sm font-medium text-neutral-300 tracking-wider">
                SYSTEM INFORMATION
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-400">Version</span>
              <Badge className="bg-cyan-500/20 text-cyan-400">v2.0.0</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-400">Environment</span>
              <span className="text-white font-mono">Production</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-400">Last Updated</span>
              <span className="text-white font-mono">2026-05-31</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-400">Database Status</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-400">Connected</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-400">Total Records</span>
              <span className="text-white font-mono">230,378</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-neutral-400">Active Users</span>
              <span className="text-white font-mono">843</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
