"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Save, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function InventoryCheckPage() {
  const { toast } = useToast()
  const [checkerName, setCheckerName] = useState("")
  const [inventoryData, setInventoryData] = useState([
    {
      id: 1,
      name: "プロワイプ（250枚入り）",
      lastStock: 2,
      currentStock: "",
      defaultOrderQty: 5,
    },
    {
      id: 2,
      name: "キムタオル",
      lastStock: 8,
      currentStock: "",
      defaultOrderQty: 3,
    },
    {
      id: 3,
      name: "ゴム手袋（SS）",
      lastStock: 12,
      currentStock: "",
      defaultOrderQty: 10,
    },
    {
      id: 4,
      name: "ゴム手袋（S）",
      lastStock: 5,
      currentStock: "",
      defaultOrderQty: 10,
    },
    {
      id: 5,
      name: "ゴム手袋（M）",
      lastStock: 1,
      currentStock: "",
      defaultOrderQty: 10,
    },
    {
      id: 6,
      name: "ゴム手袋（L）",
      lastStock: 3,
      currentStock: "",
      defaultOrderQty: 10,
    },
    {
      id: 7,
      name: "通常マスク（50枚入り）",
      lastStock: 12,
      currentStock: "",
      defaultOrderQty: 5,
    },
  ])

  const updateStock = (id: number, value: string) => {
    setInventoryData((prev) => prev.map((item) => (item.id === id ? { ...item, currentStock: value } : item)))
  }

  const handleSave = async () => {
    if (!checkerName.trim()) {
      toast({
        title: "エラー",
        description: "点検者名を入力してください。",
        variant: "destructive",
      })
      return
    }

    const incompleteItems = inventoryData.filter((item) => !item.currentStock.trim())
    if (incompleteItems.length > 0) {
      toast({
        title: "エラー",
        description: "すべての商品の在庫数を入力してください。",
        variant: "destructive",
      })
      return
    }

    toast({
      title: "保存中",
      description: "在庫点検データを保存しています...",
    })

    try {
      const response = await fetch("/api/inventory/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkerName,
          inventoryData: inventoryData.map((item) => ({
            productId: item.id,
            stockCount: Number.parseInt(item.currentStock),
          })),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save inventory data")
      }

      const result = await response.json()

      toast({
        title: "保存完了",
        description: "在庫点検データを保存しました。自動発注判定を実行中...",
      })

      if (result.autoOrdersCreated > 0) {
        toast({
          title: "自動発注実行",
          description: `${result.autoOrdersCreated}件の商品で自動発注を実行しました。`,
        })
      }
    } catch (error) {
      console.error("Error saving inventory data:", error)
      toast({
        title: "エラー",
        description: "在庫点検データの保存に失敗しました。",
        variant: "destructive",
      })
    }
  }

  const getStockStatus = (current: string, last: number) => {
    if (!current) return null
    const currentNum = Number.parseInt(current)
    if (currentNum <= 1) return "critical"
    if (currentNum <= 3) return "low"
    return "normal"
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) return null
    switch (status) {
      case "critical":
        return <Badge variant="destructive">要注文</Badge>
      case "low":
        return <Badge variant="secondary">少ない</Badge>
      default:
        return <Badge variant="default">正常</Badge>
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">在庫点検</h1>
          <p className="text-muted-foreground">現在の在庫数を入力してください</p>
        </div>
        <div className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </div>
      </div>

      {/* Checker Name Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">点検者情報</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label htmlFor="checker-name">点検者名</Label>
            <Input
              id="checker-name"
              placeholder="山田太郎"
              value={checkerName}
              onChange={(e) => setCheckerName(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inventory Check Form */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inventoryData.map((item) => {
          const status = getStockStatus(item.currentStock, item.lastStock)
          return (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base leading-tight">{item.name}</CardTitle>
                  {getStatusBadge(status)}
                </div>
                <CardDescription>前回在庫: {item.lastStock}個</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor={`stock-${item.id}`}>現在在庫数</Label>
                  <Input
                    id={`stock-${item.id}`}
                    type="number"
                    min="0"
                    placeholder="0"
                    value={item.currentStock}
                    onChange={(e) => updateStock(item.id, e.target.value)}
                    className="mt-1 text-lg font-medium"
                  />
                </div>

                {status === "critical" && (
                  <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-destructive">在庫不足</p>
                      <p className="text-muted-foreground">自動発注対象（推奨: {item.defaultOrderQty}個）</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Save Button */}
      <div className="flex justify-center pt-6">
        <Button onClick={handleSave} size="lg" className="min-w-[200px]">
          <Save className="w-4 h-4 mr-2" />
          在庫点検を保存
        </Button>
      </div>
    </div>
  )
}
