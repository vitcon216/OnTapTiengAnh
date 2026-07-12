import http.server
import socketserver
import json
import os

PORT = 8081
DATA_FILE = os.path.join("data", "words.json")

class SaveHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header("Access-Control-Allow-Headers", "X-Requested-With, Content-type")
        self.end_headers()

    def do_POST(self):
        if self.path == '/save':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            with open(DATA_FILE, 'wb') as f:
                f.write(post_data)
                
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b"Saved successfully")
            
            print(f"✅ Đã lưu {content_length} bytes vào {DATA_FILE}")
            
            # Tắt server sau khi lưu xong
            def kill_server():
                httpd.shutdown()
            import threading
            threading.Thread(target=kill_server).start()

with socketserver.TCPServer(("", PORT), SaveHandler) as httpd:
    print(f"🚀 Save server is running on port {PORT}...")
    httpd.serve_forever()
