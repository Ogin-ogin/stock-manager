import { NextResponse } from "next/server"
import { ordersAPI, productsAPI } from "@/lib/sheets"
import { sendSlackNotification, createOrderCompletedMessage } from "@/lib/slack"
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// jsPDFの型拡張
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void
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
      // 出力済みも含める場合
      if (startDate) {
        // 開始日以降の注文のみ
        targetOrders = orders.filter((o) => new Date(o.orderDate) >= new Date(startDate))
        console.log(`Orders from ${startDate}: ${targetOrders.length}`)
      }
      // startDateが指定されていない場合はすべての注文
    } else {
      // 未出力の注文のみ
      targetOrders = orders.filter((o) => !o.isExported)
    }
    
    console.log(`Target orders: ${targetOrders.length}`)

    if (targetOrders.length === 0) {
      // より詳細なエラーメッセージ
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

    // ファイル生成
    let fileBuffer: Buffer
    let filename: string
    let contentType: string

    if (format === 'pdf') {
      // PDF生成
      const pdfBuffer = generatePDF(exportData)
      fileBuffer = Buffer.from(pdfBuffer)
      filename = `orders_${new Date().toISOString().split('T')[0]}.pdf`
      contentType = 'application/pdf'
    } else {
      // Excel生成（デフォルト）
      const excelBuffer = generateExcel(exportData)
      fileBuffer = excelBuffer
      filename = `orders_${new Date().toISOString().split('T')[0]}.xlsx`
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }

    // ファイルをレスポンスとして返す
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error("Failed to export orders:", error)
    return NextResponse.json({ 
      error: "Failed to export orders",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Excel生成関数
function generateExcel(data: any[]): Buffer {
  const worksheet = XLSX.utils.json_to_sheet(data)
  
  // 列幅を設定
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

  // ヘッダーのスタイル設定
  const headerStyle = {
    font: { bold: true },
    fill: { fgColor: { rgb: 'E6E6FA' } },
    alignment: { horizontal: 'center' }
  }

  // ワークブックを作成
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '注文履歴')

  // バッファとして出力
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  return excelBuffer
}

// PDF生成関数
function generatePDF(data: any[]): Uint8Array {
  const doc = new jsPDF()
  
  // 日本語フォントを設定（必要に応じて）
  // doc.setFont('NotoSansCJK-Regular')

  // タイトル
  doc.setFontSize(16)
  doc.text('注文履歴', 14, 22)
  
  // 出力日時
  doc.setFontSize(10)
  doc.text(`出力日時: ${new Date().toLocaleString('ja-JP')}`, 14, 30)

  // テーブルのヘッダー
  const headers = [
    ['商品名', '数量', '発注タイプ', '発注者', '発注日', '理由', '出力状態']
  ]

  // テーブルのデータ
  const tableData = data.map(row => [
    row.商品名,
    row.数量.toString(),
    row.発注タイプ,
    row.発注者,
    row.発注日,
    row.理由,
    row.出力状態
  ])

  // テーブルを生成
  doc.autoTable({
    head: headers,
    body: tableData,
    startY: 40,
    styles: {
      fontSize: 7,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [230, 230, 250],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 35 }, // 商品名
      1: { cellWidth: 15 }, // 数量
      2: { cellWidth: 20 }, // 発注タイプ
      3: { cellWidth: 20 }, // 発注者
      4: { cellWidth: 20 }, // 発注日
      5: { cellWidth: 40 }, // 理由
      6: { cellWidth: 20 }, // 出力状態
    },
    margin: { top: 40 },
  })

  return doc.output('arraybuffer')
}
