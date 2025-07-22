"use client" // クライアントコンポーネントとしてマーク

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Package, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"

// Enhanced InventoryItemの型定義
interface InventoryItem {
  id: string
  name: string
  url: string
  currentStock: number
  lastStock?: number // optional for backwards compatibility
  lastCheckDate: string
  consumptionPattern?: {
    averageDailyConsumption: number
    consumptionVariability: number
    trendDirection: "increasing" | "decreasing" | "stable"
    confidence: number
  }
  safetyStock?: number
  remainingDays?: number
  adjustedRemainingDays?: number
  status: "critical" | "low" | "normal" | "high"
  riskLevel?: number
  recommendation?: string
  
  // Legacy fields for backwards compatibility
  dailyConsumption?: number | null
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
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "critical":
        return "destructive"
      case "low":
        return "secondary"
      case "high":
        return "outline"
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
      case "high":
        return "過多"
      default:
        return "正常"
    }
  }

  const getTrendIcon = (item: InventoryItem) => {
    if (item.consumptionPattern?.trendDirection === "increasing") {
      return <TrendingUp className="w-4 h-4 text-red-500" title="消費量増加傾向" />
    } else if (item.consumptionPattern?.trendDirection === "decreasing") {
      return <TrendingDown className="w-4 h-4 text-green-500" title="消費量減少傾向" />
    } else if (item.lastStock !== undefined) {
      // Fallback to simple comparison
      if (item.currentStock < item.lastStock) {
        return <TrendingDown className="w-4 h-4 text-red-500" />
      } else if (item.currentStock > item.lastStock) {
        return <TrendingUp className="w-4 h-4 text-green-500" />
      }
    }
    return null
  }

  // 日消費量を表示する関数（複数のデータソースに対応）
  const formatDailyConsumption = (item: InventoryItem) => {
    if (item.consumptionPattern?.averageDailyConsumption) {
      return `${item.consumptionPattern.averageDailyConsumption.toFixed(1)}/日`
    } else if (item.dailyConsumption !== null && item.dailyConsumption !== undefined) {
      return `${item.dailyConsumption.toFixed(1)}/日`
    }
    return "未計算"
  }

  // 残り日数を表示する関数
  const formatRemainingDays = (item: InventoryItem) => {
    const days = item.adjustedRemainingDays ?? item.remainingDays
    if (days === null || days === undefined) {
      return "未計算"
    }
    return `約${Math.ceil(days)}日`
  }

  // 残り日数の警告表示を判定する関数
  const isRemainingDaysWarning = (item: InventoryItem) => {
    const days = item.adjustedRemainingDays ?? item.remainingDays
    return days !== null && days !== undefined && days <= 7
  }

  // リスクレベルに基づく色を取得
  const getRiskLevelColor = (riskLevel?: number) => {
    if (!riskLevel) return ""
    if (riskLevel >= 0.8) return "text-red-600"
    if (riskLevel >= 0.5) return "text-yellow-600"
    return "text-green-600"
  }

  if (loading) {
    return <div className="p-6 text-center text-lg font-medium">在庫データを読み込み中...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-lg text-destructive">在庫データの読み込みエラー: {error}</div>
  }

  // Summary Cards Data
  const criticalItems = inventoryData.filter((item) => item.status === "critical").length
  const lowItems = inventoryData.filter((item) => item.status === "low").length
  const normalItems = inventoryData.filter((item) => item.status === "normal").length
  const highItems = inventoryData.filter((item) => item.status === "high").length

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
      <div className="grid gap-4 md:grid-cols-4">
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">在庫過多商品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{highItems}</div>
            <p className="text-xs text-muted-foreground">要確認</p>
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
                  {getTrendIcon(item)}
                </div>
              </div>

              {/* Consumption Info */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">日消費量</span>
                  <span>{formatDailyConsumption(item)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">残り日数</span>
                  <span className={isRemainingDaysWarning(item) ? "text-destructive font-medium" : ""}>
                    {formatRemainingDays(item)}
                  </span>
                </div>
                {item.safetyStock && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">安全在庫</span>
                    <span>{item.safetyStock.toFixed(1)}</span>
                  </div>
                )}
                {item.riskLevel !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">リスクレベル</span>
                    <span className={getRiskLevelColor(item.riskLevel)}>
                      {Math.round(item.riskLevel * 100)}%
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">最終点検</span>
                  <span>{new Date(item.lastCheckDate).toLocaleDateString("ja-JP")}</span>
                </div>
              </div>

              {/* Recommendation */}
              {item.recommendation && (
                <div className="text-xs p-2 bg-muted rounded text-muted-foreground">
                  {item.recommendation}
                </div>
              )}

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