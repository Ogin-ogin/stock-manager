-- 初期商品データの挿入
INSERT INTO products (id, name, url, "defaultOrderQty", "isActive", "createdAt", "updatedAt") VALUES
('prod_1', 'プロワイプ（250枚入り）', 'https://axel.as-1.co.jp/asone/d/2-2624-01/?q=2-2624-01', 5, true, NOW(), NOW()),
('prod_2', 'キムタオル', 'https://axel.as-1.co.jp/asone/d/62-2674-40/?q=%E3%82%AD%E3%83%A0%E3%82%BF%E3%82%AA%E3%83%AB', 3, true, NOW(), NOW()),
('prod_3', 'ゴム手袋（SS）', 'https://www.monotaro.com/g/02853156/?t.q=55267879', 10, true, NOW(), NOW()),
('prod_4', 'ゴム手袋（S）', 'https://www.monotaro.com/g/04624521/?t.q=55049366', 10, true, NOW(), NOW()),
('prod_5', 'ゴム手袋（M）', 'https://www.monotaro.com/g/04624521/?t.q=55049375', 10, true, NOW(), NOW()),
('prod_6', 'ゴム手袋（L）', 'https://www.monotaro.com/g/04624521/?t.q=55049384', 10, true, NOW(), NOW()),
('prod_7', '通常マスク（50枚入り）', 'https://www.monotaro.com/g/01583807/?t.q=25956044', 5, true, NOW(), NOW());

-- 初期在庫データの挿入
INSERT INTO inventory_records (id, "productId", "stockCount", "checkDate", "checkerName") VALUES
('inv_1', 'prod_1', 2, NOW() - INTERVAL '1 day', '山田太郎'),
('inv_2', 'prod_2', 8, NOW() - INTERVAL '1 day', '山田太郎'),
('inv_3', 'prod_3', 12, NOW() - INTERVAL '1 day', '山田太郎'),
('inv_4', 'prod_4', 5, NOW() - INTERVAL '1 day', '山田太郎'),
('inv_5', 'prod_5', 1, NOW() - INTERVAL '1 day', '山田太郎'),
('inv_6', 'prod_6', 3, NOW() - INTERVAL '1 day', '山田太郎'),
('inv_7', 'prod_7', 12, NOW() - INTERVAL '1 day', '山田太郎');

-- 初期注文データの挿入
INSERT INTO orders (id, "productId", "orderQty", "orderType", "orderReason", "ordererName", "orderDate", "isExported") VALUES
('order_1', 'prod_1', 5, 'AUTO', '在庫不足による自動発注', 'システム', NOW() - INTERVAL '5 days', true),
('order_2', 'prod_5', 10, 'MANUAL', '実験で大量使用予定', '田中花子', NOW() - INTERVAL '6 days', true),
('order_3', 'prod_2', 3, 'AUTO', '在庫不足による自動発注', 'システム', NOW() - INTERVAL '8 days', true);

-- デフォルト設定の挿入
INSERT INTO settings (id, "consumptionCalcDays", "reorderThresholdDays", "reminderDay", "reminderTime", "exportDay", "exportTime", "slackWebhookUrl", "systemName", "adminEmail") VALUES
('settings_1', 7, 30, 5, '09:00', 1, '10:00', '', '触媒研究室 消耗品注文管理システム', 'admin@lab.example.com');
