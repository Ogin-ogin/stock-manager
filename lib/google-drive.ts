import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  folderId: string;
}

// Buffer → Readable Stream
function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

export async function uploadToDriveOAuth(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  try {
    const config: GoogleDriveConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
      refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
      folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || ''
    };

    if (!config.clientId || !config.clientSecret || !config.refreshToken || !config.folderId) {
      throw new Error('Google Drive OAuth credentials are not properly configured');
    }

    // OAuth2 クライアント作成
    const oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    oauth2Client.setCredentials({ refresh_token: config.refreshToken });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // メタデータ
    const fileMetadata = {
      name: fileName,
      parents: [config.folderId]
    };

    // アップロード
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: {
        mimeType,
        body: bufferToStream(fileBuffer)
      },
      fields: 'id, webViewLink'
    });

    if (!response.data.webViewLink || !response.data.id) {
      throw new Error('Failed to get file link');
    }

    // 公開権限設定
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
