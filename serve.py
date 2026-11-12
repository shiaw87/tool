#!/usr/bin/env python3
"""頁匠工具箱的本機伺服器（只用 Python 內建模組）。

    python serve.py            只給這台電腦用   http://localhost:8080
    python serve.py --lan      區域網路或 IPv6 的其他裝置也能連（僅 HTTP）
    python serve.py --port 9000

要對外公開請改用 Caddy（見 README），因為需要 HTTPS。
"""
import argparse, functools, http.server, os, socket

ROOT = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".mjs": "text/javascript", ".js": "text/javascript"}
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()
    def list_directory(self, path):          # 不列出資料夾內容
        self.send_error(404); return None
    def send_head(self):                      # 不提供 .git 等隱藏檔
        if any(p.startswith(".") for p in self.path.split("?")[0].split("/") if p):
            self.send_error(404); return None
        return super().send_head()

class DualStack(http.server.ThreadingHTTPServer):
    address_family = socket.AF_INET6
    def server_bind(self):
        try: self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)   # 同時接受 IPv4 與 IPv6
        except OSError: pass
        super().server_bind()

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8080)
    ap.add_argument("--lan", action="store_true", help="允許其他裝置連線")
    a = ap.parse_args()
    handler = functools.partial(Handler, directory=ROOT)
    if a.lan:
        try: srv = DualStack(("::", a.port), handler)
        except OSError: srv = http.server.ThreadingHTTPServer(("0.0.0.0", a.port), handler)   # 這台電腦沒有 IPv6
        print(f"頁匠工具箱：http://localhost:{a.port}  （其他裝置請用這台電腦的 IP，IPv6 寫成 http://[位址]:{a.port}）")
    else:
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", a.port), handler)
        print(f"頁匠工具箱：http://localhost:{a.port}  （只有這台電腦能連）")
    print("按 Ctrl+C 停止")
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
