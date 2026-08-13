import http.server
import os
import urllib.parse
import sys
import mimetypes

web_dir = os.path.dirname(os.path.realpath(__file__))
os.chdir(web_dir)
port = 8088

mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('application/json', '.json')
mimetypes.add_type('image/png', '.png')
mimetypes.add_type('image/svg+xml', '.svg')

class PreopHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=web_dir, **kwargs)

    def translate_path(self, path):
        path = urllib.parse.unquote(path)
        path = path.split('?', 1)[0]
        path = path.split('#', 1)[0]
        return super().translate_path(path)

if __name__ == '__main__':
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer(("", port), PreopHandler) as httpd:
        print(f"Serving KIKES PREOPERACIONAL at http://127.0.0.1:{port}")
        sys.stdout.flush()
        httpd.serve_forever()
