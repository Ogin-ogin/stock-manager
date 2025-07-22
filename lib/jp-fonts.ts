import { jsPDF } from 'jspdf'

// Base64エンコードされた軽量日本語フォント
// 注意: 実際の使用時は setup-fonts.js を実行してフォントデータを設定してください
const NOTO_SANS_JP_BASE64 = `PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ZW4+CiAgPG1ldGEgY2hhcnNldD11dGYtOD4KICA8bWV0YSBuYW1lPXZpZXdwb3J0IGNvbnRlbnQ9ImluaXRpYWwtc2NhbGU9MSwgbWluaW11bS1zY2FsZT0xLCB3aWR0aD1kZXZpY2Utd2lkdGgiPgogIDx0aXRsZT5FcnJvciA0MDQgKE5vdCBGb3VuZCkhITE8L3RpdGxlPgogIDxzdHlsZT4KICAgICp7bWFyZ2luOjA7cGFkZGluZzowfWh0bWwsY29kZXtmb250OjE1cHgvMjJweCBhcmlhbCxzYW5zLXNlcmlmfWh0bWx7YmFja2dyb3VuZDojZmZmO2NvbG9yOiMyMjI7cGFkZGluZzoxNXB4fWJvZHl7bWFyZ2luOjclIGF1dG8gMDttYXgtd2lkdGg6MzkwcHg7bWluLWhlaWdodDoxODBweDtwYWRkaW5nOjMwcHggMCAxNXB4fSogPiBib2R5e2JhY2tncm91bmQ6dXJsKC8vd3d3Lmdvb2dsZS5jb20vaW1hZ2VzL2Vycm9ycy9yb2JvdC5wbmcpIDEwMCUgNXB4IG5vLXJlcGVhdDtwYWRkaW5nLXJpZ2h0OjIwNXB4fXB7bWFyZ2luOjExcHggMCAyMnB4O292ZXJmbG93OmhpZGRlbn1pbnN7Y29sb3I6Izc3Nzt0ZXh0LWRlY29yYXRpb246bm9uZX1hIGltZ3tib3JkZXI6MH1AbWVkaWEgc2NyZWVuIGFuZCAobWF4LXdpZHRoOjc3MnB4KXtib2R5e2JhY2tncm91bmQ6bm9uZTttYXJnaW4tdG9wOjA7bWF4LXdpZHRoOm5vbmU7cGFkZGluZy1yaWdodDowfX0jbG9nb3tiYWNrZ3JvdW5kOnVybCgvL3d3dy5nb29nbGUuY29tL2ltYWdlcy9icmFuZGluZy9nb29nbGVsb2dvLzF4L2dvb2dsZWxvZ29fY29sb3JfMTUweDU0ZHAucG5nKSBuby1yZXBlYXQ7bWFyZ2luLWxlZnQ6LTVweH1AbWVkaWEgb25seSBzY3JlZW4gYW5kIChtaW4tcmVzb2x1dGlvbjoxOTJkcGkpeyNsb2dve2JhY2tncm91bmQ6dXJsKC8vd3d3Lmdvb2dsZS5jb20vaW1hZ2VzL2JyYW5kaW5nL2dvb2dsZWxvZ28vMngvZ29vZ2xlbG9nb19jb2xvcl8xNTB4NTRkcC5wbmcpIG5vLXJlcGVhdCAwJSAwJS8xMDAlIDEwMCU7LW1vei1ib3JkZXItaW1hZ2U6dXJsKC8vd3d3Lmdvb2dsZS5jb20vaW1hZ2VzL2JyYW5kaW5nL2dvb2dsZWxvZ28vMngvZ29vZ2xlbG9nb19jb2xvcl8xNTB4NTRkcC5wbmcpIDB9fUBtZWRpYSBvbmx5IHNjcmVlbiBhbmQgKC13ZWJraXQtbWluLWRldmljZS1waXhlbC1yYXRpbzoyKXsjbG9nb3tiYWNrZ3JvdW5kOnVybCgvL3d3dy5nb29nbGUuY29tL2ltYWdlcy9icmFuZGluZy9nb29nbGVsb2dvLzJ4L2dvb2dsZWxvZ29fY29sb3JfMTUweDU0ZHAucG5nKSBuby1yZXBlYXQ7LXdlYmtpdC1iYWNrZ3JvdW5kLXNpemU6MTAwJSAxMDAlfX0jbG9nb3tkaXNwbGF5OmlubGluZS1ibG9jaztoZWlnaHQ6NTRweDt3aWR0aDoxNTBweH0KICA8L3N0eWxlPgogIDxhIGhyZWY9Ly93d3cuZ29vZ2xlLmNvbS8+PHNwYW4gaWQ9bG9nbyBhcmlhLWxhYmVsPUdvb2dsZT48L3NwYW4+PC9hPgogIDxwPjxiPjQwNC48L2I+IDxpbnM+VGhhdOKAmXMgYW4gZXJyb3IuPC9pbnM+CiAgPHA+VGhlIHJlcXVlc3RlZCBVUkwgPGNvZGU+L3Mvbm90b3NhbnNqcC92NTIvTzRaUkZHYW5ncXhIZi0xSTQ4c2JuWXpBX2lYbnZuMC0wX3JZZUpTaS1XVjAud29mZjI8L2NvZGU+IHdhcyBub3QgZm91bmQgb24gdGhpcyBzZXJ2ZXIuICA8aW5zPlRoYXTigJlzIGFsbCB3ZSBrbm93LjwvaW5zPgo=`

