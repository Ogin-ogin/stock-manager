interface InventoryRecord {
  id: string
  productId: string
  stockCount: number
  checkDate: string
  checkerName: string
}

interface Settings {
  id: string
  consumptionCalcDays: number
  reorderThresholdDays: number
  reminderDay: number
  reminderTime: string
  exportDay: number
  exportTime: string
  slackWebhookUrl: string
  systemName: string
  adminEmail: string
  graphPastDays: number 
  graphForecastDays: number 
}

export interface ConsumptionPattern {
  averageDailyConsumption: number
  consumptionVariability: number
  trendDirection: "increasing" | "decreasing" | "stable"
  confidence: number
}

// 消費パターン分析クラス
export class ConsumptionAnalyzer {
  private records: InventoryRecord[]
  private consumptionCalcDays: number

  constructor(records: InventoryRecord[], settings: Settings) {
    // checkDateでソートし、stockCountを数値に変換
    this.records = records
      .map((record) => ({
        ...record,
        stockCount: Number(record.stockCount), // 数値に変換
      }))
      .sort((a, b) => new Date(a.checkDate).getTime() - new Date(b.checkDate).getTime())
    
    // 設定から消費計算日数を取得（最小値を1に設定）
    this.consumptionCalcDays = Math.max(1, settings.consumptionCalcDays)
  }

  // 移動平均を使った消費量計算（windowSizeを設定から取得）
  private calculateMovingAverage(): number[] {
    if (this.records.length < 2) return []

    const dailyConsumptions: number[] = []

    for (let i = 1; i < this.records.length; i++) {
      const current = this.records[i]
      const previous = this.records[i - 1]

      const daysDiff = Math.max(
        1,
        Math.floor(
          (new Date(current.checkDate).getTime() - new Date(previous.checkDate).getTime()) / (1000 * 60 * 60 * 24),
        ),
      )

      const consumption = Math.max(0, (previous.stockCount - current.stockCount) / daysDiff)
      dailyConsumptions.push(consumption)
    }

    // 移動平均の計算（windowSizeを設定値から使用）
    const windowSize = this.consumptionCalcDays
    const movingAverages: number[] = []
    for (let i = 0; i < dailyConsumptions.length; i++) {
      const start = Math.max(0, i - windowSize + 1)
      const window = dailyConsumptions.slice(start, i + 1)
      const average = window.reduce((sum, val) => sum + val, 0) / window.length
      movingAverages.push(average)
    }

    return movingAverages
  }

  // 季節性・トレンド分析
  private analyzeTrend(): { direction: "increasing" | "decreasing" | "stable"; slope: number } {
    const movingAverages = this.calculateMovingAverage()
    if (movingAverages.length < 3) return { direction: "stable", slope: 0 }

    // 線形回帰でトレンドを計算
    const n = movingAverages.length
    const x = Array.from({ length: n }, (_, i) => i)
    const y = movingAverages

    const sumX = x.reduce((sum, val) => sum + val, 0)
    const sumY = y.reduce((sum, val) => sum + val, 0)
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0)
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0)

    // 分母が0になるのを防ぐ
    const denominator = n * sumX2 - sumX * sumX
    const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator

    let direction: "increasing" | "decreasing" | "stable" = "stable"
    if (Math.abs(slope) > 0.05) {
      // 閾値を設定
      direction = slope > 0 ? "increasing" : "decreasing"
    }

    return { direction, slope }
  }

  // 消費量の変動性を計算
  private calculateVariability(): number {
    const movingAverages = this.calculateMovingAverage()
    if (movingAverages.length < 2) return 0

    const mean = movingAverages.reduce((sum, val) => sum + val, 0) / movingAverages.length
    const variance = movingAverages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / movingAverages.length
    const standardDeviation = Math.sqrt(variance)

    return mean > 0 ? standardDeviation / mean : 0 // 変動係数
  }

  // 信頼度計算（データ点数と一貫性に基づく）
  private calculateConfidence(): number {
    const dataPoints = this.records.length
    const variability = this.calculateVariability()

    // データ点数による信頼度（最大0.7）
    const dataConfidence = Math.min(0.7, dataPoints / 10)

    // 一貫性による信頼度（最大0.3）
    const consistencyConfidence = Math.max(0, 0.3 - variability * 0.3)

    return dataConfidence + consistencyConfidence
  }

  // メイン分析メソッド
  analyze(): ConsumptionPattern {
    if (this.records.length < 2) {
      return {
        averageDailyConsumption: 0, // データ不足時は0に変更
        consumptionVariability: 0,
        trendDirection: "stable",
        confidence: 0,
      }
    }
    const movingAverages = this.calculateMovingAverage()
    const averageDailyConsumption = movingAverages.length > 0 ? movingAverages[movingAverages.length - 1] : 0 // 最新の移動平均、デフォルトは0
    const trend = this.analyzeTrend()
    const variability = this.calculateVariability()
    const confidence = this.calculateConfidence()
    return {
      averageDailyConsumption: Math.max(0, averageDailyConsumption), // 0以下にならないように、最低値は0
      consumptionVariability: variability,
      trendDirection: trend.direction,
      confidence,
    }
  }
}