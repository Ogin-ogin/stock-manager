"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShoppingCart, ExternalLink, Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Product {
  id: string
  name: string
  url: string
  defaultQty: number
  currentStock: number
  minStock?: number
  category?: string
  supplier?: string
  unitPrice?: number
  description?: string
}

interface OrderData {
  productId: string
  orderQty: number
  orderReason: string
  ordererName: string
}

export default function ManualOrderPage() {
  const { toast } = useToast()
  const [selectedProduct, setSelectedProduct] = useState("")
  const [orderQty, setOrderQty] = useState("")
  const [orderReason, setOrderReason] = useState("")
  const [ordererName, setOrdererName] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)


  // 本番用: APIから商品データを取得
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch("/api/products")
        if (!response.ok) {
          setError("商品データの取得に失敗しました")
          return
        }
        const data = await response.json()
        setProducts(data)
      } catch (error) {
        setError("商品データの取得中にエラーが発生しました")
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  const selectedProductData = products.find((p) => p.id === selectedProduct)
  
  // デバッグ用ログ削除（本番では不要）

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedProduct || !orderQty || !orderReason.trim() || !ordererName.trim()) {
      toast({
        title: "エラー",
        description: "すべての項目を入力してください。",
        variant: "destructive",
      })
      return
    }

    const orderQtyNum = Number.parseInt(orderQty)
    if (isNaN(orderQtyNum) || orderQtyNum <= 0) {
      toast({
        title: "エラー",
        description: "発注数量は1以上の数値を入力してください。",
        variant: "destructive",
      })
      return
    }

    setSubmitting(true)
    
    toast({
      title: "発注中",
      description: "手動発注を送信しています...",
    })

    try {
      const orderData: OrderData = {
        productId: selectedProduct,
        orderQty: orderQtyNum,
        orderReason: orderReason.trim(),
        ordererName: ordererName.trim(),
      }

      const response = await fetch("/api/orders/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const order = await response.json()

      toast({
        title: "発注完了",
        description: `${order.product?.name || selectedProductData?.name || "商品"} を ${order.orderQty}個 発注しました。`,
      })

      // Reset form
      setSelectedProduct("")
      setOrderQty("")
      setOrderReason("")
      setOrdererName("")

      // Refresh products data to update stock
      const refreshResponse = await fetch("/api/products")
      if (refreshResponse.ok) {
        const refreshedData = await refreshResponse.json()
        setProducts(refreshedData)
      }

    } catch (error) {
      console.error("Error creating manual order:", error)
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "手動発注の作成に失敗しました。",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const setDefaultQty = () => {
    if (selectedProductData) {
      setOrderQty(selectedProductData.defaultQty.toString())
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">手動発注</h1>
          <p className="text-muted-foreground">必要な消耗品を手動で発注します</p>
        </div>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>商品データを読み込み中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">手動発注</h1>
          <p className="text-muted-foreground">必要な消耗品を手動で発注します</p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">手動発注</h1>
        <p className="text-muted-foreground">必要な消耗品を手動で発注します</p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              発注情報入力
            </CardTitle>
            <CardDescription>発注する商品と数量、理由を入力してください</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Orderer Name */}
              <div>
                <Label htmlFor="orderer-name">発注者名 *</Label>
                <Input
                  id="orderer-name"
                  name="orderer-name"
                  placeholder="山田太郎"
                  value={ordererName}
                  onChange={(e) => setOrdererName(e.target.value)}
                  className="mt-1"
                  disabled={submitting}
                />
              </div>

              {/* Product Selection */}
              <div>
                <Label>商品選択 *</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={submitting}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="発注する商品を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{product.name}</span>
                          <div className="flex items-center gap-2 ml-2">
                            {product.minStock && product.currentStock <= product.minStock && (
                              <AlertCircle className="w-4 h-4 text-red-500" />
                            )}
                            <span className="text-sm text-muted-foreground">在庫: {product.currentStock}個</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* デバッグ情報表示を本番では非表示に */}
              
              {selectedProductData && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">現在在庫</span>
                        <div className="flex items-center gap-2">
                          {selectedProductData.minStock && selectedProductData.currentStock <= selectedProductData.minStock && (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="font-medium">{selectedProductData.currentStock}個</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">推奨発注数</span>
                        <span className="font-medium">{selectedProductData.defaultQty}個</span>
                      </div>
                      {selectedProductData.minStock && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">最小在庫数</span>
                          <span className="font-medium">{selectedProductData.minStock}個</span>
                        </div>
                      )}
                      {selectedProductData.category && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">カテゴリ</span>
                          <span className="font-medium">{selectedProductData.category}</span>
                        </div>
                      )}
                      {selectedProductData.supplier && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">供給元</span>
                          <span className="font-medium">{selectedProductData.supplier}</span>
                        </div>
                      )}
                      {selectedProductData.unitPrice && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">単価</span>
                          <span className="font-medium">¥{selectedProductData.unitPrice.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedProductData.description && (
                        <div className="pt-2 border-t">
                          <span className="text-sm text-muted-foreground">説明</span>
                          <p className="text-sm mt-1">{selectedProductData.description}</p>
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-sm text-muted-foreground">商品ページ</span>
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={selectedProductData.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            開く
                          </a>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Order Quantity */}
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="order-qty">発注数量 *</Label>
                  {selectedProductData && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={setDefaultQty}
                      disabled={submitting}
                    >
                      推奨数量を設定
                    </Button>
                  )}
                </div>
                <Input
                  id="order-qty"
                  name="order-qty"
                  type="number"
                  min="1"
                  placeholder="1"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  className="mt-1"
                  disabled={submitting}
                />
                {selectedProductData && selectedProductData.unitPrice && orderQty && (
                  <p className="text-sm text-muted-foreground mt-1">
                    予想費用: ¥{(selectedProductData.unitPrice * Number.parseInt(orderQty)).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Order Reason */}
              <div>
                <Label htmlFor="order-reason">発注理由 *</Label>
                <Textarea
                  id="order-reason"
                  name="order-reason"
                  placeholder="例: 在庫不足のため、実験で大量使用予定のため、など"
                  value={orderReason}
                  onChange={(e) => setOrderReason(e.target.value)}
                  className="mt-1"
                  rows={3}
                  disabled={submitting}
                />
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    発注中...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    発注を実行
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
