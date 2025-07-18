
import { FormData } from "undici"

/**
 * SlackファイルアップロードAPIを使ってPDF等のバイナリファイルをアップロードする
 * @param {Buffer|Uint8Array} fileBuffer - アップロードするファイルのバイナリ
 * @param {string} filename - ファイル名
 * @param {string} channels - アップロード先チャンネルID（カンマ区切り可）
 * @param {string} token - Slack Bot User OAuth Token
 * @param {string} [initialComment] - ファイルに添えるコメント
 * @returns {Promise<any>} Slack APIレスポンス
 */
export async function uploadFileToSlack({
  fileBuffer,
  filename,
  channels,
  token,
  initialComment,
}: {
  fileBuffer: Uint8Array,
  filename: string,
  channels: string,
  token: string,
  initialComment?: string,
}): Promise<any> {

  const formData = new FormData()
  formData.append("file", new Blob([fileBuffer]), filename)
  formData.append("filename", filename)
  formData.append("channels", channels)
  if (initialComment) formData.append("initial_comment", initialComment)

  const response = await fetch("https://slack.com/api/files.upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })
  const data = await response.json()
  console.log("Slack upload response:", data)
  if (!data.ok) {
    throw new Error(data.error || "Slack file upload failed")
  }
  return data
}
