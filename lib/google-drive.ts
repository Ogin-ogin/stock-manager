import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// サービスアカウント認証でのGoogle Drive操作
export async function uploadToDrive(
  fileBuffer: Uint8Array | Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  try {
    // 環境変数の確認
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientEmail || !privateKey || !folderId) {
      throw new Error('Google Drive credentials are not properly configured');
    }

    console.log('Google Drive認証情報を確認');

    // サービスアカウント認証
    const auth = new JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'), // 改行文字を正しく処理
      scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive'
      ]
    });

    console.log('JWT認証オブジェクトを作成');

    const drive = google.drive({ version: 'v3', auth });

    // ファイルメタデータ
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    console.log('ファイルアップロード開始:', fileName);

    // BufferをBase64に変換してアップロード
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
    
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType,
        body: buffer
      },
      fields: 'id, webViewLink, name'
    });

    console.log('ファイルアップロード完了:', response.data.id);

    if (!response.data.webViewLink || !response.data.id) {
      throw new Error('Failed to get file link from Google Drive response');
    }

    // ファイルを公開設定（誰でも閲覧可能）
    try {
      await drive.permissions.create({
        fileId: response.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      console.log('ファイル公開権限設定完了');
    } catch (permissionError) {
      console.warn('ファイル公開権限設定に失敗（ファイルは正常にアップロードされました）:', permissionError);
    }

    return response.data.webViewLink;

  } catch (error) {
    console.error('Google Drive upload error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      fileName,
      mimeType
    });

    // より詳細なエラー情報を提供
    if (error instanceof Error) {
      if (error.message.includes('credentials')) {
        throw new Error('Google Drive認証情報が正しく設定されていません');
      } else if (error.message.includes('permission')) {
        throw new Error('Google Driveへのアクセス権限がありません');
      } else if (error.message.includes('quota')) {
        throw new Error('Google Driveの容量制限に達しています');
      } else {
        throw new Error(`Google Driveアップロードエラー: ${error.message}`);
      }
    }

    throw new Error('Google Driveへのアップロードに失敗しました');
  }
}

// OAuth2認証でのアップロード機能（必要に応じて使用）
export async function uploadToDriveOAuth(
  fileBuffer: Uint8Array | Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!clientId || !clientSecret || !refreshToken || !folderId) {
      throw new Error('Google Drive OAuth credentials are not properly configured');
    }

    // OAuth2 クライアント作成
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // ファイルメタデータ
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    // BufferをBase64に変換してアップロード
    const buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType,
        body: buffer
      },
      fields: 'id, webViewLink, name'
    });

    if (!response.data.webViewLink || !response.data.id) {
      throw new Error('Failed to get file link from Google Drive response');
    }

    // ファイルを公開設定
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return response.data.webViewLink;

  } catch (error) {
    console.error('Google Drive OAuth upload error:', error);
    throw new Error(`Google Drive OAuthアップロードに失敗しました: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`);
  }
}