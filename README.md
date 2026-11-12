# 頁匠工具箱

在瀏覽器本機處理的文件與圖片工具：PDF 合併／分割／壓縮／轉圖／浮水印／頁碼／簽名／編輯／標記密文／加密／元數據／調整頁面大小，以及物件畫板與 SVG 轉 PNG。

純靜態網站，沒有後端，也不需要建置步驟。

## 在自己的電腦上執行

需要 Python 3（Windows 可從 python.org 或 Microsoft Store 安裝）。

- Windows：雙擊 `start.bat`，瀏覽器會自動開啟 http://localhost:8080
- macOS／Linux：執行 `./start.sh`

預設只有這台電腦能連。直接雙擊 `index.html` 無法使用，瀏覽器不允許用這種方式載入模組。

### 讓其他裝置連進來（區域網路或 IPv6）

    python serve.py --lan

其他裝置用這台電腦的位址連線，IPv6 位址要加方括號，例如 `http://[2001:db8::1234]:8080`。
記得在防火牆（以及路由器的 IPv6 防火牆）放行這個連接埠。

這種方式是 HTTP。瀏覽器在非 HTTPS 的網址下會停用部分功能，**「PDF 加密」無法使用**，其餘工具正常。
`serve.py` 是簡易伺服器，適合自己或家裡的裝置使用，長期對外公開請用下面的 Caddy。

### 對外公開（HTTPS）

HTTPS 憑證要綁網域，所以需要一個指向這台電腦 IPv6 位址的網域名稱（DNS 的 AAAA 記錄）。

1. 安裝 [Caddy](https://caddyserver.com/download)（單一執行檔）。
2. 把 `Caddyfile` 裡的 `tool.example.com` 換成你的網域。
3. 防火牆放行 80 與 443 連接埠。
4. 在這個資料夾執行 `caddy run`，Caddy 會自動申請並續期憑證。

只有 IPv6 的話，沒有 IPv6 的訪客（部分行動網路、公司網路）會連不上。

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
