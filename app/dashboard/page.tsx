"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Package, ShoppingCart, TrendingUp, Calendar, Bell } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { StockHistoryChart } from "@/components/charts/stock-history-chart"

export default function DashboardPage() {
  // Mock data - in real app, this would come from API
  const [inventoryStatus, setInventoryStatus] = useState([
    { name: "プロワイプ（250枚入り）", stock: 2, status: "low", lastCheck: "2024-01-15" },
    { name: "キムタオル", stock: 8, status: "normal", lastCheck: "2024-01-15" },
    { name: "ゴム手袋（M）", stock: 1, status: "critical", lastCheck: "2024-01-14" },
    { name: "通常マスク（50枚入り）", stock: 12, status: "normal", lastCheck: "2024-01-15" },
  ])

  const recentOrders = [
    { product: "プロワイプ（250枚入り）", qty: 5, type: "auto", date: "2024-01-10" },
    { product: "ゴム手袋（S）", qty: 10, type: "manual", date: "2024-01-08" },
    { product: "キムタオル", qty: 3, type: "auto", date: "2024-01-05" },
  ]

  const [graphData, setGraphData] = useState<any[]>([])
  const [productNamesForGraph, setProductNamesForGraph] = useState<string[]>([])
  const [graphLoading, setGraphLoading] = useState(true)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [settings, setSettings] = useState<any>({ graphPastDays: 30, graphForecastDays: 7 }) // 初期値を設定

  useEffect(() => {
    async function fetchGraphData() {
      setGraphLoading(true)
      setGraphError(null)
      try {
        // 設定からグラフ表示期間を取得
        const settingsResponse = await fetch("/api/settings")
        if (!settingsResponse.ok) {
          throw new Error(`Failed to fetch settings: ${settingsResponse.status}`)
        }
        const settingsData = await settingsResponse.json()
        setSettings(settingsData)
        const pastDays = settingsData.graphPastDays || 30
        const forecastDays = settingsData.graphForecastDays || 7

        // 在庫履歴データを取得
        const historyResponse = await fetch(`/api/inventory/history?pastDays=${pastDays}&forecastDays=${forecastDays}`)
        if (!historyResponse.ok) {
          throw new Error(`Failed to fetch inventory history: ${historyResponse.status}`)
        }
        const data = await historyResponse.json()

        // グラフに表示する商品名を抽出
        if (data.length > 0) {
          const firstDataPoint = data[0]
          const names = Object.keys(firstDataPoint).filter((key) => key !== "date")
          setProductNamesForGraph(names)
        }
        setGraphData(data)
      } catch (e: any) {
        setGraphError(e.message)
        console.error("Error fetching graph data:", e)
      } finally {
        setGraphLoading(false)
      }
    }
    fetchGraphData()
  }, []) // 依存配列は空で初回のみ実行

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "destructive"
      case "low":
        return "secondary"
      default:
        return "default"
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ダッシュボード</h1>
          <p className="text-muted-foreground">消耗品注文管理システム</p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/inventory/check">
              <Package className="w-4 h-4 mr-2" />
              在庫点検
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/orders/manual">
              <ShoppingCart className="w-4 h-4 mr-2" />
              手動発注
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">総商品数</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">アクティブな商品</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">要注文商品</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">3</div>
            <p className="text-xs text-muted-foreground">在庫不足の商品</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の注文</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+20% 前月比</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">次回点検</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">金曜日</div>
            <p className="text-xs text-muted-foreground">1月19日 09:00</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock History Chart */}
      <div className="grid gap-6">
        {graphLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>在庫推移グラフ</CardTitle>
              <CardDescription>グラフデータを読み込み中...</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-muted-foreground">Loading chart data...</p>
            </CardContent>
          </Card>
        ) : graphError ? (
          <Card>
            <CardHeader>
              <CardTitle>在庫推移グラフ</CardTitle>
              <CardDescription>グラフデータの読み込みに失敗しました。</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
              <p className="text-destructive">Error: {graphError}</p>
            </CardContent>
          </Card>
        ) : (
          <StockHistoryChart
            title="主要商品の在庫推移と予測"
            description={`過去${settings.graphPastDays}日間と将来${settings.graphForecastDays}日間の在庫数の変動`}
            data={graphData}
            productNames={productNamesForGraph}
            pastDays={settings.graphPastDays} // 過去期間を渡す
          />
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Inventory Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              在庫状況
            </CardTitle>
            <CardDescription>現在の在庫レベル</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inventoryStatus.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-muted-foreground">最終点検: {item.lastCheck}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{item.stock}</span>
                  <Badge variant={getStatusColor(item.status) as any}>
                    {item.status === "critical" ? "要注文" : item.status === "low" ? "少ない" : "正常"}
                  </Badge>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full bg-transparent" asChild>
              <Link href="/inventory">詳細を見る</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              最近の注文
            </CardTitle>
            <CardDescription>直近の発注履歴</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentOrders.map((order, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{order.product}</p>
                  <p className="text-sm text-muted-foreground">{order.date}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">{order.qty}個</span>
                  <Badge variant={order.type === "auto" ? "default" : "secondary"}>
                    {order.type === "auto" ? "自動" : "手動"}
                  </Badge>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full bg-transparent" asChild>
              <Link href="/orders/history">履歴を見る</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            通知・お知らせ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">在庫不足の商品があります</p>
              <p className="text-sm text-muted-foreground">ゴム手袋（M）の在庫が1個まで減少しています。</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Calendar className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">次回在庫点検のお知らせ</p>
              <p className="text-sm text-muted-foreground">
                1月19日（金）09:00に在庫点検のリマインダーが送信されます。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
