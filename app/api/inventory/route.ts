import { NextResponse } from "next/server"
import { productsAPI, inventoryAPI } from "@/lib/sheets"
import { ConsumptionAnalyzer, type ConsumptionPattern } from "@/lib/consumption-analyzer"

export const dynamic = "force-dynamic"

interface InventoryRecord {
  id: string
  productId: string
  stockCount: number
  checkDate: string
  checkerName: string // checkerNameも追加
}

// 安全在庫計算クラス
class SafetyStockCalculator {
  static calculate(pattern: ConsumptionPattern, leadTimeDays = 7): number {
    const { averageDailyConsumption, consumptionVariability, confidence } = pattern

    // 基本安全在庫（平均消費量 × リードタイム）
    const basicSafetyStock = averageDailyConsumption * leadTimeDays

    // 変動性に基づく追加安全在庫
    const variabilityBuffer = basicSafetyStock * consumptionVariability * 2

    // 信頼度が低い場合の追加バッファ
    const confidenceBuffer = basicSafetyStock * (1 - confidence) * 0.5

    return basicSafetyStock + variabilityBuffer + confidenceBuffer
  }
}

// 在庫状態評価クラス
class InventoryStatusEvaluator {
  static evaluate(
    currentStock: number,
    pattern: ConsumptionPattern,
    safetyStock: number,
  ): {
    remainingDays: number
    adjustedRemainingDays: number
    status: string
    riskLevel: number
    recommendation: string
  } {
    const { averageDailyConsumption, trendDirection, confidence } = pattern

    // 基本残り日数
    const basicRemainingDays = Math.floor(currentStock / averageDailyConsumption)

    // トレンドを考慮した調整
    let trendAdjustment = 1
    if (trendDirection === "increasing") {
      trendAdjustment = 0.8 // 消費増加傾向なら20%短く見積もる
    } else if (trendDirection === "decreasing") {
      trendAdjustment = 1.2 // 消費減少傾向なら20%長く見積もる
    }

    const adjustedRemainingDays = Math.floor(basicRemainingDays * trendAdjustment)

    // リスクレベル計算（0-1）
    const stockRatio = safetyStock > 0 ? currentStock / safetyStock : currentStock > 0 ? 1 : 0 // safetyStockが0の場合の考慮
    const riskLevel = Math.max(0, Math.min(1, 1 - stockRatio))

    // ステータス決定
    let status: string
    let recommendation: string

    if (currentStock <= safetyStock * 0.5) {
      status = "critical"
      recommendation = "緊急発注が必要です"
    } else if (currentStock <= safetyStock) {
      status = "low"
      recommendation = "発注を検討してください"
    } else if (currentStock <= safetyStock * 2) {
      status = "normal"
      recommendation = "在庫レベルは適正です"
    } else {
      status = "high"
      recommendation = "在庫過多の可能性があります"
    }

    // 信頼度が低い場合の警告
    if (confidence < 0.3) {
      recommendation += "（データ不足のため要注意）"
    }

    return {
      remainingDays: basicRemainingDays,
      adjustedRemainingDays,
      status,
      riskLevel,
      recommendation,
    }
  }
}

export async function GET() {
  try {
    const products = await productsAPI.getAll()
    const activeProducts = products.filter((p) => p.isActive)

    const inventoryData = await Promise.all(
      activeProducts.map(async (product) => {
        const records = await inventoryAPI.getByProductId(product.id)

        if (records.length === 0) {
          return {
            id: product.id,
            name: product.name,
            url: product.url,
            currentStock: 0,
            lastCheckDate: new Date().toISOString(),
            consumptionPattern: {
              averageDailyConsumption: 0.1,
              consumptionVariability: 0,
              trendDirection: "stable",
              confidence: 0,
            },
            safetyStock: 0,
            remainingDays: 0,
            adjustedRemainingDays: 0,
            status: "critical",
            riskLevel: 1,
            recommendation: "在庫データがありません",
          }
        }

        const currentStock = Number.parseInt(records[0].stockCount.toString())
        const lastCheckDate = records[0].checkDate

        // 消費パターン分析
        const analyzer = new ConsumptionAnalyzer(records)
        const consumptionPattern = analyzer.analyze()

        // 安全在庫計算
        const safetyStock = SafetyStockCalculator.calculate(consumptionPattern)

        // 在庫状態評価
        const evaluation = InventoryStatusEvaluator.evaluate(currentStock, consumptionPattern, safetyStock)

        return {
          id: product.id,
          name: product.name,
          url: product.url,
          currentStock,
          lastCheckDate,
          consumptionPattern: {
            averageDailyConsumption: Math.round(consumptionPattern.averageDailyConsumption * 100) / 100,
            consumptionVariability: Math.round(consumptionPattern.consumptionVariability * 100) / 100,
            trendDirection: consumptionPattern.trendDirection,
            confidence: Math.round(consumptionPattern.confidence * 100) / 100,
          },
          safetyStock: Math.round(safetyStock * 10) / 10,
          remainingDays: evaluation.remainingDays,
          adjustedRemainingDays: evaluation.adjustedRemainingDays,
          status: evaluation.status,
          riskLevel: Math.round(evaluation.riskLevel * 100) / 100,
          recommendation: evaluation.recommendation,
        }
      }),
    )

    return NextResponse.json(inventoryData)
  } catch (error: any) {
    console.error("Failed to fetch inventory:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch inventory",
        details: error.message,
      },
      { status: 500 },
    )
  }
}
