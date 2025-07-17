"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Edit, Trash2, ExternalLink, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Product {
  id: string
  name: string
  url: string
  defaultOrderQty: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function ProductsPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    defaultOrderQty: "",
  })

  // Mock products data
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    async function fetchProducts() {
      try {
        const response = await fetch("/api/products")
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data: Product[] = await response.json()
        setProducts(data)
      } catch (e: any) {
        console.error("Failed to fetch products data:", e)
        toast({
          title: "エラー",
          description: "商品データの読み込みに失敗しました。",
          variant: "destructive",
        })
      }
    }
    fetchProducts()
  }, [toast])

  const filteredProducts = products.filter((product) => product.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const resetForm = () => {
    setFormData({ name: "", url: "", defaultOrderQty: "" })
    setEditingProduct(null)
  }

  const handleAdd = () => {
    setIsAddDialogOpen(true)
    resetForm()
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      url: product.url,
      defaultOrderQty: product.defaultOrderQty.toString(),
    })
    setIsAddDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.url.trim() || !formData.defaultOrderQty.trim()) {
      toast({
        title: "エラー",
        description: "すべての項目を入力してください。",
        variant: "destructive",
      })
      return
    }

    const qty = Number.parseInt(formData.defaultOrderQty)
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: "エラー",
        description: "推奨発注数は正の整数を入力してください。",
        variant: "destructive",
      })
      return
    }

    try {
      let response
      if (editingProduct) {
        // Update existing product
        response = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            url: formData.url,
            defaultOrderQty: qty,
            isActive: editingProduct.isActive, // 既存の状態を維持
          }),
        })
        if (!response.ok) throw new Error("Failed to update product")
        toast({
          title: "更新完了",
          description: "商品情報を更新しました。",
        })
      } else {
        // Add new product
        response = await fetch("/api/products", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: formData.name,
            url: formData.url,
            defaultOrderQty: qty,
          }),
        })
        if (!response.ok) throw new Error("Failed to add product")
        toast({
          title: "追加完了",
          description: "新しい商品を追加しました。",
        })
      }

      // 成功したら商品を再フェッチしてリストを更新
      const updatedProducts: Product[] = await (await fetch("/api/products")).json()
      setProducts(updatedProducts)

      setIsAddDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error("Error saving product:", error)
      toast({
        title: "エラー",
        description: `商品の${editingProduct ? "更新" : "追加"}に失敗しました。`,
        variant: "destructive",
      })
    }
  }

  const handleDelete = async (product: Product) => {
    if (confirm(`「${product.name}」を削除しますか？`)) {
      try {
        const response = await fetch(`/api/products/${product.id}`, {
          method: "DELETE",
        })

        if (!response.ok) {
          throw new Error("Failed to delete product")
        }

        setProducts((prev) => prev.filter((p) => p.id !== product.id))
        toast({
          title: "削除完了",
          description: "商品を削除しました。",
        })
      } catch (error) {
        console.error("Error deleting product:", error)
        toast({
          title: "エラー",
          description: "商品の削除に失敗しました。",
          variant: "destructive",
        })
      }
    }
  }

  const toggleActive = async (product: Product) => {
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...product,
          isActive: !product.isActive,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to toggle product status")
      }

      const updatedProduct = await response.json()
      setProducts((prev) => prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)))
      toast({
        title: "更新完了",
        description: `商品を${updatedProduct.isActive ? "有効" : "無効"}にしました。`,
      })
    } catch (error) {
      console.error("Error toggling product status:", error)
      toast({
        title: "エラー",
        description: "商品の状態更新に失敗しました。",
        variant: "destructive",
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ja-JP")
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">商品管理</h1>
          <p className="text-muted-foreground">消耗品の商品マスタ管理</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          商品追加
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">総商品数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">有効商品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{products.filter((p) => p.isActive).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">無効商品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">{products.filter((p) => !p.isActive).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">検索</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="商品名で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>商品一覧</CardTitle>
          <CardDescription>{filteredProducts.length}件の商品が表示されています</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名</TableHead>
                  <TableHead>推奨発注数</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead>商品ページ</TableHead>
                  <TableHead>更新日</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.defaultOrderQty}個</TableCell>
                    <TableCell>
                      <Badge variant={product.isActive ? "default" : "secondary"}>
                        {product.isActive ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={product.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          開く
                        </a>
                      </Button>
                    </TableCell>
                    <TableCell>{formatDate(product.updatedAt)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(product)}>
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => toggleActive(product)}>
                          {product.isActive ? "無効化" : "有効化"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(product)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>条件に一致する商品がありません。</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "商品編集" : "商品追加"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "商品情報を編集します。" : "新しい商品を追加します。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="product-name">商品名 *</Label>
              <Input
                id="product-name"
                placeholder="プロワイプ（250枚入り）"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="product-url">商品URL *</Label>
              <Input
                id="product-url"
                placeholder="https://..."
                value={formData.url}
                onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="default-qty">推奨発注数 *</Label>
              <Input
                id="default-qty"
                type="number"
                min="1"
                placeholder="5"
                value={formData.defaultOrderQty}
                onChange={(e) => setFormData((prev) => ({ ...prev, defaultOrderQty: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>{editingProduct ? "更新" : "追加"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
