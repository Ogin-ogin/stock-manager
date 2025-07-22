// pages/api/oauth2callback.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code } = req.query;

  if (!code || typeof code !== 'string') {
    res.status(400).send('Code not found');
    return;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);

    console.log('✅ REFRESH TOKEN:', tokens.refresh_token);

    res.status(200).send(
      'Authentication successful! Check your server logs for the refresh token. Save it in your .env and delete this route.'
    );
  } catch (error) {
    console.error('Error retrieving access token', error);
    res.status(500).send('Error retrieving access token');
  }
}
