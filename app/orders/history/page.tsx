"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, FileText, Search, ChevronDown, Calendar, Loader2, FileSpreadsheet } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function OrderHistoryPage() {
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [isExporting, setIsExporting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [orderHistory, setOrderHistory] = useState([])
  
  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [includeExported, setIncludeExported] = useState(false)
  const [exportStartDate, setExportStartDate] = useState('')

  // データを取得（サーバーサイドで商品情報も結合済み）
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/orders/history')

        if (!response.ok) {
          throw new Error('Failed to fetch data')
        }

        const data = await response.json()
        setOrderHistory(data)
      } catch (error) {
        console.error('Error fetching data:', error)
        toast({
          title: "エラー",
          description: "データの取得に失敗しました。",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [toast])

  // フィルタリング処理
  const filteredOrders = orderHistory.filter((order) => {
    const productName = order.product?.name || ''
    const matchesSearch =
      productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.ordererName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === "all" || order.orderType === filterType
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "exported" && order.isExported) ||
      (filterStatus === "pending" && !order.isExported)

    return matchesSearch && matchesType && matchesStatus
  })

  // デフォルトの開始日を設定（1ヶ月前）
  useEffect(() => {
    const oneMonthAgo = new Date()
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    setExportStartDate(oneMonthAgo.toISOString().split('T')[0])
  }, [])

  // ファイルダウンロード処理
  const downloadFile = (blob, filename) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleExportOrders = async () => {
    setIsExporting(true)
    setExportDialogOpen(false)
    
    toast({
      title: "Excel出力中",
      description: "注文をExcel形式で出力しています...",
    })

    try {
      const requestBody = {
        includeExported: includeExported
      }

      // 出力済みを含める場合は開始日を追加
      if (includeExported && exportStartDate) {
        requestBody.startDate = exportStartDate
      }

      const response = await fetch("/api/orders/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      // ファイルをダウンロード
      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `orders_${new Date().toISOString().split('T')[0]}.xlsx`

      downloadFile(blob, filename)

      toast({
        title: "出力完了",
        description: "注文書（Excel形式）をダウンロードしました。Slackにも送信されました。",
      })

      // データを再取得して最新の状態に更新
      const ordersResponse = await fetch('/api/orders/history')
      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json()
        setOrderHistory(ordersData)
      }

    } catch (error) {
      console.error("Error exporting orders:", error)
      toast({
        title: "エラー",
        description: error.message || "注文書の出力に失敗しました。",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getTypeColor = (type) => {
    return type === "AUTO" ? "default" : "secondary"
  }

  const getStatusColor = (isExported) => {
    return isExported ? "default" : "destructive"
  }

  const pendingOrdersCount = orderHistory.filter((o) => !o.isExported).length
  const autoOrdersCount = orderHistory.filter((o) => o.orderType === "AUTO").length
  const manualOrdersCount = orderHistory.filter((o) => o.orderType === "MANUAL").length

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">データを読み込み中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">注文履歴</h1>
          <p className="text-muted-foreground">過去の発注履歴とExcel注文書出力</p>
        </div>
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  出力中...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Excel出力
                  <ChevronDown className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Excel注文書出力設定</DialogTitle>
              <DialogDescription>
                対象範囲を選択してください。ファイルはダウンロードされ、同時にSlackにも送信されます。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">
                  対象範囲
                </Label>
                <div className="col-span-3 space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="include-exported"
                      checked={includeExported}
                      onCheckedChange={setIncludeExported}
                    />
                    <Label htmlFor="include-exported" className="text-sm">
                      出力済みの注文も含める
                    </Label>
                  </div>
                  {includeExported && (
                    <div className="ml-6 space-y-2">
                      <Label htmlFor="start-date" className="text-sm">
                        開始日（この日以降の注文を含める）
                      </Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-sm text-muted-foreground">
                  対象件数
                </Label>
                <div className="col-span-3 text-sm">
                  {includeExported 
                    ? `${exportStartDate ? orderHistory.filter(o => 
                        new Date(o.orderDate) >= new Date(exportStartDate)
                      ).length : orderHistory.length}件`
                    : `${pendingOrdersCount}件（未出力のみ）`
                  }
                </div>
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right text-sm text-muted-foreground pt-2">
                  送信先
                </Label>
                <div className="col-span-3 text-sm space-y-1">
                  <div className="flex items-center space-x-2">
                    <Download className="w-4 h-4" />
                    <span>ダウンロード（ブラウザ）</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span>Slack（自動送信）</span>
                  </div>
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span>Google Drive（可能な場合）</span>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleExportOrders}
                disabled={isExporting || (includeExported && !exportStartDate)}
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Excel出力開始
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">総注文数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderHistory.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">未出力注文</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {pendingOrdersCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">自動発注</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{autoOrdersCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">手動発注</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{manualOrdersCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">フィルター・検索</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="商品名または発注者名で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="発注タイプ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="AUTO">自動発注</SelectItem>
                <SelectItem value="MANUAL">手動発注</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="出力状況" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="pending">未出力</SelectItem>
                <SelectItem value="exported">出力済み</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Order History Table */}
      <Card>
        <CardHeader>
          <CardTitle>注文履歴一覧</CardTitle>
          <CardDescription>{filteredOrders.length}件の注文が表示されています</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名</TableHead>
                  <TableHead>数量</TableHead>
                  <TableHead>タイプ</TableHead>
                  <TableHead>発注者</TableHead>
                  <TableHead>発注日時</TableHead>
                  <TableHead>状況</TableHead>
                  <TableHead>理由</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      {order.product?.name || '商品情報なし'}
                    </TableCell>
                    <TableCell>{order.orderQty}個</TableCell>
                    <TableCell>
                      <Badge variant={getTypeColor(order.orderType)}>
                        {order.orderType === "AUTO" ? "自動" : "手動"}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.ordererName}</TableCell>
                    <TableCell>{formatDate(order.orderDate)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(order.isExported)}>
                        {order.isExported ? "出力済み" : "未出力"}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={order.orderReason}>
                      {order.orderReason}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>条件に一致する注文履歴がありません。</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}