# 頁匠工具箱

免費、免註冊的 PDF 與圖片工具。所有檔案只在你的瀏覽器裡處理，不會上傳到任何伺服器。

**線上使用：<https://shiaw87.github.io/tool/>**

## 工具

| 分組 | 工具 | 用途 |
|---|---|---|
| PDF | 分割、合併 PDF | 合併多個 PDF 或圖片，調整頁面順序，旋轉、刪除、插入空白頁，依頁碼範圍或逐頁分割 |
| PDF | 浮水印 | 加上文字或圖片浮水印 |
| PDF | PDF 轉灰階 | 把彩色 PDF 變成黑白灰階 |
| 壓縮與轉換 | 壓縮 PDF 與圖片 | 縮小 PDF、JPG、PNG、WebP，可和原檔左右對照 |
| 壓縮與轉換 | 格式轉換 | PDF 轉圖片，JPG、PNG、WebP 互轉 |
| 圖片 | 去背景 | 把單色背景變成透明 |
| 圖片 | 物件畫板 | 在圖片上加文字、圖形、箭頭與筆跡，可裁剪 |
| 圖片 | SVG 轉 PNG | 把 SVG 轉成高解析度 PNG |

## 本機執行

這是純靜態網站，沒有建置步驟。因為使用了 JavaScript 模組，需要透過 HTTP 開啟，直接雙擊 `index.html` 無法使用：

    python -m http.server 8000

然後開啟 <http://localhost:8000>。

## 第三方元件

- [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1（MIT）
- [PDF.js](https://github.com/mozilla/pdf.js) 6.2.108（Apache-2.0）
- [JSZip](https://github.com/Stuk/jszip) 3.10.1（MIT）

授權全文在 `vendor/licenses/`。字型由 Google Fonts 載入：Noto Sans TC、Noto Serif TC、LXGW WenKai TC（SIL OFL）。
