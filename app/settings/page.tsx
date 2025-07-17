"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Bell, FileText, Database, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { toast } = useToast()

  const [settings, setSettings] = useState({
    consumptionCalcDays: 7,
    reorderThresholdDays: 30,
    reminderDay: 5,
    reminderTime: "09:00",
    slackWebhookUrl: "",
    exportDay: 1,
    exportTime: "10:00",
    systemName: "触媒研究室 消耗品注文管理システム",
    adminEmail: "admin@lab.example.com",
    graphPastDays: 30, // 新しい設定項目: デフォルト30日
    graphForecastDays: 7, // 新しい設定項目: デフォルト7日
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch("/api/settings")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        setSettings(data)
      } catch (e: any) {
        console.error("Failed to fetch settings data:", e)
        toast({
          title: "エラー",
          description: "設定データの読み込みに失敗しました。",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleSettingChange = (key: string, value: string | number) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    try {
      const settingsPayload = {
        ...settings,
        // 数値として保存されるべきフィールドを明示的に変換
        consumptionCalcDays: Number(settings.consumptionCalcDays),
        reorderThresholdDays: Number(settings.reorderThresholdDays),
        reminderDay: Number(settings.reminderDay),
        exportDay: Number(settings.exportDay),
        graphPastDays: Number(settings.graphPastDays), // 新しい設定項目も変換
        graphForecastDays: Number(settings.graphForecastDays), // 新しい設定項目も変換
      }

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settingsPayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save settings")
      }

      toast({
        title: "設定保存完了",
        description: "設定を保存しました。",
      })
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "設定の保存に失敗しました。",
        variant: "destructive",
      })
    }
  }

  const testSlackNotification = async () => {
    if (!settings.slackWebhookUrl.trim()) {
      toast({
        title: "エラー",
        description: "Slack Webhook URLを入力してください。",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "テスト通知送信中",
      description: "Slackにテスト通知を送信しています...",
    })

    try {
      const response = await fetch("/api/slack/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ webhookUrl: settings.slackWebhookUrl }),
      })

      if (!response.ok) {
        throw new Error("Failed to send test notification")
      }

      toast({
        title: "テスト通知完了",
        description: "Slackにテスト通知を送信しました。",
      })
    } catch (error) {
      console.error("Error sending test notification:", error)
      toast({
        title: "エラー",
        description: "テスト通知の送信に失敗しました。",
        variant: "destructive",
      })
    }
  }

  const weekdays = [
    { value: "0", label: "日曜日" },
    { value: "1", label: "月曜日" },
    { value: "2", label: "火曜日" },
    { value: "3", label: "水曜日" },
    { value: "4", label: "木曜日" },
    { value: "5", label: "金曜日" },
    { value: "6", label: "土曜日" },
  ]

  if (loading) {
    return <div className="p-6 text-center text-lg font-medium">設定を読み込み中...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">設定</h1>
          <p className="text-muted-foreground">システムの各種設定を管理します</p>
        </div>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          設定を保存
        </Button>
      </div>

      <Tabs defaultValue="inventory" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            在庫管理
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            通知設定
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            出力設定
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            システム
          </TabsTrigger>
        </TabsList>

        {/* Inventory Settings */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>在庫管理設定</CardTitle>
              <CardDescription>消費量計算や自動発注に関する設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="consumption-days">消費量計算期間（日）</Label>
                  <Input
                    id="consumption-days"
                    type="number"
                    min="1"
                    max="30"
                    value={settings.consumptionCalcDays}
                    onChange={(e) =>
                      handleSettingChange("consumptionCalcDays", Number.parseInt(e.target.value, 10) || 1)
                    }
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">過去何日間の在庫変動から消費量を計算するか</p>
                </div>
                <div>
                  <Label htmlFor="reorder-threshold">再注文閾値日数</Label>
                  <Input
                    id="reorder-threshold"
                    type="number"
                    min="1"
                    max="90"
                    value={settings.reorderThresholdDays}
                    onChange={(e) =>
                      handleSettingChange("reorderThresholdDays", Number.parseInt(e.target.value, 10) || 1)
                    }
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">残り何日分の在庫で自動発注を実行するか</p>
                </div>
              </div>
              {/* グラフ表示期間設定 */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="graph-past-days">グラフ表示期間（過去）</Label>
                  <Input
                    id="graph-past-days"
                    type="number"
                    min="7"
                    max="180"
                    value={settings.graphPastDays}
                    onChange={(e) => handleSettingChange("graphPastDays", Number.parseInt(e.target.value, 10) || 7)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">在庫推移グラフに表示する過去の期間</p>
                </div>
                <div>
                  <Label htmlFor="graph-forecast-days">グラフ予測期間（将来）</Label>
                  <Input
                    id="graph-forecast-days"
                    type="number"
                    min="0"
                    max="30"
                    value={settings.graphForecastDays}
                    onChange={(e) => handleSettingChange("graphForecastDays", Number.parseInt(e.target.value, 10) || 0)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">在庫推移グラフに表示する将来の予測期間</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>在庫点検リマインダー</CardTitle>
                <CardDescription>定期的な在庫点検のリマインダー設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>
                      リマインダー曜日
                      <Select
                        value={settings.reminderDay.toString()}
                        onValueChange={(value) => handleSettingChange("reminderDay", Number.parseInt(value, 10))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {weekdays.map((day) => (
                            <SelectItem key={day.value} value={day.value}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Label>
                  </div>
                  <div>
                    <Label htmlFor="reminder-time">リマインダー時刻</Label>
                    <Input
                      id="reminder-time"
                      type="time"
                      value={settings.reminderTime}
                      onChange={(e) => handleSettingChange("reminderTime", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Slack通知設定</CardTitle>
                <CardDescription>Slackへの通知機能の設定</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                  <Input
                    id="slack-webhook"
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={settings.slackWebhookUrl}
                    onChange={(e) => handleSettingChange("slackWebhookUrl", e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">SlackのIncoming Webhook URLを設定してください</p>
                </div>
                <Button variant="outline" onClick={testSlackNotification}>
                  <Bell className="w-4 h-4 mr-2" />
                  テスト通知を送信
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Export Settings */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>注文書自動出力設定</CardTitle>
              <CardDescription>注文書の自動出力スケジュール設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>
                    出力曜日
                    <Select
                      value={settings.exportDay.toString()}
                      onValueChange={(value) => handleSettingChange("exportDay", Number.parseInt(value, 10))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {weekdays.map((day) => (
                          <SelectItem key={day.value} value={day.value}>
                            {day.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                </div>
                <div>
                  <Label htmlFor="export-time">出力時刻</Label>
                  <Input
                    id="export-time"
                    type="time"
                    value={settings.exportTime}
                    onChange={(e) => handleSettingChange("exportTime", e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  現在の設定: 毎週{weekdays.find((d) => d.value === settings.exportDay)?.label} {settings.exportTime}
                  に注文書を自動出力
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>システム設定</CardTitle>
              <CardDescription>システム全体の基本設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="system-name">システム名</Label>
                <Input
                  id="system-name"
                  value={settings.systemName}
                  onChange={(e) => handleSettingChange("systemName", e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="admin-email">管理者メールアドレス</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={settings.adminEmail}
                  onChange={(e) => handleSettingChange("adminEmail", e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
