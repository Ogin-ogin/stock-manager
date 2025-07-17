"use client" // クライアントコンポーネントとしてマーク

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"

// InventoryItemの型定義 (Prismaスキーマに合わせて調整)
interface InventoryItem {
  id: string
  name: string
  url: string
  currentStock: number
  lastStock: number
  lastCheckDate: string // ISO string
  dailyConsumption: number | null // nullの可能性を追加
  remainingDays: number | null // nullの可能性を追加
  status: "critical" | "low" | "normal"
}

export default function InventoryPage() {
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchInventory() {
      try {
        setLoading(true)
        const response = await fetch("/api/inventory")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: InventoryItem[] = await response.json()
        setInventoryData(data)
      } catch (e: any) {
        setError(e.message)
        console.error("Failed to fetch inventory data:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchInventory()
  }, []) // 空の依存配列で初回レンダリング時のみ実行

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

  const getTrendIcon = (current: number, last: number) => {
    if (current < last) {
      return <TrendingDown className="w-4 h-4 text-red-500" />
    } else if (current > last) {
      return <TrendingUp className="w-4 h-4 text-green-500" />
    }
    return null
  }

  // 安全に日消費量を表示する関数
  const formatDailyConsumption = (dailyConsumption: number | null) => {
    if (dailyConsumption === null || dailyConsumption === undefined) {
      return "未計算"
    }
    return `${dailyConsumption.toFixed(1)}/日`
  }

  // 安全に残り日数を表示する関数
  const formatRemainingDays = (remainingDays: number | null) => {
    if (remainingDays === null || remainingDays === undefined) {
      return "未計算"
    }
    return `約${Math.ceil(remainingDays)}日`
  }

  // 残り日数の警告表示を判定する関数
  const isRemainingDaysWarning = (remainingDays: number | null) => {
    return remainingDays !== null && remainingDays !== undefined && remainingDays <= 7
  }

  if (loading) {
    return <div className="p-6 text-center text-lg font-medium">Loading inventory data...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-lg text-destructive">Error loading inventory data: {error}</div>
  }

  // Summary Cards Data
  const criticalItems = inventoryData.filter((item) => item.status === "critical").length
  const lowItems = inventoryData.filter((item) => item.status === "low").length
  const normalItems = inventoryData.filter((item) => item.status === "normal").length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">在庫管理</h1>
          <p className="text-muted-foreground">現在の在庫状況と消費予測</p>
        </div>
        <Button asChild>
          <Link href="/inventory/check">
            <Package className="w-4 h-4 mr-2" />
            在庫点検を実行
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">要注文商品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{criticalItems}</div>
            <p className="text-xs text-muted-foreground">緊急対応が必要</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">在庫少ない商品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{lowItems}</div>
            <p className="text-xs text-muted-foreground">注意が必要</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">正常在庫商品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{normalItems}</div>
            <p className="text-xs text-muted-foreground">問題なし</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inventoryData.map((item) => (
          <Card key={item.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base leading-tight">{item.name}</CardTitle>
                <Badge variant={getStatusColor(item.status) as any}>{getStatusText(item.status)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Stock */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">現在在庫</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{item.currentStock}</span>
                  {getTrendIcon(item.currentStock, item.lastStock)}
                </div>
              </div>

              {/* Consumption Info */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">日消費量</span>
                  <span>{formatDailyConsumption(item.dailyConsumption)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">残り日数</span>
                  <span className={isRemainingDaysWarning(item.remainingDays) ? "text-destructive font-medium" : ""}>
                    {formatRemainingDays(item.remainingDays)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最終点検</span>
                  <span>{new Date(item.lastCheckDate).toLocaleDateString("ja-JP")}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    商品ページ
                  </a>
                </Button>
                {item.status === "critical" && (
                  <Button size="sm" className="flex-1" asChild>
                    <Link href={`/orders/manual?product=${item.id}`}>発注</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
