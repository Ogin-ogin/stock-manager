import { PrismaClient } from "@prisma/client"

/**
 * Prisma Client を遅延初期化して返すヘルパー関数
 * - ビルド時（モジュール解析時）には実行されない
 * - 実際のリクエスト処理内で呼び出したタイミングでのみインスタンス生成
 */
let prisma: PrismaClient | undefined

export function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}
