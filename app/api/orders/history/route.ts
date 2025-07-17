import { type NextRequest, NextResponse } from "next/server"
import { ordersAPI, productsAPI } from "@/lib/sheets"

// このルートが常に動的にレンダリングされるように設定
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const status = searchParams.get("status")

    let orders = await ordersAPI.getAll()
    const products = await productsAPI.getAll()

    // フィルタリング
    if (type && type !== "all") {
      orders = orders.filter((o) => o.orderType === type.toUpperCase())
    }

    if (status && status !== "all") {
      orders = orders.filter((o) => o.isExported === (status === "exported"))
    }

    // 商品情報を含めて返す
    const ordersWithProducts = orders
      .map((order) => ({
        ...order,
        product: products.find((p) => p.id === order.productId),
      }))
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())

    return NextResponse.json(ordersWithProducts)
  } catch (error) {
    console.error("Failed to fetch order history:", error)
    return NextResponse.json({ error: "Failed to fetch order history" }, { status: 500 })
  }
}
