#!/usr/bin/env python3
"""无缓存HTTP服务器"""
import http.server, socketserver, sys

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8090
with socketserver.TCPServer(("", port), NoCacheHandler) as httpd:
    print(f"Serving on port {port} (no-cache)")
    httpd.serve_forever()
