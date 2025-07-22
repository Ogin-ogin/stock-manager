/**
 * SlackファイルアップロードAPIを使ってExcelファイルをアップロードする
 * @param {Buffer|Uint8Array} fileBuffer - アップロードするExcelファイルのバイナリデータ
 * @param {string} filename - ファイル名（.xlsx拡張子）
 * @param {string} channels - アップロード先チャンネルID（カンマ区切り可）
 * @param {string} token - Slack Bot User OAuth Token
 * @param {string} [initialComment] - ファイルに添えるコメント
 * @returns {Promise<any>} Slack APIレスポンス
 */
export async function uploadExcelFileToSlack({
  fileBuffer,
  filename,
  channels,
  token,
  initialComment,
}: {
  fileBuffer: Buffer | Uint8Array;
  filename: string;
  channels: string;
  token: string;
  initialComment?: string;
}): Promise<any> {
  try {
    // 入力値の検証
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('ファイルバッファが空です');
    }

    if (!filename.toLowerCase().endsWith('.xlsx')) {
      throw new Error('Excelファイル（.xlsx）のみサポートされています');
    }

    if (!channels || !token) {
      throw new Error('チャンネルIDとトークンは必須です');
    }

    console.log('Slackファイルアップロード開始:', {
      filename,
      fileSize: fileBuffer.length,
      channels
    });

    // FormDataを作成
    const formData = new FormData();
    
    // BufferまたはUint8ArrayをBlobに変換
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });

    formData.append('file', blob, filename);
    formData.append('filename', filename);
    formData.append('channels', channels);
    
    if (initialComment) {
      formData.append('initial_comment', initialComment);
    }

    // Slack APIにアップロード
    const response = await fetch('https://slack.com/api/files.upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    console.log('Slackアップロードレスポンス:', {
      ok: data.ok,
      fileId: data.file?.id,
      fileName: data.file?.name,
      error: data.error
    });

    if (!data.ok) {
      throw new Error(data.error || 'Slackファイルアップロードに失敗しました');
    }

    console.log('Excelファイルのアップロードが完了しました:', filename);
    return data;

  } catch (error) {
    console.error('Slackファイルアップロードエラー:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      filename,
      channels,
      fileSize: fileBuffer?.length || 0
    });

    // より詳細なエラー情報を提供
    if (error instanceof Error) {
      if (error.message.includes('invalid_auth')) {
        throw new Error('Slackトークンが無効です');
      } else if (error.message.includes('channel_not_found')) {
        throw new Error('指定されたSlackチャンネルが見つかりません');
      } else if (error.message.includes('file_too_large')) {
        throw new Error('ファイルサイズが大きすぎます');
      } else if (error.message.includes('rate_limited')) {
        throw new Error('Slack APIの制限に達しました。しばらく待ってから再試行してください');
      } else {
        throw new Error(`Slackアップロードエラー: ${error.message}`);
      }
    }

    throw new Error('Slackへのファイルアップロードに失敗しました');
  }
}

/**
 * Slackにシンプルなメッセージを送信する
 * @param {string} message - 送信するメッセージ
 * @param {string} channels - 送信先チャンネルID
 * @param {string} token - Slack Bot User OAuth Token
 * @returns {Promise<any>} Slack APIレスポンス
 */
export async function sendSlackMessage({
  message,
  channels,
  token,
}: {
  message: string;
  channels: string;
  token: string;
}): Promise<any> {
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel: channels,
        text: message,
        unfurl_links: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.error || 'Slackメッセージ送信に失敗しました');
    }

    console.log('Slackメッセージ送信完了');
    return data;

  } catch (error) {
    console.error('Slackメッセージ送信エラー:', error);
    throw new Error(`Slackメッセージ送信に失敗しました: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`);
  }
}

// 後方互換性のための関数名エイリアス（既存コードとの互換性維持）
export const uploadFileToSlack = uploadExcelFileToSlack;