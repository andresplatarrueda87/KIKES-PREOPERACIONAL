import http.server
import os
import sys
import socketserver

web_dir = os.path.abspath(os.path.dirname(__file__))
os.chdir(web_dir)
port = 8088

class PreopHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    server = http.server.HTTPServer(("", port), PreopHandler)
    print(f"Servidor Kikes Preoperacional corriendo en http://127.0.0.1:{port}", flush=True)
    server.serve_forever()
