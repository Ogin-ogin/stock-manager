import { type NextRequest, NextResponse } from "next/server"
import { productsAPI, inventoryAPI, ordersAPI, settingsAPI } from "@/lib/sheets"
import { sendSlackNotification, createInventoryAlertMessage } from "@/lib/slack"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { checkerName, inventoryData } = body

    if (!checkerName || !inventoryData || !Array.isArray(inventoryData)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
    }

    // 在庫記録を保存
    const records = await Promise.all(
      inventoryData.map((item: any) =>
        inventoryAPI.create({
          productId: item.productId,
          stockCount: Number.parseInt(item.stockCount),
          checkerName,
        }),
      ),
    )

    // 自動発注判定
    const settings = await settingsAPI.get()
    const thresholdDays = settings?.reorderThresholdDays || 30

    const lowStockItems = []
    const autoOrders = []

    const products = await productsAPI.getAll()

    for (const item of inventoryData) {
      const product = products.find((p) => p.id === item.productId)

      if (!product) continue

      const stockCount = Number.parseInt(item.stockCount)

      // 簡単な自動発注ロジック（在庫が2個以下の場合）
      if (stockCount <= 2) {
        lowStockItems.push({
          name: product.name,
          stock: stockCount,
          remainingDays: Math.floor(stockCount / 0.5), // 仮の消費量
        })

        // 自動発注を作成
        const order = await ordersAPI.create({
          productId: product.id,
          orderQty: product.defaultOrderQty,
          orderType: "AUTO",
          orderReason: "在庫不足による自動発注",
          ordererName: "システム",
          isExported: false,
        })

        autoOrders.push(order)
      }
    }

    // Slack通知を送信
    if (lowStockItems.length > 0) {
      const message = createInventoryAlertMessage(lowStockItems)
      await sendSlackNotification(message)
    }

    return NextResponse.json({
      success: true,
      recordsCreated: records.length,
      autoOrdersCreated: autoOrders.length,
      lowStockItems,
    })
  } catch (error) {
    console.error("Failed to process inventory check:", error)
    return NextResponse.json({ error: "Failed to process inventory check" }, { status: 500 })
  }
}
