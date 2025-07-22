export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { ordersAPI, productsAPI } from "@/lib/sheets"
import { sendSlackNotification, createOrderCompletedMessage } from "@/lib/slack"
import { addJapaneseFont, setJapaneseFont, splitText, FONT_PRESETS, setFontPreset } from "@/lib/jp-fonts"
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

// jsPDFを使用したPDF生成関数（日本語対応版）
async function generatePDFWithJsPDF(data: any[], date: Date): Promise<Buffer> {
  const { jsPDF } = await import('jspdf')
  
  console.log('jsPDFインスタンスを作成中...')
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  
  console.log('jsPDF作成完了')

  // 日本語フォントを追加
  try {
    addJapaneseFont(doc)
    console.log('日本語フォント追加完了')
  } catch (error) {
    console.warn('日本語フォント追加に失敗:', error)
  }

  // ページ設定
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  let currentY = margin + 20

  // タイトル
  setFontPreset(doc, 'TITLE')
  doc.text('注文書', pageWidth / 2, currentY, { align: 'center' })
  currentY += 10

  // 出力日時
  setFontPreset(doc, 'SMALL')
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
  setJapaneseFont(doc, 9)
  
  let xPos = startX
  headers.forEach((header, i) => {
    const cellCenterX = xPos + columnWidths[i] / 2
    doc.text(header, cellCenterX, currentY, { align: 'center' })
    xPos += columnWidths[i]
  })

  currentY += 10

  // データ行
  doc.setTextColor(0, 0, 0) // 黒色
  setJapaneseFont(doc, 7)

  data.forEach((row, rowIndex) => {
    // ページ改行チェック
    if (currentY > pageHeight - 30) {
      doc.addPage()
      
      // 新しいページでも日本語フォントを設定
      try {
        addJapaneseFont(doc)
      } catch (error) {
        console.warn('新ページでの日本語フォント追加に失敗:', error)
      }
      
      currentY = margin
    }

    // 行の背景色（交互）
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 249, 250) // #f8f9fa
      doc.rect(startX, currentY - 3, totalWidth, 8, 'F')
    }

    // セルデータ（日本語対応の文字数制限）
    const rowData = [
      truncateText(row.商品名 || '', 20), // 日本語文字数を考慮した制限
      (row.数量 || '').toString(),
      (row.発注タイプ || '').toString(),
      truncateText(row.発注者 || '', 8),
      (row.発注日 || '').toString(),
      truncateText(row.理由 || '', 15)
    ]

    xPos = startX
    setJapaneseFont(doc, 7) // データ行のフォントサイズ
    
    rowData.forEach((cellData, colIndex) => {
      const cellCenterX = xPos + columnWidths[colIndex] / 2
      
      // 長いテキストの場合は改行または省略
      if (colIndex === 0 || colIndex === 5) { // 商品名と理由
        // 改行処理（日本語対応）
        const lines = splitText(doc, cellData, columnWidths[colIndex] - 4)
        if (lines.length > 1) {
          // 複数行の場合は最初の行のみ表示し、省略記号を追加
          const truncatedText = lines[0] + (lines.length > 1 ? '...' : '')
          doc.text(truncatedText, xPos + 2, currentY)
        } else {
          doc.text(cellData, xPos + 2, currentY)
        }
      } else {
        doc.text(cellData, cellCenterX, currentY, { align: 'center' })
      }
      
      xPos += columnWidths[colIndex]
    })

    currentY += 8
  })

  // フッター
  const footerY = pageHeight - 20
  setFontPreset(doc, 'SMALL')
  doc.text(`総件数: ${data.length}件`, margin, footerY)
  doc.text(`ページ: 1`, pageWidth - margin - 20, footerY)

  console.log('PDF内容の描画完了')

  // PDFをバッファとして出力
  const pdfArrayBuffer = doc.output('arraybuffer')
  const pdfBuffer = Buffer.from(pdfArrayBuffer)
  
  console.log(`生成されたPDFサイズ: ${pdfBuffer.length} bytes`)
  return pdfBuffer
}

// 日本語を考慮したテキスト切り詰め関数
function truncateText(text: string, maxLength: number): string {
  if (!text) return ''
  
  // 日本語文字（全角）を2文字分として計算
  let length = 0
  let result = ''
  
  for (const char of text) {
    const charLength = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(char) ? 2 : 1
    if (length + charLength > maxLength) {
      break
    }
    result += char
    length += charLength
  }
  
  return result
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