// 代替案: CDNからフォントを動的に読み込む場合
let FONT_LOADED = false
let FONT_BASE64_DATA = ''

// よく使用される日本語文字のサブセット（PDF表示用の最小セット）
const COMMON_JAPANESE_CHARS = '商品数量発注タイプ者日理由出力済み未自動手動注文書総件ページ時分秒年月'

/**
 * 動的にフォントを読み込む関数（代替案）
 * @param fontUrl フォントファイルのURL
 */
export async function loadFontFromUrl(fontUrl: string): Promise<string> {
  try {
    const response = await fetch(fontUrl)
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    FONT_BASE64_DATA = base64
    FONT_LOADED = true
    return base64
  } catch (error) {
    console.error('フォント読み込みエラー:', error)
    throw error
  }
}

/**
 * Google FontsからNoto Sans JPを直接読み込む関数
 */
export async function loadNotoSansJPFromGoogle(): Promise<boolean> {
  try {
    console.log('Google FontsからNoto Sans JPを読み込み中...')
    
    // Google Fonts APIからフォントURLを取得
    const cssResponse = await fetch('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400&display=swap')
    const cssText = await cssResponse.text()
    
    // CSSからフォントファイルのURLを抽出
    const fontUrlMatch = cssText.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)
    
    if (!fontUrlMatch) {
      throw new Error('フォントURLの抽出に失敗しました')
    }
    
    const fontUrl = fontUrlMatch[1]
    console.log('フォントURL:', fontUrl)
    
    // フォントファイルを読み込み
    await loadFontFromUrl(fontUrl)
    console.log('Google FontsからのNoto Sans JP読み込み完了')
    
    return true
  } catch (error) {
    console.error('Google Fontsからの読み込みエラー:', error)
    return false
  }
}

/**
 * jsPDFに日本語フォントを追加する関数
 * @param doc jsPDFインスタンス
 */
export async function addJapaneseFont(doc: jsPDF): Promise<boolean> {
  // 動的に読み込まれたフォントまたは静的なフォントを使用
  let fontData = FONT_BASE64_DATA || NOTO_SANS_JP_BASE64
  
  // フォントデータがない場合、Google Fontsから読み込みを試行
  if (!fontData || !fontData.trim()) {
    console.log('フォントデータがありません。Google Fontsから読み込みを試行...')
    const loaded = await loadNotoSansJPFromGoogle()
    if (loaded) {
      fontData = FONT_BASE64_DATA
    }
  }
  
  if (fontData && fontData.trim()) {
    try {
      doc.addFileToVFS('NotoSansJP-Regular.ttf', fontData)
      doc.addFont('NotoSansJP-Regular.ttf', 'NotoSansJP', 'normal')
      console.log('日本語フォント追加成功')
      return true
    } catch (error) {
      console.error('フォント追加エラー:', error)
      return false
    }
  }
  
  console.warn('日本語フォントが利用できません')
  return false
}

/**
 * 日本語対応フォントを設定する関数
 * @param doc jsPDFインスタンス
 * @param fontSize フォントサイズ
 */
export function setJapaneseFont(doc: jsPDF, fontSize: number = 10): void {
  const fontData = FONT_BASE64_DATA || NOTO_SANS_JP_BASE64
  
  if (fontData && fontData.trim()) {
    try {
      doc.setFont('NotoSansJP', 'normal')
    } catch {
      // フォント設定に失敗した場合はfallback
      console.warn('日本語フォント設定に失敗、標準フォントを使用')
      doc.setFont('helvetica', 'normal')
    }
  } else {
    // フォールバック: 標準フォントを使用
    console.warn('日本語フォントが利用できません、標準フォントを使用')
    doc.setFont('helvetica', 'normal')
  }
  doc.setFontSize(fontSize)
}

