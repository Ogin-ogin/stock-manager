import { sign } from "jsonwebtoken" // jsonwebtokenをインポート

interface Product {
  id: string
  name: string
  url: string
  defaultOrderQty: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface InventoryRecord {
  id: string
  productId: string
  stockCount: number
  checkDate: string
  checkerName: string
}

interface Order {
  id: string
  productId: string
  orderQty: number
  orderType: "AUTO" | "MANUAL"
  orderReason: string
  ordererName: string
  orderDate: string
  isExported: boolean
  exportDate?: string
}

interface Settings {
  id: string
  consumptionCalcDays: number
  reorderThresholdDays: number
  reminderDay: number
  reminderTime: string
  exportDay: number
  exportTime: string
  slackWebhookUrl: string
  systemName: string
  adminEmail: string
  graphPastDays: number 
  graphForecastDays: number 
}

// Google Sheets API のベースURL
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets"
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"

// スプレッドシートID（環境変数から取得）
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID
// サービスアカウント認証情報（環境変数から取得）
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n") // 改行コードを正しく解釈

// シート名の定義
const SHEET_NAMES = {
  PRODUCTS: "Products",
  INVENTORY_RECORDS: "InventoryRecords",
  ORDERS: "Orders",
  SETTINGS: "Settings",
}

// JWTを生成し、アクセストークンを取得する関数
async function getAccessToken(): Promise<string> {
  if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
    throw new Error("Google service account credentials (client email or private key) are not set.")
  }

  const jwtPayload = {
    iss: GOOGLE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets", // スプレッドシートのスコープ
    aud: GOOGLE_OAUTH_TOKEN_URL,
    exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1時間有効
    iat: Math.floor(Date.now() / 1000),
  }

  const signedJwt = sign(jwtPayload, GOOGLE_PRIVATE_KEY, { algorithm: "RS256" })

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }).toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to get access token: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

// Google Sheets APIを呼び出すヘルパー関数
async function callSheetsAPI(endpoint: string, method: "GET" | "POST" | "PUT" = "GET", body?: any) {
  if (!SPREADSHEET_ID) {
    throw new Error("Google Spreadsheet ID is not set.")
  }

  const accessToken = await getAccessToken() // アクセストークンを取得

  const url = `${SHEETS_BASE_URL}/${SPREADSHEET_ID}/${endpoint}`

  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`, // アクセストークンをヘッダーに追加
    },
  }

  if (body && method !== "GET") {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Sheets API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  return response.json()
}

// 行データを配列に変換するヘルパー関数
function rowToObject<T>(headers: string[], row: any[]): T {
  const obj: any = {}
  headers.forEach((header, index) => {
    obj[header] = row[index] || ""
  })
  return obj as T
}

// オブジェクトを行データに変換するヘルパー関数
function objectToRow(obj: any, headers: string[]): any[] {
  return headers.map((header) => obj[header] || "")
}

// Products CRUD操作
export const productsAPI = {
  async getAll(): Promise<Product[]> {
    try {
      const response = await callSheetsAPI(`values/${SHEET_NAMES.PRODUCTS}`)
      const rows = response.values || []

      if (rows.length === 0) return []

      const headers = rows[0]
      const dataRows = rows.slice(1)

      return dataRows.map((row: any[]) => rowToObject<Product>(headers, row))
    } catch (error) {
      console.error("Failed to fetch products:", error)
      return []
    }
  },

  async create(product: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
    const newProduct: Product = {
      ...product,
      id: `prod_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const headers = ["id", "name", "url", "defaultOrderQty", "isActive", "createdAt", "updatedAt"]
    const row = objectToRow(newProduct, headers)

    await callSheetsAPI(`values/${SHEET_NAMES.PRODUCTS}:append?valueInputOption=RAW`, "POST", {
      values: [row],
    })

    return newProduct
  },

  async update(id: string, updates: Partial<Product>): Promise<Product | null> {
    const products = await this.getAll()
    const index = products.findIndex((p) => p.id === id)

    if (index === -1) return null

    const updatedProduct = {
      ...products[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    const headers = ["id", "name", "url", "defaultOrderQty", "isActive", "createdAt", "updatedAt"]
    const row = objectToRow(updatedProduct, headers)

    // 行番号は1ベース + ヘッダー行を考慮
    const rowNumber = index + 2
    await callSheetsAPI(`values/${SHEET_NAMES.PRODUCTS}!A${rowNumber}:G${rowNumber}?valueInputOption=RAW`, "PUT", {
      values: [row],
    })

    return updatedProduct
  },

  async delete(id: string): Promise<boolean> {
    // Google Sheets APIでは行の削除が複雑なため、isActiveをfalseに設定
    const result = await this.update(id, { isActive: false })
    return result !== null
  },
}

// InventoryRecords CRUD操作
export const inventoryAPI = {
  async getAll(): Promise<InventoryRecord[]> {
    try {
      const response = await callSheetsAPI(`values/${SHEET_NAMES.INVENTORY_RECORDS}`)
      const rows = response.values || []

      if (rows.length === 0) return []

      const headers = rows[0]
      const dataRows = rows.slice(1)

      return dataRows.map((row: any[]) => rowToObject<InventoryRecord>(headers, row))
    } catch (error) {
      console.error("Failed to fetch inventory records:", error)
      return []
    }
  },

  async create(record: Omit<InventoryRecord, "id">): Promise<InventoryRecord> {
    const newRecord: InventoryRecord = {
      ...record,
      id: `inv_${Date.now()}`,
      checkDate: record.checkDate || new Date().toISOString(),
    }

    const headers = ["id", "productId", "stockCount", "checkDate", "checkerName"]
    const row = objectToRow(newRecord, headers)

    await callSheetsAPI(`values/${SHEET_NAMES.INVENTORY_RECORDS}:append?valueInputOption=RAW`, "POST", {
      values: [row],
    })

    return newRecord
  },

  async getByProductId(productId: string): Promise<InventoryRecord[]> {
    const records = await this.getAll()
    return records
      .filter((r) => r.productId === productId)
      .sort((a, b) => new Date(b.checkDate).getTime() - new Date(a.checkDate).getTime())
  },

  // 新しいメソッド: 指定された日数分の在庫履歴を取得
  async getHistory(days: number): Promise<InventoryRecord[]> {
    const allRecords = await this.getAll()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days) // 指定日数前の日付

    return allRecords.filter((record) => new Date(record.checkDate) >= cutoffDate)
  },
}

