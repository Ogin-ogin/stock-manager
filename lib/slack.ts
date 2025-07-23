interface SlackMessage {
  text?: string
  blocks?: any[]
  attachments?: any[]
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

export async function sendSlackNotification(message: SlackMessage, webhookUrl?: string) {
  const url = webhookUrl || process.env.SLACK_WEBHOOK_URL

  if (!url) {
    console.warn("Slack webhook URL not configured")
    return false
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      console.error(`Slack API error: ${response.status} ${response.statusText}`)
      return false
    }

    return true
  } catch (error) {
    console.error("Failed to send Slack notification:", error)
    return false
  }
}

export function createInventoryAlertMessage(lowStockItems: LowStockItem[]) {
  // 重要度でソート（critical > low > normal の順）
  const sortedItems = lowStockItems.sort((a, b) => {
    const statusOrder = { critical: 0, low: 1, normal: 2, high: 3 }
    return statusOrder[a.status as keyof typeof statusOrder] - statusOrder[b.status as keyof typeof statusOrder]
  })

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🚨 在庫不足アラート",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${lowStockItems.length}件の商品で在庫不足が発生しています：`,
      },
    },
  ]

  // 各商品の詳細情報を追加
  sortedItems.forEach((item) => {
    // ステータスに応じた絵文字とスタイル
    let statusEmoji = ""
    let urgencyText = ""
    
    switch (item.status) {
      case "critical":
        statusEmoji = "🔴"
        urgencyText = "*緊急*"
        break
      case "low":
        statusEmoji = "🟡"
        urgencyText = "*注意*"
        break
      default:
        statusEmoji = "🔵"
        urgencyText = "*確認*"
    }

    // リスクレベルをパーセンテージで表示
    const riskPercentage = Math.round(item.riskLevel * 100)

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${statusEmoji} ${urgencyText} *${item.name}*\n` +
              `├ 現在在庫: ${item.stock}個\n` +
              `├ 基本残り日数: ${item.remainingDays}日\n` +
              `├ 調整済み残り日数: ${item.adjustedRemainingDays}日\n` +
              `├ リスクレベル: ${riskPercentage}%\n` +
              `└ 推奨: ${item.recommendation}`,
      },
    })

    // 区切り線（最後のアイテム以外）
    if (sortedItems.indexOf(item) < sortedItems.length - 1) {
      blocks.push({
        type: "divider",
      })
    }
  })

  // 統計情報を追加
  const criticalCount = lowStockItems.filter(item => item.status === "critical").length
  const lowCount = lowStockItems.filter(item => item.status === "low").length
  
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `📊 *集計*: 緊急 ${criticalCount}件 | 注意 ${lowCount}件 | その他 ${lowStockItems.length - criticalCount - lowCount}件`,
      },
    ],
  })

  // アクションボタン
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "在庫管理画面を開く",
        },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/inventory`,
        style: "primary",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "発注管理画面を開く",
        },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/orders`,
        style: "secondary",
      },
    ],
  })

  return { blocks }
}

export function createOrderCompletedMessage(orders: any[]) {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📋 注文書出力完了",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${orders.length}件の注文を出力しました：`,
      },
    },
  ]

  orders.forEach((order) => {
    const orderTypeText = order.orderType === "AUTO" ? "自動発注" : "手動発注"
    const orderTypeEmoji = order.orderType === "AUTO" ? "🤖" : "👤"
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${orderTypeEmoji} *${order.product?.name || order.productId}*\n` +
              `├ 発注数量: ${order.orderQty}個\n` +
              `├ 発注種別: ${orderTypeText}\n` +
              `└ 理由: ${order.orderReason}`,
      },
    })
  })

  // 統計情報
  const autoOrderCount = orders.filter(order => order.orderType === "AUTO").length
  const manualOrderCount = orders.length - autoOrderCount

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `📊 *発注内訳*: 自動発注 ${autoOrderCount}件 | 手動発注 ${manualOrderCount}件`,
      },
    ],
  })

  return { blocks }
}

export function createInventoryReminderMessage() {
  return {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📅 在庫点検リマインダー",
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "定期在庫点検の時間です。在庫点検を実行してください。",
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `⏰ 通知時刻: ${new Date().toLocaleString('ja-JP')}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "在庫点検を開始",
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/inventory/check`,
            style: "primary",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "在庫状況を確認",
            },
            url: `${process.env.NEXT_PUBLIC_APP_URL}/inventory`,
            style: "secondary",
          },
        ],
      },
    ],
  }
}

export function createAutoOrderNotification(orders: any[], thresholdDays: number) {
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🤖 自動発注が実行されました",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `閾値${thresholdDays}日を下回った商品について、${orders.length}件の自動発注を実行しました：`,
      },
    },
  ]

  orders.forEach((order) => {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🎯 *${order.product?.name || order.productId}*\n` +
              `├ 発注数量: ${order.orderQty}個\n` +
              `└ 理由: ${order.orderReason}`,
      },
    })
  })

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `📝 発注内容は注文管理画面で確認・編集できます`,
      },
    ],
  })

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "発注内容を確認",
        },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/orders`,
        style: "primary",
      },
    ],
  })

  return { blocks }
}