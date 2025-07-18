import { put } from '@vercel/blob'

/**
 * Vercel Blob API（@vercel/blob公式）を使ってファイルをアップロードし、公開URLを返す
 * @param {Uint8Array} fileBuffer - アップロードするファイルのバイナリ
 * @param {string} filename - ファイル名
 * @param {string} contentType - Content-Type
 * @returns {Promise<string>} 公開URL
 */
/**
 * Vercel Blob APIを使ってファイルをアップロードし、公開URLを返す
 * @param {Uint8Array} fileBuffer - アップロードするファイルのバイナリ
 * @param {string} filename - ファイル名
 * @param {string} contentType - Content-Type
 * @returns {Promise<string>} 公開URL
 */
export async function uploadToVercelBlob({
  fileBuffer,
  filename,
  contentType,
}: {
  fileBuffer: Uint8Array,
  filename: string,
  contentType: string,
}): Promise<string> {
  try {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('ファイルバッファが空です');
    }

    const blob = await put(filename, fileBuffer, { 
      contentType, 
      access: 'public',
      addRandomSuffix: true // ファイル名の衝突を防ぐ
    });

    if (!blob || !blob.url) {
      throw new Error('Blobアップロードのレスポンスが無効です');
    }

    console.log("Vercel Blob upload success:", {
      filename,
      size: fileBuffer.length,
      url: blob.url
    });

    return blob.url;
  } catch (error) {
    console.error("Vercel Blob upload error:", error);
    throw new Error(`Vercel Blobアップロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}
