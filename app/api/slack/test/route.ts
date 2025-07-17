import { type NextRequest, NextResponse } from "next/server"
import { sendSlackNotification } from "@/lib/slack"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { webhookUrl } = body

    const testMessage = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🧪 テスト通知",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "消耗品管理システムからのテスト通知です。\nSlack連携が正常に動作しています！",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `送信時刻: ${new Date().toLocaleString("ja-JP")}`,
            },
          ],
        },
      ],
    }

    const success = await sendSlackNotification(testMessage, webhookUrl)

    if (success) {
      return NextResponse.json({ success: true, message: "Test notification sent successfully" })
    } else {
      return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 })
    }
  } catch (error) {
    console.error("Failed to send test notification:", error)
    return NextResponse.json({ error: "Failed to send test notification" }, { status: 500 })
  }
}
