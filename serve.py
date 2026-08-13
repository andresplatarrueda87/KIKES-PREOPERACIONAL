import http.server
import os
import urllib.parse
import sys

web_dir = os.path.dirname(os.path.realpath(__file__))
os.chdir(web_dir)
port = 8086

class PreopHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = urllib.parse.unquote(path)
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        return super().translate_path(path)

if __name__ == '__main__':
    try:
        http.server.ThreadingHTTPServer.allow_reuse_address = True
        server = http.server.ThreadingHTTPServer(("0.0.0.0", port), PreopHandler)
        print(f"Servidor Kikes Preoperacional corriendo en http://127.0.0.1:{port}", flush=True)
        server.serve_forever()
    except Exception as e:
        print(f"Error al iniciar servidor: {e}", flush=True)
