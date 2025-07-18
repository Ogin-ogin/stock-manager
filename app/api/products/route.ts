import { type NextRequest, NextResponse } from "next/server"
import { productsAPI } from "@/lib/sheets"

export async function GET() {
  try {
    const products = await productsAPI.getAll()
    
    // InventoryRecordsから最新在庫を取得
    const { inventoryAPI } = await import("@/lib/sheets")
    const formattedProducts = await Promise.all(
      products
        .filter((p) => p.isActive)
        .map(async (product) => {
          const records = await inventoryAPI.getByProductId(product.id)
          const currentStock = records.length > 0 ? Number(records[0].stockCount) : 0
          return {
            id: product.id,
            name: product.name,
            url: product.url,
            defaultQty: Number(product.defaultOrderQty) || 0,
            currentStock,
          }
        })
    )
    
    return NextResponse.json(formattedProducts)
  } catch (error) {
    console.error("Failed to fetch products:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, url, defaultOrderQty } = body

    if (!name || !url || !defaultOrderQty) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const product = await productsAPI.create({
      name,
      url,
      defaultOrderQty: Number.parseInt(defaultOrderQty),
      isActive: true,
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error("Failed to create product:", error)
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 })
  }
}
