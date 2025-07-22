export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { ordersAPI, productsAPI } from "@/lib/sheets"
import { sendSlackNotification, createOrderCompletedMessage } from "@/lib/slack"
import { uploadToVercelBlob } from "@/lib/vercel-blob-upload"
import * as XLSX from 'xlsx'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SLACK_BOT_TOKEN?: string
      SLACK_CHANNEL_ID?: string
      BLOB_READ_WRITE_TOKEN?: string
    }
  }
}

export async function POST(request: Request) {
  try {
    // リクエストボディを解析
    const body = await request.json().catch(() => ({}))
    const { includeExported = false, startDate } = body

    // 注文を取得
    const orders = await ordersAPI.getAll()
    console.log(`Total orders found: ${orders.length}`)
    
    // 対象の注文をフィルタリング
    let targetOrders = orders
    
    if (includeExported) {
      if (startDate) {
        targetOrders = orders.filter((o) => new Date(o.orderDate) >= new Date(startDate))
        console.log(`Orders from ${startDate}: ${targetOrders.length}`)
      }
    } else {
      targetOrders = orders.filter((o) => !o.isExported)
    }
    
    console.log(`Target orders: ${targetOrders.length}`)

    if (targetOrders.length === 0) {
      const totalOrders = orders.length
      const exportedOrders = orders.filter((o) => o.isExported).length
      const pendingOrders = orders.filter((o) => !o.isExported).length
      
      let message = "No orders to export"
      if (includeExported && startDate) {
        message = `No orders found from ${startDate}`
      } else if (!includeExported && totalOrders > 0) {
        message = `All ${totalOrders} orders have already been exported`
      } else if (totalOrders === 0) {
        message = "No orders found in the system"
      }
      
      return NextResponse.json({ 
        error: "No orders to export",
        details: {
          totalOrders,
          exportedOrders,
          pendingOrders,
          targetOrders: targetOrders.length,
          message
        }
      }, { status: 400 })
    }

    // 商品情報を取得
    const products = await productsAPI.getAll()
    const targetOrdersWithProducts = targetOrders.map((order) => ({
      ...order,
      product: products.find((p) => p.id === order.productId),
    }))

    // 注文を出力済みにマーク（includeExportedがfalseの場合のみ）
    if (!includeExported) {
      const orderIds = targetOrders.map((o) => o.id)
      await ordersAPI.updateExported(orderIds)

      // Slack通知を送信
      const message = createOrderCompletedMessage(targetOrdersWithProducts)
      await sendSlackNotification(message)
    }

    // エクスポートデータの準備
    const exportData = targetOrdersWithProducts.map((order) => ({
      商品名: order.product?.name || "",
      数量: order.orderQty,
      発注タイプ: order.orderType === "AUTO" ? "自動" : "手動",
      発注者: order.ordererName,
      発注日: new Date(order.orderDate).toLocaleDateString("ja-JP"),
      理由: order.orderReason,
      商品URL: order.product?.url || "",
      出力状態: order.isExported ? "出力済み" : "未出力",
    }))

    const now = new Date()
    const filename = `orders_${now.toISOString().split('T')[0]}.xlsx`
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    
    // Excel生成
    const excelBuffer = generateExcel(exportData)
    const fileBuffer = new Uint8Array(excelBuffer)

    // Vercel Blob アップロードとSlack通知
    let blobUrl: string | null = null
    
    try {
      // Vercel Blob アップロードを試行
      console.log('Vercel Blob処理を開始')
      console.log('環境変数チェック:', {
        hasBlobToken: !!process.env.BLOB_READ_WRITE_TOKEN
      })
      
      blobUrl = await uploadToVercelBlob({
        fileBuffer,
        filename,
        contentType
      })
      console.log('Vercel Blobへのアップロード完了:', blobUrl)
    } catch (blobError) {
      console.warn('Vercel Blob処理エラー（続行します）:', {
        error: blobError instanceof Error ? blobError.message : 'Unknown error',
        stack: blobError instanceof Error ? blobError.stack : undefined
      })
    }

    // Slack通知（ファイル送信またはVercel Blobリンク）
    const slackToken = process.env.SLACK_BOT_TOKEN
    const slackChannel = process.env.SLACK_CHANNEL_ID

    if (slackToken && slackChannel) {
      console.log('Slack通知の送信を開始')
      
      try {
        if (blobUrl) {
          // Vercel Blobリンクをシェア
          const slackMessage = `注文書Excelファイルを出力しました (${targetOrders.length}件)\nダウンロード: ${blobUrl}`
          
          const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${slackToken}`
            },
            body: JSON.stringify({
              channel: slackChannel,
              text: slackMessage,
              unfurl_links: true
            })
          })
          
          const slackData = await slackRes.json()
          
          if (!slackData.ok) {
            console.error("Slackメッセージ送信エラー:", slackData.error)
          } else {
            console.log("Slack通知送信成功")
          }
        } else {
          // 直接ファイルをSlackにアップロード（フォールバック）
          console.log('Slackへの直接ファイルアップロードを試行')
          
          const formData = new FormData()
          formData.append('file', new Blob([fileBuffer], { type: contentType }), filename)
          formData.append('channels', slackChannel)
          formData.append('initial_comment', `注文書Excelファイルを出力しました (${targetOrders.length}件)`)
          formData.append('filename', filename)
          
          const uploadRes = await fetch('https://slack.com/api/files.upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${slackToken}`
            },
            body: formData
          })
          
          const uploadData = await uploadRes.json()
          
          if (uploadData.ok) {
            console.log('Slackファイルアップロード成功')
          } else {
            console.error('Slackファイルアップロードエラー:', uploadData.error)
            
            // フォールバック: シンプルなメッセージ送信
            const fallbackRes = await fetch('https://slack.com/api/chat.postMessage', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${slackToken}`
              },
              body: JSON.stringify({
                channel: slackChannel,
                text: `注文書Excelファイルを出力しました (${targetOrders.length}件)\nファイルはWebからダウンロードしてください。`
              })
            })
            
            if (fallbackRes.ok) {
              console.log("フォールバックSlack通知送信成功")
            }
          }
        }
      } catch (slackError) {
        console.error('Slack送信エラー:', slackError)
      }
    }

    // Excelファイルをダウンロードとして返す
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error("データ処理エラー:", error)
    return NextResponse.json({ 
      error: "注文データの処理に失敗しました",
      details: error instanceof Error ? error.message : "不明なエラー"
    }, { status: 500 })
  }
}

// Excel生成関数
function generateExcel(data: any[]): ArrayBuffer {
  const worksheet = XLSX.utils.json_to_sheet(data)
  
  const columnWidths = [
    { wch: 30 }, // 商品名
    { wch: 10 }, // 数量
    { wch: 12 }, // 発注タイプ
    { wch: 15 }, // 発注者
    { wch: 12 }, // 発注日
    { wch: 30 }, // 理由
    { wch: 40 }, // 商品URL
    { wch: 15 }, // 出力状態
  ]
  worksheet['!cols'] = columnWidths

  // ヘッダー行のスタイル設定
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "428BCA" } },
    alignment: { horizontal: "center", vertical: "center" }
  }

  // ヘッダー行のセル（A1からH1）にスタイルを適用
  const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1']
  headerCells.forEach(cell => {
    if (worksheet[cell]) {
      worksheet[cell].s = headerStyle
    }
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '注文履歴')

  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return excelBuffer
}