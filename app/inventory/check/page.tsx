"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Package, Plus, Minus, Save, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Product {
  id: string
  name: string
  url: string
  defaultQty: number
  currentStock: number
}

interface InventoryItem extends Product {
  updatedStock: number
  hasChanged: boolean
}

interface StockUpdateDialogProps {
  item: InventoryItem | null
  isOpen: boolean
  onClose: () => void
  onUpdate: (productId: string, newStock: number) => void
}

function StockUpdateDialog({ item, isOpen, onClose, onUpdate }: StockUpdateDialogProps) {
  const [stock, setStock] = useState(0)

  useEffect(() => {
    if (item) {
      setStock(item.updatedStock)
    }
  }, [item])

  const handleIncrement = () => {
    setStock(prev => prev + 1)
  }

  const handleDecrement = () => {
    setStock(prev => Math.max(0, prev - 1))
  }

  const handleSave = () => {
    if (item) {
      onUpdate(item.id, stock)
      onClose()
    }
  }

  if (!item) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">{item.name}</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 py-6">
          <div className="text-center">
            <Label className="text-sm text-muted-foreground">現在の在庫数</Label>
            <div className="text-4xl font-bold mt-2">{stock}</div>
          </div>
          
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="lg"
              className="h-16 w-16 rounded-full"
              onClick={handleDecrement}
              disabled={stock <= 0}
            >
              <Minus className="h-8 w-8" />
            </Button>
            
            <div className="text-2xl font-semibold min-w-[60px] text-center">
              {stock}
            </div>
            
            <Button
              variant="outline"
              size="lg"
              className="h-16 w-16 rounded-full"
              onClick={handleIncrement}
            >
              <Plus className="h-8 w-8" />
            </Button>
          </div>

          {item.currentStock !== stock && (
            <div className="text-sm text-muted-foreground">
              元の在庫: {item.currentStock} → 新しい在庫: {stock}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave}>
            更新
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function InventoryCheckPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkerName, setCheckerName] = useState("")
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const router = useRouter()

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true)
        const response = await fetch("/api/products")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const products: Product[] = await response.json()
        
        // Initialize inventory items with current stock as default
        const items: InventoryItem[] = products.map(product => ({
          ...product,
          updatedStock: product.currentStock,
          hasChanged: false
        }))
        
        setInventoryItems(items)
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred'
        setError(errorMessage)
        console.error("Failed to fetch products:", e)
      } finally {
        setLoading(false)
      }
    }
    
    fetchProducts()
  }, [])

  const handleStockUpdate = (productId: string, newStock: number) => {
    setInventoryItems(prevItems =>
      prevItems.map(item =>
        item.id === productId
          ? {
              ...item,
              updatedStock: newStock,
              hasChanged: newStock !== item.currentStock
            }
          : item
      )
    )
  }

  const openStockDialog = (item: InventoryItem) => {
    setSelectedItem(item)
    setDialogOpen(true)
  }

  const handleSaveInventory = async () => {
    if (!checkerName.trim()) {
      alert("点検者名を入力してください")
      return
    }

    try {
      setSaving(true)
      
      const inventoryData = inventoryItems.map(item => ({
        productId: item.id,
        stockCount: item.updatedStock
      }))

      const response = await fetch("/api/inventory/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkerName: checkerName.trim(),
          inventoryData
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      // Show success message with auto-order info
      let message = "在庫点検が正常に保存されました。"
      if (result.autoOrdersCreated > 0) {
        message += `\n${result.autoOrdersCreated}件の自動発注を作成しました。`
      }
      
      alert(message)
      
      // Redirect back to inventory page
      router.push("/inventory")
      
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error("Failed to save inventory:", e)
      alert("在庫点検の保存に失敗しました: " + errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const getStockStatusColor = (item: InventoryItem): "default" | "secondary" | "destructive" => {
    if (item.updatedStock <= 2) return "destructive"
    if (item.updatedStock <= 5) return "secondary"
    return "default"
  }

  const getStockStatusText = (item: InventoryItem) => {
    if (item.updatedStock <= 2) return "要注文"
    if (item.updatedStock <= 5) return "少ない"
    return "正常"
  }

  const changedItemsCount = inventoryItems.filter(item => item.hasChanged).length

  if (loading) {
    return <div className="p-6 text-center text-lg font-medium">商品データを読み込み中...</div>
  }

  if (error) {
    return <div className="p-6 text-center text-lg text-destructive">エラー: {error}</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/inventory">
              <ArrowLeft className="w-4 h-4 mr-2" />
              戻る
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">在庫点検</h1>
            <p className="text-muted-foreground">各商品の在庫数を確認・更新してください</p>
          </div>
        </div>
      </div>

      {/* Checker Name Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">点検者情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="checker-name">点検者名 *</Label>
            <Input
              id="checker-name"
              placeholder="点検者の名前を入力"
              value={checkerName}
              onChange={(e) => setCheckerName(e.target.value)}
              className={!checkerName.trim() ? "border-red-200 focus:border-red-500" : ""}
            />
            {!checkerName.trim() && (
              <p className="text-sm text-red-600">点検者名の入力が必要です</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              総商品数: {inventoryItems.length}件 | 変更済み: {changedItemsCount}件
              {!checkerName.trim() && <span className="text-red-500 ml-2">（点検者名を入力してください）</span>}
            </div>
            <Button 
              onClick={handleSaveInventory}
              disabled={saving || !checkerName.trim()}
              variant={!checkerName.trim() ? "secondary" : "default"}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "保存中..." : "点検結果を保存"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Product Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {inventoryItems.map((item) => (
          <Card 
            key={item.id} 
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${
              item.hasChanged ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => openStockDialog(item)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base leading-tight">{item.name}</CardTitle>
                <Badge variant={getStockStatusColor(item)}>
                  {getStockStatusText(item)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current Stock Display */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">現在在庫</span>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold">{item.updatedStock}</span>
                  {item.hasChanged && (
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      変更済み
                    </div>
                  )}
                </div>
              </div>

              {/* Original vs Updated Stock */}
              {item.hasChanged && (
                <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                  元の在庫: {item.currentStock} → {item.updatedStock}
                </div>
              )}

              {/* Default Order Quantity */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">標準発注数</span>
                <span>{item.defaultQty}</span>
              </div>

              {/* Action Hint */}
              <div className="text-center pt-2">
                <span className="text-xs text-muted-foreground">タップして在庫数を更新</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stock Update Dialog */}
      <StockUpdateDialog
        item={selectedItem}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onUpdate={handleStockUpdate}
      />
    </div>
  )
}