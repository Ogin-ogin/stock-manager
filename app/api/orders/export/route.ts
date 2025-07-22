export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { ordersAPI, productsAPI } from "@/lib/sheets"
import { sendSlackNotification, createOrderCompletedMessage } from "@/lib/slack"
import * as XLSX from 'xlsx'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SLACK_BOT_TOKEN?: string
      SLACK_CHANNEL_ID?: string
    }
  }
}

export async function POST(request: Request) {
  try {
    // リクエストボディを解析
    const body = await request.json().catch(() => ({}))
    const { format = 'xlsx', includeExported = false, startDate } = body

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
    let filename: string
    let contentType: string

    if (format === 'pdf') {
      console.log('jsPDF による PDF生成を開始します')
      filename = `orders_${now.toISOString().split('T')[0]}.pdf`
      contentType = 'application/pdf'

      // jsPDFでPDF生成
      const pdfBuffer = await generatePDFWithJsPDF(exportData, now)

      // Google Drive アップロードを試行（エラー時はスキップ）
      let driveUrl: string | null = null
      try {
        console.log('Google Drive処理を開始')
        console.log('環境変数チェック:', {
          hasClientEmail: !!process.env.GOOGLE_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.GOOGLE_PRIVATE_KEY,
          hasFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID
        })
        
        const { uploadToDrive } = await import("@/lib/google-drive")
        console.log('uploadToDrive関数をインポートしました')
        
        driveUrl = await uploadToDrive(pdfBuffer, filename, contentType)
        console.log('Google Driveへのアップロード完了:', driveUrl)
      } catch (driveError) {
        console.error('Google Drive処理エラー（スキップします）:', {
          error: driveError instanceof Error ? driveError.message : 'Unknown error',
          stack: driveError instanceof Error ? driveError.stack : undefined
        })
      }

      // Slack通知
      const slackToken = process.env.SLACK_BOT_TOKEN
      const slackChannel = process.env.SLACK_CHANNEL_ID

      if (slackToken && slackChannel) {
        console.log('Slack通知の送信を開始')
        
        const slackMessage = driveUrl 
          ? `注文書PDFを出力しました (${targetOrders.length}件)\nGoogle Drive: ${driveUrl}`
          : `注文書PDFを出力しました (${targetOrders.length}件)\nファイルはダウンロードで取得してください。`

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
      }

      // PDFをダウンロードとして返す
      return new NextResponse(pdfBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': pdfBuffer.length.toString(),
        }
      })

    } else {
      // Excel生成（デフォルト）
      filename = `orders_${now.toISOString().split('T')[0]}.xlsx`
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      
      const excelBuffer = generateExcel(exportData)
      const fileBuffer = new Uint8Array(excelBuffer)

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      })
    }

  } catch (error) {
    console.error("データ処理エラー:", error)
    return NextResponse.json({ 
      error: "注文データの処理に失敗しました",
      details: error instanceof Error ? error.message : "不明なエラー"
    }, { status: 500 })
  }
}

// jsPDFを使用したPDF生成関数（サーバーレス環境対応）
async function generatePDFWithJsPDF(data: any[], date: Date): Promise<Buffer> {
  const { jsPDF } = await import('jspdf')
  
  console.log('jsPDFインスタンスを作成中...')
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  
  console.log('jsPDF作成完了')

  // ページ設定
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let currentY = margin + 20

  // タイトル
  doc.setFontSize(16)
  doc.text('注文書', pageWidth / 2, currentY, { align: 'center' })
  currentY += 10

  // 出力日時
  doc.setFontSize(8)
  doc.text(`出力日時: ${date.toLocaleString('ja-JP')}`, margin, currentY)
  currentY += 15

  // テーブルヘッダー
  const headers = ['商品名', '数量', '発注タイプ', '発注者', '発注日', '理由']
  const columnWidths = [60, 20, 25, 25, 25, 45] // mm単位
  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0)
  const startX = (pageWidth - totalWidth) / 2

  // ヘッダー背景（長方形）
  doc.setFillColor(66, 139, 202) // #428bca
  doc.rect(startX, currentY - 5, totalWidth, 10, 'F')

  // ヘッダーテキスト
  doc.setTextColor(255, 255, 255) // 白色
  doc.setFontSize(9)
  
  let xPos = startX
  headers.forEach((header, i) => {
    const cellCenterX = xPos + columnWidths[i] / 2
    doc.text(header, cellCenterX, currentY, { align: 'center' })
    xPos += columnWidths[i]
  })

  currentY += 10

  // データ行
  doc.setTextColor(0, 0, 0) // 黒色
  doc.setFontSize(7)

  data.forEach((row, rowIndex) => {
    // ページ改行チェック
    if (currentY > pageHeight - 30) {
      doc.addPage()
      currentY = margin
    }

    // 行の背景色（交互）
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 249, 250) // #f8f9fa
      doc.rect(startX, currentY - 3, totalWidth, 8, 'F')
    }

    // セルデータ
    const rowData = [
      (row.商品名 || '').toString().substring(0, 20), // 文字数制限
      (row.数量 || '').toString(),
      (row.発注タイプ || '').toString(),
      (row.発注者 || '').toString().substring(0, 8),
      (row.発注日 || '').toString(),
      (row.理由 || '').toString().substring(0, 15)
    ]

    xPos = startX
    rowData.forEach((cellData, colIndex) => {
      const cellCenterX = xPos + columnWidths[colIndex] / 2
      
      // 長いテキストの場合は改行または省略
      if (colIndex === 0 || colIndex === 5) { // 商品名と理由
        doc.text(cellData, xPos + 2, currentY, { maxWidth: columnWidths[colIndex] - 4 })
      } else {
        doc.text(cellData, cellCenterX, currentY, { align: 'center' })
      }
      
      xPos += columnWidths[colIndex]
    })

    currentY += 8
  })

  // フッター
  const footerY = pageHeight - 20
  doc.setFontSize(8)
  doc.text(`総件数: ${data.length}件`, margin, footerY)
  doc.text(`ページ: 1`, pageWidth - margin - 20, footerY)

  console.log('PDF内容の描画完了')

  // PDFをバッファとして出力
  const pdfArrayBuffer = doc.output('arraybuffer')
  const pdfBuffer = Buffer.from(pdfArrayBuffer)
  
  console.log(`生成されたPDFサイズ: ${pdfBuffer.length} bytes`)
  return pdfBuffer
}

// Excel生成関数
function generateExcel(data: any[]): ArrayBuffer {
  const worksheet = XLSX.utils.json_to_sheet(data)
  
  const columnWidths = [
    { wch: 30 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 12 },
    { wch: 30 },
    { wch: 40 },
    { wch: 15 },
  ]
  worksheet['!cols'] = columnWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '注文履歴')

  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return excelBuffer
}