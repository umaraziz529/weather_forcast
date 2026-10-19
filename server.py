import json
import math
import os
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
latest_location = None
location_lock = Lock()


class WeatherRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _respond(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        global latest_location

        if urlsplit(self.path).path != "/api/location":
            self._respond(404, {"error": "Not found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 4096:
                raise ValueError
            payload = json.loads(self.rfile.read(length))
            latitude = payload["latitude"]
            longitude = payload["longitude"]
            accuracy = payload["accuracy"]
            if not all(type(value) in (int, float) and math.isfinite(value)
                       for value in (latitude, longitude, accuracy)):
                raise ValueError
            if not -90 <= latitude <= 90 or not -180 <= longitude <= 180 or accuracy < 0:
                raise ValueError
        except (ValueError, TypeError, KeyError, json.JSONDecodeError):
            self._respond(400, {"error": "Expected valid latitude, longitude, and accuracy values"})
            return

        with location_lock:
            latest_location = {
                "latitude": latitude,
                "longitude": longitude,
                "accuracy": accuracy,
                "received_at": datetime.now(timezone.utc).isoformat(),
            }
        self._respond(202, {"received": True})


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), WeatherRequestHandler)
    print(f"Weather app server listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()