import { type NextRequest, NextResponse } from "next/server"
import { productsAPI, inventoryAPI, ordersAPI, settingsAPI } from "@/lib/sheets"
import { sendSlackNotification, createInventoryAlertMessage } from "@/lib/slack"
import { ConsumptionAnalyzer, type ConsumptionPattern } from "@/lib/consumption-analyzer"

// 安全在庫計算クラス（route.tsから移植）
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

// 在庫状態評価クラス（route.tsから移植）
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
    const stockRatio = safetyStock > 0 ? currentStock / safetyStock : currentStock > 0 ? 1 : 0
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

interface InventoryItem {
  productId: string
  stockCount: number
}

interface LowStockItem {
  name: string
  stock: number
  remainingDays: number
  adjustedRemainingDays: number
  status: string
  riskLevel: number
  recommendation: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { checkerName, inventoryData } = body

    if (!checkerName || !inventoryData || !Array.isArray(inventoryData)) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 })
    }

    console.log("Received inventory data:", inventoryData)

    // 設定を取得
    const settings = await settingsAPI.get()
    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 500 })
    }

    const thresholdDays = settings.reorderThresholdDays || 30

    // 在庫記録を保存
    const records = []
    for (const item of inventoryData) {
      console.log(`Processing item:`, item)
      
      const record = await inventoryAPI.create({
        productId: item.productId,
        stockCount: item.stockCount,
        checkerName,
      })
      
      console.log(`Created record for productId ${item.productId}:`, record)
      records.push(record)
    }

    // 商品情報を取得
    const products = await productsAPI.getAll()
    const activeProducts = products.filter((p) => p.isActive)

    const lowStockItems: LowStockItem[] = []
    const autoOrders = []

    // 各商品の在庫状況を詳細に分析
    for (const item of inventoryData) {
      const product = activeProducts.find((p) => p.id === item.productId)

      if (!product) {
        console.warn(`Product not found for productId: ${item.productId}`)
        continue
      }

      try {
        // その商品の履歴データを取得
        const historicalRecords = await inventoryAPI.getByProductId(product.id)

        if (historicalRecords.length === 0) {
          console.warn(`No historical data for product: ${product.name}`)
          continue
        }

        // 消費パターン分析
        const analyzer = new ConsumptionAnalyzer(historicalRecords, settings)
        const consumptionPattern = analyzer.analyze()

        // 安全在庫計算
        const safetyStock = SafetyStockCalculator.calculate(consumptionPattern)

        // 在庫状態評価
        const evaluation = InventoryStatusEvaluator.evaluate(
          item.stockCount,
          consumptionPattern,
          safetyStock
        )

        console.log(`Analysis for ${product.name}:`, {
          currentStock: item.stockCount,
          adjustedRemainingDays: evaluation.adjustedRemainingDays,
          status: evaluation.status,
          threshold: thresholdDays
        })

        // 閾値を下回った場合の処理
        if (evaluation.adjustedRemainingDays <= thresholdDays || evaluation.status === "critical") {
          const lowStockItem: LowStockItem = {
            name: product.name,
            stock: item.stockCount,
            remainingDays: evaluation.remainingDays,
            adjustedRemainingDays: evaluation.adjustedRemainingDays,
            status: evaluation.status,
            riskLevel: evaluation.riskLevel,
            recommendation: evaluation.recommendation,
          }

          lowStockItems.push(lowStockItem)

          // 自動発注の作成
          let orderReason = ""
          if (evaluation.status === "critical") {
            orderReason = `緊急発注 - 残り${evaluation.adjustedRemainingDays}日分（調整済み）`
          } else {
            orderReason = `閾値${thresholdDays}日を下回る - 残り${evaluation.adjustedRemainingDays}日分（調整済み）`
          }

          const order = await ordersAPI.create({
            productId: product.id,
            orderQty: product.defaultOrderQty,
            orderType: "AUTO",
            orderReason,
            ordererName: "システム自動発注",
            isExported: false,
          })

          autoOrders.push(order)

          console.log(`Auto order created for ${product.name}: ${orderReason}`)
        }

      } catch (analysisError) {
        console.error(`Failed to analyze product ${product.name}:`, analysisError)
        
        // 分析に失敗した場合は簡易的な判定にフォールバック
        if (item.stockCount <= 2) {
          const lowStockItem: LowStockItem = {
            name: product.name,
            stock: item.stockCount,
            remainingDays: Math.floor(item.stockCount / 0.5), // 仮の消費量
            adjustedRemainingDays: Math.floor(item.stockCount / 0.5),
            status: "critical",
            riskLevel: 1,
            recommendation: "データ不足のため簡易判定による発注",
          }

          lowStockItems.push(lowStockItem)

          const order = await ordersAPI.create({
            productId: product.id,
            orderQty: product.defaultOrderQty,
            orderType: "AUTO",
            orderReason: "データ不足のため簡易判定による自動発注",
            ordererName: "システム自動発注（簡易）",
            isExported: false,
          })

          autoOrders.push(order)
        }
      }
    }

    // Slack通知を送信（改良版メッセージ）
    if (lowStockItems.length > 0) {
      const message = createInventoryAlertMessage(lowStockItems)
      try {
        const notificationSent = await sendSlackNotification(message, settings.slackWebhookUrl)
        if (!notificationSent) {
          console.warn("Failed to send Slack notification")
        }
      } catch (notificationError) {
        console.error("Error sending Slack notification:", notificationError)
      }
    }

    console.log(`Successfully processed ${records.length} records and created ${autoOrders.length} auto orders`)

    return NextResponse.json({
      success: true,
      recordsCreated: records.length,
      autoOrdersCreated: autoOrders.length,
      lowStockItems: lowStockItems.map(item => ({
        name: item.name,
        stock: item.stock,
        remainingDays: item.remainingDays,
        adjustedRemainingDays: item.adjustedRemainingDays,
        status: item.status,
        recommendation: item.recommendation
      })),
      settings: {
        thresholdDays,
        consumptionCalcDays: settings.consumptionCalcDays
      }
    })
  } catch (error) {
    console.error("Failed to process inventory check:", error)
    return NextResponse.json({ 
      error: "Failed to process inventory check",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}