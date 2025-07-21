export const runtime = "nodejs"
import { NextResponse } from "next/server"
import { ordersAPI, productsAPI } from "@/lib/sheets"
import { sendSlackNotification, createOrderCompletedMessage } from "@/lib/slack"
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import 'jspdf-autotable'

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

// 環境変数の型定義
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
    let fileBuffer: Uint8Array
    let filename: string
    let contentType: string

    if (format === 'pdf') {
      try {
        // PDF生成（基本設定）
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          putOnlyUsedFonts: true,
          compress: true,
          filters: ['ASCIIHexEncode']  // エンコーディングフィルターを追加
        });

        const now = new Date();
        filename = `orders_${now.toISOString().split('T')[0]}.pdf`
        contentType = 'application/pdf'

        try {
          // フォントサイズの設定
          doc.setFontSize(16);
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
              "0": { cellWidth: 45 }, // 商品名
              "1": { cellWidth: 15 }, // 数量
              "2": { cellWidth: 20 }, // 発注タイプ
              "3": { cellWidth: 25 }, // 発注者
              "4": { cellWidth: 25 }, // 発注日
              "5": { cellWidth: 45 }  // 理由
            },
            margin: { top: 14 }
          };

          // テーブルを描画
          doc.autoTable(tableConfig);

          try {
            // PDFをバッファに変換
            console.log('PDFバッファの生成を開始');
            const buffer = doc.output('arraybuffer');
            console.log('PDFバッファのサイズ:', buffer.byteLength);
            const pdfBuffer = new Uint8Array(buffer);
            console.log('Uint8Array変換後のサイズ:', pdfBuffer.length);

            // Vercel Blobにアップロード
            console.log('Vercel Blobへのアップロードを開始');
            const { uploadToVercelBlob } = await import("@/lib/vercel-blob-upload")
            const blobUrl = await uploadToVercelBlob({
              fileBuffer: pdfBuffer,
              filename,
              contentType
            })
            console.log('Vercel Blobへのアップロード完了:', blobUrl);

            // Slack通知の設定を確認
            const slackToken = process.env.SLACK_BOT_TOKEN
            const slackChannel = process.env.SLACK_CHANNEL_ID

            if (!slackToken || !slackChannel) {
              console.warn("Slack設定が不完全です。PDFはSlackに送信されません。")
              return new NextResponse(pdfBuffer, {
                headers: {
                  'Content-Type': contentType,
                  'Content-Disposition': `attachment; filename="${filename}"`,
                  'Content-Length': pdfBuffer.length.toString(),
                }
              })
            }

            console.log('Slack通知の送信を開始');
            // Slackにメッセージを送信（新しいfiles.upload APIの代わり）
            const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${slackToken}`
              },
              body: JSON.stringify({
                channel: slackChannel,
                text: `注文書PDFを出力しました (${targetOrders.length}件)\n${blobUrl}`,
                unfurl_links: true
              })
            })
            console.log('Slack API レスポンス受信');

            const slackData = await slackRes.json()
            
            if (!slackData.ok) {
              console.error("Slackメッセージ送信エラー:", slackData.error)
            } else {
              console.log("Slack通知送信成功:", {
                channelId: slackChannel,
                response: slackData
              })
            }

            // PDFをダウンロードとして返す
            return new NextResponse(pdfBuffer, {
              headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString(),
              }
            })
          } catch (error) {
            console.error("ファイル処理エラー:", error)
            console.error("エラーの詳細:", {
              error: error instanceof Error ? error.message : '不明なエラー',
              stack: error instanceof Error ? error.stack : undefined
            });
            throw new Error(`ファイル処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
          }
        } catch (pdfError) {
          console.error('PDF処理エラー:', pdfError)
          console.error("エラーの詳細:", {
            error: pdfError instanceof Error ? pdfError.message : '不明なエラー',
            stack: pdfError instanceof Error ? pdfError.stack : undefined
          });
          throw new Error(`PDF処理に失敗しました: ${pdfError instanceof Error ? pdfError.message : '不明なエラー'}`)
        }
      } catch (error) {
        console.error("最終エラーハンドラ:", error);
        return NextResponse.json({ 
          error: "PDF出力に失敗しました",
          details: error instanceof Error ? error.message : "不明なエラー",
          stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 })
      }
    } else {
      try {
        // Excel生成（デフォルト）
        const now = new Date()
        const filename = `orders_${now.toISOString().split('T')[0]}.xlsx`
        const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        // xlsxはBuffer型を返すため、Uint8Arrayに変換
        const excelBuffer = generateExcel(exportData)
        const fileBuffer = new Uint8Array(excelBuffer)

        // ファイルをレスポンスとして返す
        return new NextResponse(fileBuffer, {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': fileBuffer.length.toString(),
          },
        })
      } catch (error) {
        console.error("Excel生成エラー:", error)
        return NextResponse.json({ 
          error: "Excel生成に失敗しました",
          details: error instanceof Error ? error.message : "不明なエラー"
        }, { status: 500 })
      }
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
function generatePDF(data: any[]): ArrayBuffer {
  const doc = new jsPDF()

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
  const tableData: string[][] = data.map(row => [
    row.商品名,
    row.数量.toString(),
    row.発注タイプ,
    row.発注者,
    row.発注日,
    row.理由,
    row.出力状態
  ])

  // テーブルを生成
  (doc as any).autoTable({
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
