import { type NextRequest, NextResponse } from "next/server"
import { ordersAPI, productsAPI } from "@/lib/sheets"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, orderQty, orderReason, ordererName } = body

    if (!productId || !orderQty || !orderReason || !ordererName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const order = await ordersAPI.create({
      productId,
      orderQty: Number.parseInt(orderQty),
      orderType: "MANUAL",
      orderReason,
      ordererName,
      isExported: false,
    })

    // 商品情報も含めて返す
    const products = await productsAPI.getAll()
    const product = products.find((p) => p.id === productId)

    return NextResponse.json({
      ...order,
      product,
    })
  } catch (error) {
    console.error("Failed to create manual order:", error)
    return NextResponse.json({ error: "Failed to create manual order" }, { status: 500 })
  }
}
