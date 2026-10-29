import http.server
import os
import socketserver

PORT = int(os.environ.get("PORT", 3000))
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST, **kwargs)

    def do_GET(self):
        if not os.path.exists(self.translate_path(self.path)):
            self.path = "/index.html"
        return super().do_GET()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as server:
    print(f"EchoScribe running on port {PORT}")
    server.serve_forever()