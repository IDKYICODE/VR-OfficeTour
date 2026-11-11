"""Dev server: static files on 127.0.0.1:8080 plus POST /save?name=<file> which writes to
assets/tex/ (used once by ?bake=1 to freeze the generated textures). Localhost only."""
import http.server, os, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_POST(self):
        q = urllib.parse.urlparse(self.path)
        names = urllib.parse.parse_qs(q.query).get('name')
        if q.path != '/save' or not names:
            return self.send_error(404)
        name = os.path.basename(names[0])  # no path traversal
        data = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        os.makedirs('assets/tex', exist_ok=True)
        with open(os.path.join('assets/tex', name), 'wb') as f:
            f.write(data)
        self.send_response(204)
        self.end_headers()

http.server.ThreadingHTTPServer(('127.0.0.1', 8080), H).serve_forever()
