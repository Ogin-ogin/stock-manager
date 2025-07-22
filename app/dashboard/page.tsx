"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Package, ShoppingCart, TrendingUp, Calendar, Bell } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { StockHistoryChart } from "@/components/charts/stock-history-chart"

interface InventoryItem {
  id: string
  name: string
  currentStock: number
  minThreshold: number
  maxThreshold: number
  lastChecked: string
  status: 'critical' | 'low' | 'normal'
}

interface Order {
  id: string
  productName: string
  quantity: number
  orderType: 'auto' | 'manual'
  createdAt: string
  status: string
}

interface DashboardStats {
  totalProducts: number
  productsNeedingOrder: number
  ordersThisMonth: number
  ordersGrowthPercent: number
  nextInspectionDate: string
}

export default function DashboardPage() {
  const [inventoryStatus, setInventoryStatus] = useState<InventoryItem[]>([])
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalProducts: 0,
    productsNeedingOrder: 0,
    ordersThisMonth: 0,
    ordersGrowthPercent: 0,
    nextInspectionDate: ''
  })
  const [notifications, setNotifications] = useState<Array<{
    type: 'warning' | 'info'
    title: string
    message: string
    icon: any
  }>>([])

  const [graphData, setGraphData] = useState<any[]>([])
  const [productNamesForGraph, setProductNamesForGraph] = useState<string[]>([])
  const [graphLoading, setGraphLoading] = useState(true)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [settings, setSettings] = useState<any>({ graphPastDays: 30, graphForecastDays: 7 })
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboardData() {
      setLoading(true)
      setError(null)
      
      try {
        // 並列でデータを取得
        const [
          inventoryResponse,
          ordersResponse,
          settingsResponse
        ] = await Promise.all([
          fetch('/api/inventory'),
          fetch('/api/orders/history?limit=10'),
          fetch('/api/settings')
        ])

        if (!inventoryResponse.ok) {
          throw new Error(`Failed to fetch inventory: ${inventoryResponse.status}`)
        }
        if (!ordersResponse.ok) {
          throw new Error(`Failed to fetch orders: ${ordersResponse.status}`)
        }
        if (!settingsResponse.ok) {
          throw new Error(`Failed to fetch settings: ${settingsResponse.status}`)
        }

        const inventoryData = await inventoryResponse.json()
        const ordersData = await ordersResponse.json()
        const settingsData = await settingsResponse.json()

        // 在庫データを処理
        const processedInventory = inventoryData.map((item: any) => {
          let status: 'critical' | 'low' | 'normal' = 'normal'
          if (item.currentStock <= 0 || item.currentStock <= item.minThreshold * 0.5) {
            status = 'critical'
          } else if (item.currentStock <= item.minThreshold) {
            status = 'low'
          }

          return {
            id: item.id,
            name: item.name,
            currentStock: item.currentStock || 0,
            minThreshold: item.minThreshold || 0,
            maxThreshold: item.maxThreshold || 0,
            lastChecked: item.lastChecked || new Date().toISOString().split('T')[0],
            status
          }
        })

        // 注文データを処理
        const processedOrders = ordersData.slice(0, 3).map((order: any) => ({
          id: order.id,
          productName: order.product?.name || "不明な商品",
          quantity: parseInt(order.orderQty, 10) || 0,
          orderType: order.orderType === "AUTO" ? "auto" : "manual",
          createdAt: order.orderDate
            ? new Date(order.orderDate).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          status: "completed"
        }))

        // 統計データを計算
        const totalProducts = inventoryData.length
        const productsNeedingOrder = processedInventory.filter(item => 
          item.status === 'critical' || item.status === 'low'
        ).length

        // 今月の注文数を計算
        const currentMonth = new Date().getMonth()
        const currentYear = new Date().getFullYear()
        const ordersThisMonth = ordersData.filter((order: any) => {
          const orderDate = new Date(order.createdAt)
          return orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear
        }).length

        // 前月との比較（簡易版）
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear
        const ordersLastMonth = ordersData.filter((order: any) => {
          const orderDate = new Date(order.createdAt)
          return orderDate.getMonth() === lastMonth && orderDate.getFullYear() === lastMonthYear
        }).length

        const ordersGrowthPercent = ordersLastMonth > 0 
          ? Math.round(((ordersThisMonth - ordersLastMonth) / ordersLastMonth) * 100)
          : 0

        // 次回点検日を計算（設定があれば使用、なければ来週の金曜日）
        const nextFriday = new Date()
        nextFriday.setDate(nextFriday.getDate() + (5 - nextFriday.getDay() + 7) % 7)
        const nextInspectionDate = nextFriday.toLocaleDateString('ja-JP', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })

        setInventoryStatus(processedInventory.slice(0, 4)) // 上位4つのみ表示
        setRecentOrders(processedOrders)
        setDashboardStats({
          totalProducts,
          productsNeedingOrder,
          ordersThisMonth,
          ordersGrowthPercent,
          nextInspectionDate
        })
        setSettings(settingsData)

        // 通知を生成
        const newNotifications = []
        const criticalItems = processedInventory.filter(item => item.status === 'critical')
        if (criticalItems.length > 0) {
          newNotifications.push({
            type: 'warning' as const,
            title: '在庫不足の商品があります',
            message: `${criticalItems[0].name}の在庫が${criticalItems[0].currentStock}個まで減少しています。`,
            icon: AlertTriangle
          })
        }

        newNotifications.push({
          type: 'info' as const,
          title: '次回在庫点検のお知らせ',
          message: `${nextInspectionDate}に在庫点検のリマインダーが送信されます。`,
          icon: Calendar
        })

        setNotifications(newNotifications)

      } catch (e: any) {
        setError(e.message)
        console.error("Error fetching dashboard data:", e)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  // グラフデータを別途取得
  useEffect(() => {
    async function fetchGraphData() {
      if (!settings.graphPastDays) return // 設定が読み込まれるまで待つ
      
      setGraphLoading(true)
      setGraphError(null)
      try {
        const pastDays = settings.graphPastDays || 30
        const forecastDays = settings.graphForecastDays || 7

        const historyResponse = await fetch(`/api/inventory/history?pastDays=${pastDays}&forecastDays=${forecastDays}`)
        if (!historyResponse.ok) {
          throw new Error(`Failed to fetch inventory history: ${historyResponse.status}`)
        }
        const data = await historyResponse.json()

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
  }, [settings.graphPastDays, settings.graphForecastDays])

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

  const getStatusText = (status: string) => {
    switch (status) {
      case "critical":
        return "要注文"
      case "low":
        return "少ない"
      default:
        return "正常"
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">ダッシュボード</h1>
            <p className="text-muted-foreground">消耗品注文管理システム</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 rounded animate-pulse"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="text-center py-8">
          <p className="text-muted-foreground">データを読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">ダッシュボード</h1>
            <p className="text-muted-foreground">消耗品注文管理システム</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              <p>データの読み込みに失敗しました: {error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
            <div className="text-2xl font-bold">{dashboardStats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">アクティブな商品</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">要注文商品</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{dashboardStats.productsNeedingOrder}</div>
            <p className="text-xs text-muted-foreground">在庫不足の商品</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今月の注文</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.ordersThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.ordersGrowthPercent >= 0 ? '+' : ''}{dashboardStats.ordersGrowthPercent}% 前月比
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">次回点検</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardStats.nextInspectionDate.split('日')[0] + '日'}
            </div>
            <p className="text-xs text-muted-foreground">09:00予定</p>
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
            pastDays={settings.graphPastDays}
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
            {inventoryStatus.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">在庫データがありません</p>
            ) : (
              inventoryStatus.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">最終点検: {item.lastChecked}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{item.currentStock}</span>
                    <Badge variant={getStatusColor(item.status) as any}>
                      {getStatusText(item.status)}
                    </Badge>
                  </div>
                </div>
              ))
            )}
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
            {recentOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">注文履歴がありません</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{order.productName}</p>
                    <p className="text-sm text-muted-foreground">{order.createdAt}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{order.quantity}個</span>
                    <Badge variant={order.orderType === "auto" ? "default" : "secondary"}>
                      {order.orderType === "auto" ? "自動" : "手動"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
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
          {notifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">新しい通知はありません</p>
          ) : (
            notifications.map((notification, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  notification.type === 'warning'
                    ? 'bg-destructive/10'
                    : 'bg-blue-50'
                }`}
              >
                <notification.icon
                  className={`w-5 h-5 mt-0.5 ${
                    notification.type === 'warning'
                      ? 'text-destructive'
                      : 'text-blue-600'
                  }`}
                />
                <div>
                  <p
                    className={`font-medium ${
                      notification.type === 'warning'
                        ? 'text-destructive'
                        : 'text-blue-900'
                    }`}
                  >
                    {notification.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {notification.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}