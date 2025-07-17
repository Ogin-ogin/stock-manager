import { type NextRequest, NextResponse } from "next/server"
import { productsAPI } from "@/lib/sheets"

export async function GET() {
  try {
    const products = await productsAPI.getAll()
    
    // フロントエンドが期待する形式に変換
    const formattedProducts = products
      .filter((p) => p.isActive)
      .map((product) => ({
        id: product.id,
        name: product.name,
        url: product.url,
        defaultQty: Number(product.defaultOrderQty) || 0,  // defaultOrderQty -> defaultQty に変換し、数値化
        currentStock: product.currentStock || 0,           // currentStock フィールドを追加（デフォルト値0）
        minStock: product.minStock || undefined,           // 任意フィールド
        category: product.category || undefined,           // 任意フィールド
        supplier: product.supplier || undefined,           // 任意フィールド
        unitPrice: product.unitPrice || undefined,         // 任意フィールド
        description: product.description || undefined,     // 任意フィールド
      }))
    
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
