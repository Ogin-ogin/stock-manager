import { type NextRequest, NextResponse } from "next/server"
import { inventoryAPI, productsAPI, settingsAPI } from "@/lib/sheets"
import { ConsumptionAnalyzer } from "@/lib/consumption-analyzer"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pastDays = Number.parseInt(searchParams.get("pastDays") || "30") // 過去データの表示期間
    const forecastDays = Number.parseInt(searchParams.get("forecastDays") || "7") // 予測データの表示期間

    // 設定を取得
    const settings = await settingsAPI.get()
    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 500 })
    }

    const historicalRecords = await inventoryAPI.getHistory(pastDays)
    const products = await productsAPI.getAll()

    // 日付ごとの在庫データを集計
    const dailyDataMap = new Map<string, { [key: string]: any }>()

    // 過去pastDays日間の日付を生成し、マップを初期化
    for (let i = pastDays - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateString = date.toISOString().split("T")[0] // YYYY-MM-DD
      dailyDataMap.set(dateString, { date: dateString })
    }

    // 各商品の最新の在庫数を日付ごとに記録
    const sortedRecords = historicalRecords.sort(
      (a, b) => new Date(a.checkDate).getTime() - new Date(b.checkDate).getTime(),
    )

    const latestStockPerProduct: { [productId: string]: number } = {}

    for (let i = 0; i < sortedRecords.length; i++) {
      const record = sortedRecords[i]
      const dateString = new Date(record.checkDate).toISOString().split("T")[0]
      const productId = record.productId
      const stockCount = Number.parseInt(record.stockCount.toString())

      latestStockPerProduct[productId] = stockCount

      if (dailyDataMap.has(dateString)) {
        const currentDayData = dailyDataMap.get(dateString)!
        currentDayData[productId] = stockCount
        dailyDataMap.set(dateString, currentDayData)
      }
    }

    // 欠損している日付のデータを補完（前の日の在庫数を引き継ぐ）
    const dates = Array.from(dailyDataMap.keys()).sort()
    const interpolatedData: { [key: string]: any }[] = []

    const currentStocksForInterpolation: { [productId: string]: number } = {}
    for (const product of products) {
      currentStocksForInterpolation[product.id] = latestStockPerProduct[product.id] || 0
    }

    for (const dateString of dates) {
      const currentDayData = dailyDataMap.get(dateString)!
      const mergedDayData: { [key: string]: any } = { date: dateString }

      for (const product of products) {
        const productId = product.id
        if (currentDayData[productId] !== undefined) {
          mergedDayData[product.name] = currentDayData[productId]
          currentStocksForInterpolation[productId] = currentDayData[productId]
        } else {
          mergedDayData[product.name] = currentStocksForInterpolation[productId]
        }
      }
      interpolatedData.push(mergedDayData)
    }

    // 将来の予測データを生成（高度な計算ロジックを使用）
    const forecastData: { [key: string]: any }[] = []
    const lastHistoricalData = interpolatedData[interpolatedData.length - 1] || {}
    const lastDate = new Date(lastHistoricalData.date || new Date().toISOString().split("T")[0])

    const currentForecastStocks: { [productId: string]: number } = {}
    const productConsumptionPatterns: { [productId: string]: any } = {}

    // 各商品の消費パターンを分析
    for (const product of products) {
      currentForecastStocks[product.id] = lastHistoricalData[product.name] || 0

      // その商品の全在庫履歴を取得してConsumptionAnalyzerで分析
      const productRecords = await inventoryAPI.getByProductId(product.id)
      const analyzer = new ConsumptionAnalyzer(productRecords, settings) // 設定を渡す
      const consumptionPattern = analyzer.analyze()
      productConsumptionPatterns[product.id] = consumptionPattern
    }

    for (let i = 1; i <= forecastDays; i++) {
      const forecastDate = new Date(lastDate)
      forecastDate.setDate(lastDate.getDate() + i)
      const forecastDateString = forecastDate.toISOString().split("T")[0]
      const forecastDayData: { [key: string]: any } = { date: forecastDateString }

      for (const product of products) {
        const productId = product.id
        const consumptionPattern = productConsumptionPatterns[productId]

        // 高度な計算ロジックから得られた平均日次消費量を使用
        const averageConsumption = consumptionPattern.averageDailyConsumption

        // トレンドを考慮した消費量調整
        let adjustedConsumption = averageConsumption
        if (consumptionPattern.trendDirection === "increasing") {
          adjustedConsumption = averageConsumption * 1.1 // 消費増加傾向なら10%増
        } else if (consumptionPattern.trendDirection === "decreasing") {
          adjustedConsumption = averageConsumption * 0.9 // 消費減少傾向なら10%減
        }

        // 予測在庫 = 前日の予測在庫 - 調整された消費量
        currentForecastStocks[productId] = Math.max(0, currentForecastStocks[productId] - adjustedConsumption)
        forecastDayData[product.name] = Math.round(currentForecastStocks[productId]) // 整数に丸める
      }
      forecastData.push(forecastDayData)
    }

    // 過去データと予測データを結合
    const combinedData = [...interpolatedData, ...forecastData]

    // グラフ表示点を最大10点に制限するロジック
    const MAX_DATA_POINTS = 10
    let finalData = combinedData

    if (combinedData.length > MAX_DATA_POINTS) {
      const step = Math.ceil(combinedData.length / MAX_DATA_POINTS)
      finalData = []
      for (let i = 0; i < combinedData.length; i += step) {
        finalData.push(combinedData[i])
      }
      // 最後のデータポイントがスキップされるのを防ぐ
      if (finalData[finalData.length - 1] !== combinedData[combinedData.length - 1]) {
        finalData.push(combinedData[combinedData.length - 1])
      }
    }

    return NextResponse.json(finalData)
  } catch (error) {
    console.error("Failed to fetch inventory history:", error)
    return NextResponse.json({ error: "Failed to fetch inventory history" }, { status: 500 })
  }
}