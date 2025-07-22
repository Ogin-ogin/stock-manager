// route.ts の一部を修正（Google Driveアップロードを無効化）

// PDFバッファ生成後の処理を以下に置き換え
try {
  // PDFをバッファに変換
  console.log('PDFバッファの生成を開始');
  const buffer = doc.output('arraybuffer');
  console.log('PDFバッファのサイズ:', buffer.byteLength);
  const pdfBuffer = Buffer.from(buffer);
  console.log('Buffer変換後のサイズ:', pdfBuffer.length);

  // Google Drive アップロードを一時的に無効化
  const skipGoogleDrive = true; // テスト用フラグ

  if (!skipGoogleDrive) {
    // Google Driveにアップロード（元のコード）
    let driveUrl: string;
    try {
      console.log('Google Drive処理を開始');
      const { uploadToDrive } = await import("@/lib/google-drive");
      driveUrl = await uploadToDrive(pdfBuffer, filename, contentType);
      console.log('Google Driveへのアップロード完了:', driveUrl);
    } catch (driveError) {
      console.error('Google Drive処理エラー:', driveError);
      throw driveError;
    }

    // Slack通知（Google Drive URL付き）
    const slackToken = process.env.SLACK_BOT_TOKEN
    const slackChannel = process.env.SLACK_CHANNEL_ID

    if (slackToken && slackChannel) {
      const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${slackToken}`
        },
        body: JSON.stringify({
          channel: slackChannel,
          text: `注文書PDFを出力しました (${targetOrders.length}件)\nGoogle Drive: ${driveUrl}`,
          unfurl_links: true
        })
      })
      
      const slackData = await slackRes.json()
      if (!slackData.ok) {
        console.error("Slackメッセージ送信エラー:", slackData.error)
      }
    }
  } else {
    // Google Drive無しでSlack通知のみ
    console.log('Google Drive アップロードをスキップします');
    
    const slackToken = process.env.SLACK_BOT_TOKEN
    const slackChannel = process.env.SLACK_CHANNEL_ID

    if (slackToken && slackChannel) {
      const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${slackToken}`
        },
        body: JSON.stringify({
          channel: slackChannel,
          text: `注文書PDFを出力しました (${targetOrders.length}件)\nファイルはダウンロードで取得してください。`,
        })
      })
      
      const slackData = await slackRes.json()
      if (!slackData.ok) {
        console.error("Slackメッセージ送信エラー:", slackData.error)
      } else {
        console.log("Slack通知送信成功")
      }
    }
  }

  // PDFをダウンロードとして返す
  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    }
  })

} catch (error) {
  console.error("ファイル処理エラー:", error)
  throw new Error(`ファイル処理に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
}