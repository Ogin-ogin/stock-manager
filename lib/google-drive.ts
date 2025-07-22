import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { Readable } from 'stream';  // ← 追加

// Google Drive APIの認証情報
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

interface GoogleDriveConfig {
  clientEmail: string;
  privateKey: string;
  folderId: string;
}

// ✅ Buffer を Readable Stream に変換するヘルパー
function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
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

    // ✅ Buffer を Readable Stream に変換してアップロード
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType,
        body: bufferToStream(fileBuffer)  // ← ここを修正
      },
      fields: 'id, webViewLink'
    });

    if (!response.data.webViewLink || !response.data.id) {
      throw new Error('Failed to get file link');
    }

    // ✅ 公開リンクの権限を設定（リンクを知っている人なら誰でも閲覧可能）
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return response.data.webViewLink;
  } catch (error) {
    console.error('Google Drive upload error:', error);
    throw new Error(`Failed to upload to Google Drive: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`);
  }
}
