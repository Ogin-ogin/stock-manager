export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { ordersAPI, productsAPI } from "@/lib/sheets"
import { sendSlackNotification, createOrderCompletedMessage } from "@/lib/slack"
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

type AutoTableConfig = {
  startY: number;
  head: string[][];
  body: string[][];
  styles?: { fontSize: number };
  headStyles?: {
    fillColor?: [number, number, number, number];
    textColor?: [number, number, number, number];
    fontSize?: number;
  };
  bodyStyles?: { fontSize: number };
  columnStyles?: Record<string, { cellWidth: number }>;
  margin?: { top: number };
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (config: AutoTableConfig) => void;
    output(type: 'arraybuffer'): ArrayBuffer;
    text(text: string, x: number, y: number, options?: { align?: string }): jsPDF;
    setFontSize(size: number): jsPDF;
    rect(x: number, y: number, w: number, h: number, style?: string): jsPDF;
    setFillColor(r: number, g: number, b: number): jsPDF;
    setTextColor(r: number, g: number, b: number): jsPDF;
    addFileToVFS(filename: string, data: string): void
    addFont(postScriptName: string, id: string, fontStyle: string, encoding?: string): void
    setFont(fontName: string, fontStyle?: string, fontWeight?: string): jsPDF
    split(text: string, maxWidth: number): string[]
    getTextWidth(text: string): number
  }
}

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
      console.log('PDF生成を開始します')
      filename = `orders_${now.toISOString().split('T')[0]}.pdf`
      contentType = 'application/pdf'

      // PDF生成
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        compress: true
      })

      console.log('jsPDFインスタンスを作成しました')

      // フォントサイズの設定
      doc.setFontSize(16)
      doc.text('注文書', 14, 15)
      
      // 出力日時を追加
      doc.setFontSize(10)
      doc.text(`出力日時: ${now.toLocaleString('ja-JP')}`, 14, 25)
      
      // テーブルデータの準備
      const headers = [['商品名', '数量', '発注タイプ', '発注者', '発注日', '理由']]
      const tableData = exportData.map(row => [
        String(row.商品名 || '').slice(0, 30),
        String(row.数量 || ''),
        String(row.発注タイプ || ''),
        String(row.発注者 || ''),
        String(row.発注日 || ''),
        String(row.理由 || '').slice(0, 50)
      ])

      // テーブルの設定
      const tableConfig: AutoTableConfig = {
        startY: 30,
        head: headers,
        body: tableData,
        styles: {
          fontSize: 9
        },
        headStyles: {
          fillColor: [66, 139, 202, 255],
          textColor: [255, 255, 255, 255],
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 9
        },
        columnStyles: {
          "0": { cellWidth: 45 },
          "1": { cellWidth: 15 },
          "2": { cellWidth: 20 },
          "3": { cellWidth: 25 },
          "4": { cellWidth: 25 },
          "5": { cellWidth: 45 }
        },
        margin: { top: 14 }
      }

      // テーブルを描画
      autoTable(doc, tableConfig)

      console.log('PDFバッファの生成を開始')
      const buffer = doc.output('arraybuffer')
      console.log('PDFバッファのサイズ:', buffer.byteLength)
      const pdfBuffer = Buffer.from(buffer)
      console.log('Buffer変換後のサイズ:', pdfBuffer.length)

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