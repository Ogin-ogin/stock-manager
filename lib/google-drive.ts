import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

// Google Drive APIの認証情報
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

interface GoogleDriveConfig {
  clientEmail: string;
  privateKey: string;
  folderId: string;
}

export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  try {
    const config: GoogleDriveConfig = {
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
      privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || ''
    };

    if (!config.clientEmail || !config.privateKey || !config.folderId) {
      throw new Error('Google Drive credentials are not properly configured');
    }

    // JWTクライアントの作成
    const auth = new JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: SCOPES,
    });

    const drive = google.drive({ version: 'v3', auth });

    // ファイルのメタデータ
    const fileMetadata = {
      name: fileName,
      parents: [config.folderId]
    };

    // アップロードの実行
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType: mimeType,
        body: Buffer.from(fileBuffer)
      },
      fields: 'id, webViewLink'
    });

    if (!response.data.webViewLink) {
      throw new Error('Failed to get file link');
    }

    // ファイルの権限を設定（リンクを知っている人なら誰でも閲覧可能）
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return response.data.webViewLink;
  } catch (error) {
    console.error('Google Drive upload error:', error);
    throw new Error(`Failed to upload to Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
