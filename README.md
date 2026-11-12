# 頁匠工具箱

在瀏覽器本機處理的文件與圖片工具：PDF 合併／分割／組織、浮水印、頁碼、調整頁面大小、壓縮、轉圖片、圖像抽取，以及物件畫板與 SVG 轉 PNG。

純靜態網站，沒有後端，也不需要建置步驟。

## 本機預覽

需要透過 HTTP 開啟（直接雙擊 `index.html` 無法使用，瀏覽器不允許用這種方式載入模組）。有 Python 3 的話，在這個資料夾執行：

    python -m http.server 8000

然後開啟 http://localhost:8000

## 部署到 GitHub Pages

1. 建立一個 repository，把這個資料夾的所有檔案（含 `vendor/` 與 `.nojekyll`）推上去。
2. 到 Settings → Pages，Source 選 `Deploy from a branch`，分支選 `main`、資料夾選 `/ (root)`。
3. 自訂網域：在同一頁的 Custom domain 填入網域，並依指示設定 DNS。

所有路徑都是相對路徑，放在子路徑（例如 `username.github.io/yejiang/`）也能運作。

## 第三方元件

- pdf-lib 1.17.1（MIT）
- pdf.js / pdfjs-dist 6.2.108（Apache-2.0）
- JSZip 3.10.1（MIT）

授權全文在 `vendor/licenses/`。字型由 Google Fonts 載入（Noto Sans TC、Noto Serif TC、LXGW WenKai TC，皆為 SIL OFL）。