/**
 * テキストの幅を計算する関数（日本語対応）
 * @param doc jsPDFインスタンス
 * @param text テキスト
 * @returns テキストの幅
 */
export function getTextWidth(doc: jsPDF, text: string): number {
  return doc.getTextWidth(text)
}

/**
 * 指定幅でテキストを分割する関数
 * @param doc jsPDFインスタンス
 * @param text テキスト
 * @param maxWidth 最大幅
 * @returns 分割されたテキスト配列
 */
export function splitText(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth)
}

/**
 * 日本語文字を考慮したテキスト長さ計算
 * @param text テキスト
 * @returns 表示上の文字数（全角文字は2、半角文字は1として計算）
 */
export function getDisplayLength(text: string): number {
  let length = 0
  for (const char of text) {
    // 日本語文字（ひらがな、カタカナ、漢字）、全角記号を2文字分として計算
    const charLength = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uFF00-\uFFEF]/.test(char) ? 2 : 1
    length += charLength
  }
  return length
}

/**
 * 指定の表示長さでテキストを切り詰める関数
 * @param text テキスト
 * @param maxDisplayLength 最大表示長さ
 * @returns 切り詰められたテキスト
 */
export function truncateByDisplayLength(text: string, maxDisplayLength: number): string {
  if (!text) return ''
  
  let length = 0
  let result = ''
  
  for (const char of text) {
    const charLength = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uFF00-\uFFEF]/.test(char) ? 2 : 1
    if (length + charLength > maxDisplayLength) {
      break
    }
    result += char
    length += charLength
  }
  
  return result
}

/**
 * フォントが利用可能かチェックする関数
 */
export function isJapaneseFontAvailable(): boolean {
  const fontData = FONT_BASE64_DATA || NOTO_SANS_JP_BASE64
  return fontData.trim().length > 0 || FONT_LOADED
}

// フォント設定のプリセット
export const FONT_PRESETS = {
  TITLE: { size: 16, weight: 'bold' },
  HEADER: { size: 12, weight: 'bold' },
  BODY: { size: 10, weight: 'normal' },
  SMALL: { size: 8, weight: 'normal' },
  CAPTION: { size: 7, weight: 'normal' }
} as const

/**
 * プリセットを使用してフォントを設定する関数
 * @param doc jsPDFインスタンス
 * @param preset フォントプリセット
 */
export function setFontPreset(doc: jsPDF, preset: keyof typeof FONT_PRESETS): void {
  const config = FONT_PRESETS[preset]
  setJapaneseFont(doc, config.size)
  
  if (config.weight === 'bold' && isJapaneseFontAvailable()) {
    // 日本語フォントがある場合はboldスタイルを試行
    try {
      doc.setFont('NotoSansJP', 'bold')
    } catch {
      // boldがない場合は通常フォントを使用
      doc.setFont('NotoSansJP', 'normal')
    }
  }
}

/**
 * PDF用のテキスト前処理関数
 * @param text 処理するテキスト
 * @param maxLength 最大文字数
 * @returns 処理されたテキスト
 */
export function prepareTextForPDF(text: string, maxLength?: number): string {
  if (!text) return ''
  
  // 改行文字をスペースに置換
  let processed = text.replace(/[\r\n]+/g, ' ')
  
  // 連続するスペースを1つに集約
  processed = processed.replace(/\s+/g, ' ')
  
  // 前後の空白を除去
  processed = processed.trim()
  
  // 文字数制限がある場合は切り詰め
  if (maxLength && maxLength > 0) {
    processed = truncateByDisplayLength(processed, maxLength)
  }
  
  return processed
}

/**
 * デバッグ用: フォント情報を出力
 * @param doc jsPDFインスタンス
 */
export function debugFontInfo(doc: jsPDF): void {
  console.log('=== フォント情報 ===')
  console.log('利用可能フォント:', doc.getFontList())
  console.log('現在のフォント:', doc.getFont())
  console.log('日本語フォント利用可能:', isJapaneseFontAvailable())
  console.log('フォントデータサイズ:', FONT_BASE64_DATA.length || NOTO_SANS_JP_BASE64.length)
}