// Orders CRUD操作
export const ordersAPI = {
  async getAll(): Promise<Order[]> {
    try {
      const response = await callSheetsAPI(`values/${SHEET_NAMES.ORDERS}`)
      const rows = response.values || []

      if (rows.length === 0) return []

      const headers = rows[0]
      const dataRows = rows.slice(1)

      return dataRows.map((row: any[]) => rowToObject<Order>(headers, row))
    } catch (error) {
      console.error("Failed to fetch orders:", error)
      return []
    }
  },

  async create(order: Omit<Order, "id" | "orderDate">): Promise<Order> {
    const newOrder: Order = {
      ...order,
      id: `order_${Date.now()}`,
      orderDate: new Date().toISOString(),
    }

    const headers = [
      "id",
      "productId",
      "orderQty",
      "orderType",
      "orderReason",
      "ordererName",
      "orderDate",
      "isExported",
      "exportDate",
    ]
    const row = objectToRow(newOrder, headers)

    await callSheetsAPI(`values/${SHEET_NAMES.ORDERS}:append?valueInputOption=RAW`, "POST", {
      values: [row],
    })

    return newOrder
  },

  async updateExported(ids: string[]): Promise<void> {
    const orders = await this.getAll()
    const exportDate = new Date().toISOString()

    // 複数の更新をバッチ処理するために、requests配列を構築
    const requests = []

    for (const id of ids) {
      const index = orders.findIndex((o) => o.id === id)
      if (index !== -1) {
        const updatedOrder = {
          ...orders[index],
          isExported: true,
          exportDate,
        }

        const headers = [
          "id",
          "productId",
          "orderQty",
          "orderType",
          "orderReason",
          "ordererName",
          "orderDate",
          "isExported",
          "exportDate",
        ]
        const row = objectToRow(updatedOrder, headers)

        const rowNumber = index + 2 // 1ベース + ヘッダー行
        requests.push({
          range: `${SHEET_NAMES.ORDERS}!A${rowNumber}:I${rowNumber}`,
          values: [row],
        })
      }
    }

    if (requests.length > 0) {
      await callSheetsAPI(`values:batchUpdate`, "POST", {
        data: requests,
        valueInputOption: "RAW",
      })
    }
  },
}

