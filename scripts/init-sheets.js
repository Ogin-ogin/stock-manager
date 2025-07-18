// Google Sheetsの初期データを投入するスクリプト
// 手動でスプレッドシートにデータを入力するか、Google Apps Scriptを使用してください

const initialData = {
  products: [
    [
      "prod_1",
      "プロワイプ（250枚入り）",
      "https://axel.as-1.co.jp/asone/d/2-2624-01/?q=2-2624-01",
      "5",
      "true",
      new Date().toISOString(),
      new Date().toISOString(),
    ],
    [
      "prod_2",
      "キムタオル",
      "https://axel.as-1.co.jp/asone/d/62-2674-40/?q=%E3%82%AD%E3%83%A0%E3%82%BF%E3%82%AA%E3%83%AB",
      "3",
      "true",
      new Date().toISOString(),
      new Date().toISOString(),
    ],
    [
      "prod_3",
      "ゴム手袋（SS）",
      "https://www.monotaro.com/g/02853156/?t.q=55267879",
      "10",
      "true",
      new Date().toISOString(),
      new Date().toISOString(),
    ],
    [
      "prod_4",
      "ゴム手袋（S）",
      "https://www.monotaro.com/g/04624521/?t.q=55049366",
      "10",
      "true",
      new Date().toISOString(),
      new Date().toISOString(),
    ],
    [
      "prod_5",
      "ゴム手袋（M）",
      "https://www.monotaro.com/g/04624521/?t.q=55049375",
      "10",
      "true",
      new Date().toISOString(),
      new Date().toISOString(),
    ],
    [
      "prod_6",
      "ゴム手袋（L）",
      "https://www.monotaro.com/g/04624521/?t.q=55049384",
      "10",
      "true",
      new Date().toISOString(),
      new Date().toISOString(),
    ],
    [
      "prod_7",
      "通常マスク（50枚入り）",
      "https://www.monotaro.com/g/01583807/?t.q=25956044",
      "5",
      "true",
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  ],
  inventoryRecords: [
    ["inv_1", "prod_1", "2", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), "山田太郎"],
    ["inv_2", "prod_2", "8", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), "山田太郎"],
    ["inv_3", "prod_3", "12", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), "山田太郎"],
    ["inv_4", "prod_4", "5", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), "山田太郎"],
    ["inv_5", "prod_5", "1", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), "山田太郎"],
    ["inv_6", "prod_6", "3", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), "山田太郎"],
    ["inv_7", "prod_7", "12", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), "山田太郎"],
  ],
  orders: [
    [
      "order_1",
      "prod_1",
      "5",
      "AUTO",
      "在庫不足による自動発注",
      "システム",
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      "true",
      new Date().toISOString(),
    ],
    [
      "order_2",
      "prod_5",
      "10",
      "MANUAL",
      "実験で大量使用予定",
      "田中花子",
      new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      "true",
      new Date().toISOString(),
    ],
    [
      "order_3",
      "prod_2",
      "3",
      "AUTO",
      "在庫不足による自動発注",
      "システム",
      new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      "true",
      new Date().toISOString(),
    ],
  ],
  settings: [
    [
      "settings_1",
      "7",
      "30",
      "5",
      "09:00",
      "1",
      "10:00",
      "",
      "触媒研究室 消耗品注文管理システム",
      "admin@lab.example.com",
    ],
  ],
}

console.log("Initial data for Google Sheets:")
console.log("Please manually add this data to your Google Spreadsheet or use Google Apps Script")
console.log(JSON.stringify(initialData, null, 2))
