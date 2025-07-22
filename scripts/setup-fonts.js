// scripts/setup-fonts.js
// 日本語フォントをダウンロードしてBase64に変換するスクリプト

const fs = require('fs')
const https = require('https')
const path = require('path')

// Noto Sans JP のGoogle Fonts URL（Regular weight）
const FONT_URL = 'https://fonts.gstatic.com/s/notosansjp/v52/O4ZRFGangqxHf-1I48sbnYzA_iXnvn0-0_rYeJSi-WV0.woff2'

async function downloadFont() {
  return new Promise((resolve, reject) => {
    const request = https.get(FONT_URL, (response) => {
      const chunks = []
      
      response.on('data', (chunk) => {
        chunks.push(chunk)
      })
      
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        resolve(buffer)
      })
      
      response.on('error', (error) => {
        reject(error)
      })
    })
    
    request.on('error', (error) => {
      reject(error)
    })
  })
}

async function convertToBase64AndSave() {
  try {
    console.log('Noto Sans JP フォントをダウンロード中...')
    const fontBuffer = await downloadFont()
    
    console.log(`フォントサイズ: ${fontBuffer.length} bytes`)
    
    // Base64に変換
    const base64Font = fontBuffer.toString('base64')
    
    // jp-fonts.ts用のコード生成
    const fontCode = `// 自動生成されたNoto Sans JPフォント（Base64）
// Generated on: ${new Date().toISOString()}
// Font size: ${fontBuffer.length} bytes

export const NOTO_SANS_JP_BASE64 = \`${base64Font}\`;

// 軽量版のためのサブセット作成を推奨
// 使用する文字のみを含むフォントサブセットを作成すると、ファイルサイズを大幅に削減できます
`

    // ファイルに保存
    const outputPath = path.join(__dirname, '../lib/font-data.ts')
    fs.writeFileSync(outputPath, fontCode)
    
    console.log(`フォントをBase64に変換して保存しました: ${outputPath}`)
    console.log(`Base64サイズ: ${base64Font.length} characters`)
    
    // jp-fonts.tsを更新
    await updateJpFonts(base64Font)
    
  } catch (error) {
    console.error('フォント処理エラー:', error)
  }
}

async function updateJpFonts(base64Font) {
  const jpFontsPath = path.join(__dirname, '../lib/jp-fonts.ts')
  
  // 既存のファイルを読み込み
  let content = fs.readFileSync(jpFontsPath, 'utf8')
  
  // Base64データを置換
  const fontDataSection = `// Base64エンコードされた軽量日本語フォント
const NOTO_SANS_JP_BASE64 = \`${base64Font}\``
  
  // 既存のNOTO_SANS_JP_BASE64定義を置換
  content = content.replace(
    /const NOTO_SANS_JP_BASE64 = `[\s\S]*?`/,
    `const NOTO_SANS_JP_BASE64 = \`${base64Font}\``
  )
  
  // ファイルを更新
  fs.writeFileSync(jpFontsPath, content)
  console.log('jp-fonts.tsを更新しました')
}

// サブセットフォント作成のヘルパー関数
function createFontSubset(originalFont, characters) {
  // 実際の実装では、pyftsubset（fonttools）などを使用
  // ここでは概念的な実装のみ
  console.log('フォントサブセットの作成には、pyftsubsetツールの使用を推奨します')
  console.log('コマンド例:')
  console.log('pip install fonttools')
  console.log('pyftsubset font.ttf --text="商品数量発注タイプ者日理由" --output-file=subset.ttf')
}

// スクリプト実行
if (require.main === module) {
  convertToBase64AndSave()
}

module.exports = {
  downloadFont,
  convertToBase64AndSave,
  createFontSubset
}