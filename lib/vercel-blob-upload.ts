import { put } from '@vercel/blob'

/**
 * Vercel Blob APIを使ってファイルをアップロードし、公開URLを返す
 * @param {object} params - パラメータオブジェクト
 * @param {Uint8Array} params.fileBuffer - アップロードするファイルのバイナリ
 * @param {string} params.filename - ファイル名
 * @param {string} params.contentType - Content-Type
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
    // 入力値の検証
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('ファイルバッファが空です');
    }

    if (!filename || filename.trim() === '') {
      throw new Error('ファイル名が指定されていません');
    }

    if (!contentType || contentType.trim() === '') {
      throw new Error('Content-Typeが指定されていません');
    }

    console.log("Vercel Blob upload開始:", {
      filename,
      size: fileBuffer.length,
      contentType
    });

    // Vercel Blobにファイルをアップロード
    const blob = await put(filename, fileBuffer, { 
      contentType, 
      access: 'public',
      addRandomSuffix: true // ファイル名の衝突を防ぐ
    });

    // レスポンスの検証
    if (!blob || !blob.url) {
      throw new Error('Blobアップロードのレスポンスが無効です');
    }

    console.log("Vercel Blob upload成功:", {
      filename,
      size: fileBuffer.length,
      url: blob.url,
      pathname: blob.pathname,
      downloadUrl: blob.downloadUrl
    });

    return blob.url;
    
  } catch (error) {
    console.error("Vercel Blob upload error:", {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      filename,
      fileBufferSize: fileBuffer?.length || 0
    });
    
    throw new Error(`Vercel Blobアップロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}