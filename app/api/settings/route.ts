import { type NextRequest, NextResponse } from "next/server"
import { settingsAPI } from "@/lib/sheets"

// このルートが常に動的にレンダリングされるように設定
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    let settings = await settingsAPI.get()

    if (!settings) {
      // デフォルト設定を作成
      settings = await settingsAPI.createOrUpdate({
        consumptionCalcDays: 7,
        reorderThresholdDays: 30,
        reminderDay: 5,
        reminderTime: "09:00",
        exportDay: 1,
        exportTime: "10:00",
        slackWebhookUrl: "",
        systemName: "触媒研究室 消耗品注文管理システム",
        adminEmail: "",
        graphPastDays: 30, // デフォルト値を追加
        graphForecastDays: 7, // デフォルト値を追加
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error("Failed to fetch settings:", error)
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    // バリデーション
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    // 数値フィールドの検証と変換
    const numericFields = [
      "consumptionCalcDays",
      "reorderThresholdDays",
      "reminderDay",
      "exportDay",
      "graphPastDays", // 追加
      "graphForecastDays", // 追加
    ]
    const processedBody = { ...body }

    for (const field of numericFields) {
      if (processedBody[field] !== undefined) {
        const value = Number(processedBody[field])
        if (isNaN(value)) {
          return NextResponse.json({ error: `Invalid value for ${field}` }, { status: 400 })
        }
        processedBody[field] = value
      }
    }

    const settings = await settingsAPI.createOrUpdate(processedBody)
    return NextResponse.json(settings)
  } catch (error) {
    console.error("Failed to update settings:", error)

    // より詳細なエラー情報を返す
    let errorMessage = "Failed to update settings"
    if (error instanceof Error) {
      errorMessage = error.message
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
