import { put, list, del } from '@vercel/blob'

/**
 * 1年以上前にアップロードされた古いファイルを削除する
 * @param {number} maxAgeMs - 削除対象となるファイルの最大年数（デフォルト: 1年）
 */
async function cleanupOldFiles(maxAgeMs: number = 365 * 24 * 60 * 60 * 1000) {
  try {
    console.log("古いファイルのクリーンアップを開始します...");
    
    // 全てのファイルを取得
    const { blobs } = await list();
    
    if (!blobs || blobs.length === 0) {
      console.log("削除対象のファイルはありません");
      return;
    }

    const now = new Date();
    const filesToDelete: string[] = [];

    // 1年以上前のファイルを特定
    for (const blob of blobs) {
      if (!blob.uploadedAt) {
        console.warn(`ファイル ${blob.pathname} にはuploadedAtが設定されていません`);
        continue;
      }

      const uploadedAt = new Date(blob.uploadedAt);
      const ageMs = now.getTime() - uploadedAt.getTime();

      if (ageMs > maxAgeMs) {
        filesToDelete.push(blob.url);
        console.log(`削除対象: ${blob.pathname} (アップロード日: ${uploadedAt.toISOString()})`);
      }
    }

    // 古いファイルを削除
    if (filesToDelete.length > 0) {
      await del(filesToDelete);
      console.log(`${filesToDelete.length} 個の古いファイルを削除しました`);
    } else {
      console.log("1年以上経過したファイルはありません");
    }

  } catch (error) {
    console.error("古いファイルのクリーンアップ中にエラーが発生しました:", {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    // クリーンアップのエラーはアップロード処理を止めないようにする
  }
}

/**
 * Vercel Blob APIを使ってファイルをアップロードし、公開URLを返す
 * アップロード前に1年以上経過したファイルを自動削除する
 * @param {object} params - パラメータオブジェクト
 * @param {Uint8Array} params.fileBuffer - アップロードするファイルのバイナリ
 * @param {string} params.filename - ファイル名
 * @param {string} params.contentType - Content-Type
 * @param {boolean} params.enableCleanup - 古いファイルの削除を有効にするか（デフォルト: true）
 * @param {number} params.maxAgeMs - 削除対象となるファイルの最大年数（デフォルト: 1年）
 * @returns {Promise<string>} 公開URL
 */
export async function uploadToVercelBlob({
  fileBuffer,
  filename,
  contentType,
  enableCleanup = true,
  maxAgeMs = 365 * 24 * 60 * 60 * 1000, // 1年 = 365日 * 24時間 * 60分 * 60秒 * 1000ミリ秒
}: {
  fileBuffer: Uint8Array,
  filename: string,
  contentType: string,
  enableCleanup?: boolean,
  maxAgeMs?: number,
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
      contentType,
      cleanupEnabled: enableCleanup
    });

    // アップロード前に古いファイルをクリーンアップ
    if (enableCleanup) {
      await cleanupOldFiles(maxAgeMs);
    }

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