// Settings CRUD操作
export const settingsAPI = {
  async get(): Promise<Settings | null> {
    try {
      const response = await callSheetsAPI(`values/${SHEET_NAMES.SETTINGS}`)
      const rows = response.values || []

      if (rows.length < 2) return null

      const headers = rows[0]
      const dataRow = rows[1]

      // 型変換を考慮してオブジェクトを構築
      const settings = rowToObject<Settings>(headers, dataRow)
      return {
        ...settings,
        consumptionCalcDays: Number(settings.consumptionCalcDays),
        reorderThresholdDays: Number(settings.reorderThresholdDays),
        reminderDay: Number(settings.reminderDay),
        exportDay: Number(settings.exportDay),
        graphPastDays: Number(settings.graphPastDays || 30), // デフォルト値を追加
        graphForecastDays: Number(settings.graphForecastDays || 7), // デフォルト値を追加
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
      return null
    }
  },

  async createOrUpdate(settings: Omit<Settings, "id">): Promise<Settings> {
    const existingSettings = await this.get()

    const newSettings: Settings = {
      ...settings,
      id: existingSettings?.id || `settings_${Date.now()}`,
    }

    const headers = [
      "id",
      "consumptionCalcDays",
      "reorderThresholdDays",
      "reminderDay",
      "reminderTime",
      "exportDay",
      "exportTime",
      "slackWebhookUrl",
      "systemName",
      "adminEmail",
      "graphPastDays", // ヘッダーに追加
      "graphForecastDays", // ヘッダーに追加
    ]
    const row = objectToRow(newSettings, headers)

    if (existingSettings) {
      // 更新 (ヘッダーの数に合わせて範囲を拡張)
      await callSheetsAPI(`values/${SHEET_NAMES.SETTINGS}!A2:M2?valueInputOption=RAW`, "PUT", {
        // M2に範囲を拡張
        values: [row],
      })
    } else {
      // 新規作成
      await callSheetsAPI(`values/${SHEET_NAMES.SETTINGS}:append?valueInputOption=RAW`, "POST", {
        values: [headers, row],
      })
    }

    return newSettings
  },
}

// 初期化用のヘルパー関数
export async function initializeSheets() {
  try {
    // 各シートにヘッダー行を作成
    const sheetsToInit = [
      {
        name: SHEET_NAMES.PRODUCTS,
        headers: ["id", "name", "url", "defaultOrderQty", "isActive", "createdAt", "updatedAt"],
      },
      {
        name: SHEET_NAMES.INVENTORY_RECORDS,
        headers: ["id", "productId", "stockCount", "checkDate", "checkerName"],
      },
      {
        name: SHEET_NAMES.ORDERS,
        headers: [
          "id",
          "productId",
          "orderQty",
          "orderType",
          "orderReason",
          "ordererName",
          "orderDate",
          "isExported",
          "exportDate",
        ],
      },
      {
        name: SHEET_NAMES.SETTINGS,
        headers: [
          "id",
          "consumptionCalcDays",
          "reorderThresholdDays",
          "reminderDay",
          "reminderTime",
          "exportDay",
          "exportTime",
          "slackWebhookUrl",
          "systemName",
          "adminEmail",
          "graphPastDays", // ヘッダーに追加
          "graphForecastDays", // ヘッダーに追加
        ],
      },
    ]

    for (const sheet of sheetsToInit) {
      try {
        // 既存のシートのデータを取得して、ヘッダー行があるか確認
        const response = await callSheetsAPI(`values/${sheet.name}?majorDimension=ROWS`)
        const rows = response.values || []

        if (rows.length === 0 || JSON.stringify(rows[0]) !== JSON.stringify(sheet.headers)) {
          // シートが空か、ヘッダーが一致しない場合はヘッダーを書き込む
          await callSheetsAPI(`values/${sheet.name}!A1:Z1?valueInputOption=RAW`, "PUT", {
            values: [sheet.headers],
          })
          console.log(`Sheet ${sheet.name} headers initialized/updated.`)
        } else {
          console.log(`Sheet ${sheet.name} already has correct headers.`)
        }
      } catch (error: any) {
        console.warn(`Could not access or initialize sheet ${sheet.name}: ${error.message}`)
      }
    }

    console.log("Sheets initialization process completed.")
  } catch (error) {
    console.error("Failed to initialize sheets:", error)
  }
}
