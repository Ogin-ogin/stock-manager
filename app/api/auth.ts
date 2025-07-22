// pages/api/auth.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const scopes = ['https://www.googleapis.com/auth/drive.file'];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // ✅ refresh_token を得るため必須
    prompt: 'consent',      // ✅ 毎回refresh_tokenを返すよう強制
    scope: scopes,
  });

  res.redirect(url);
}
