interface SlackMessage {
  text?: string
  blocks?: any[]
  attachments?: any[]
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

    return response.ok
  } catch (error) {
    console.error("Failed to send Slack notification:", error)
    return false
  }
}

export function createInventoryAlertMessage(lowStockItems: any[]) {
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
        text: `以下の商品で在庫不足が発生しています：`,
      },
    },
  ]

  lowStockItems.forEach((item) => {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `• *${item.name}* - 残り${item.stock}個 (${item.remainingDays}日分)`,
      },
    })
  })

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
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `• *${order.product.name}* - ${order.orderQty}個 (${order.orderType === "AUTO" ? "自動" : "手動"}発注)`,
      },
    })
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
        ],
      },
    ],
  }
}
