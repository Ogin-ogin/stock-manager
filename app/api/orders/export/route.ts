export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { ordersAPI, productsAPI } from "@/lib/sheets"
import { sendSlackNotification, createOrderCompletedMessage } from "@/lib/slack"
import * as XLSX from 'xlsx'
import PDFDocument from 'pdfkit'

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
      console.log('PDFKit による PDF生成を開始します')
      filename = `orders_${now.toISOString().split('T')[0]}.pdf`
      contentType = 'application/pdf'

      // PDFKitでPDF生成
      const pdfBuffer = await generatePDFWithPDFKit(exportData, now)

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

// PDFKitを使用したPDF生成関数
async function generatePDFWithPDFKit(data: any[], date: Date): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      console.log('PDFKitインスタンスを作成中...')
      
      // PDFDocument作成（日本語フォント対応）
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: '注文書',
          Author: 'Order Management System',
          Subject: '注文履歴',
          CreationDate: date
        }
      })

      console.log('PDFDocument作成完了')
      
      const buffers: Buffer[] = []
      
      // データをバッファに収集
      doc.on('data', (chunk: Buffer) => {
        buffers.push(chunk)
      })
      
      doc.on('end', () => {
        console.log('PDF生成完了')
        const pdfBuffer = Buffer.concat(buffers)
        console.log(`生成されたPDFサイズ: ${pdfBuffer.length} bytes`)
        resolve(pdfBuffer)
      })

      doc.on('error', (error: Error) => {
        console.error('PDFKit生成エラー:', error)
        reject(error)
      })

      // 日本語フォントの設定を試行
      try {
        // Noto Sans JPフォントまたは代替フォントを使用
        // フォントファイルが利用可能な場合の設定
        // doc.font('/path/to/NotoSansJP-Regular.ttf')
        
        // 代替案: PDFKitの標準フォント（一部日本語対応）
        doc.font('Helvetica')
        console.log('フォント設定完了（Helvetica）')
      } catch (fontError) {
        console.warn('フォント設定エラー:', fontError)
        // デフォルトフォントを使用
      }

      // ページ設定
      const pageWidth = doc.page.width - 100 // マージンを考慮
      const startY = 80
      let currentY = startY

      // タイトル
      doc.fontSize(18)
         .text('注文書', 50, 50, { align: 'center' })

      // 出力日時
      doc.fontSize(10)
         .text(`出力日時: ${date.toLocaleString('ja-JP')}`, 50, 70)

      currentY = 100

      // テーブルヘッダー
      const headers = ['商品名', '数量', '発注タイプ', '発注者', '発注日', '理由']
      const columnWidths = [120, 40, 60, 80, 60, 120] // 列幅
      const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0)
      
      // ヘッダー背景
      doc.rect(50, currentY, totalWidth, 25)
         .fill('#428bca')
         .stroke()

      // ヘッダーテキスト
      doc.fill('#ffffff')
         .fontSize(9)
      
      let xPos = 50
      headers.forEach((header, i) => {
        const cellCenterX = xPos + columnWidths[i] / 2
        doc.text(header, cellCenterX - doc.widthOfString(header) / 2, currentY + 8)
        xPos += columnWidths[i]
      })

      currentY += 25

      // データ行
      doc.fill('#000000') // テキスト色を黒に戻す
      
      data.forEach((row, rowIndex) => {
        // ページ改行チェック
        if (currentY > doc.page.height - 100) {
          doc.addPage()
          currentY = 50
        }

        // 行の背景色（交互）
        if (rowIndex % 2 === 0) {
          doc.rect(50, currentY, totalWidth, 20)
             .fill('#f8f9fa')
             .stroke()
        } else {
          doc.rect(50, currentY, totalWidth, 20)
             .stroke()
        }

        // セルデータ
        const rowData = [
          (row.商品名 || '').toString().substring(0, 15), // 文字数制限
          (row.数量 || '').toString(),
          (row.発注タイプ || '').toString(),
          (row.発注者 || '').toString().substring(0, 10),
          (row.発注日 || '').toString(),
          (row.理由 || '').toString().substring(0, 20)
        ]

        doc.fill('#000000')
           .fontSize(8)
        
        xPos = 50
        rowData.forEach((cellData, colIndex) => {
          // セル内でのテキスト配置
          const cellY = currentY + 6
          const maxWidth = columnWidths[colIndex] - 4 // パディング
          
          // テキストを複数行に分割する場合の処理
          const lines = doc.heightOfString(cellData, { width: maxWidth })
          if (lines > 14) { // セルの高さを超える場合は短縮
            const truncated = cellData.substring(0, Math.floor(cellData.length * 14 / lines)) + '...'
            doc.text(truncated, xPos + 2, cellY, { width: maxWidth })
          } else {
            doc.text(cellData, xPos + 2, cellY, { width: maxWidth })
          }
          
          xPos += columnWidths[colIndex]
        })

        currentY += 20
      })

      // フッター
      const footerY = doc.page.height - 50
      doc.fontSize(8)
         .text(`総件数: ${data.length}件`, 50, footerY)
         .text(`ページ: 1`, doc.page.width - 100, footerY)

      console.log('PDF内容の描画完了、終了処理中...')
      doc.end()

    } catch (error) {
      console.error('PDFKit生成中にエラーが発生:', error)
      reject(error)
    }
  })
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