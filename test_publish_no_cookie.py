import json, urllib.request

data = json.dumps({
    "title": "Publish Without Cookie Test",
    "author_name": "Test Author",
    "content_html": "<p>Content without cookie</p>"
}).encode('utf-8')

req = urllib.request.Request(
    "http://localhost:8085/api/articles",
    data=data,
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        print("STATUS:", resp.status)
        print("RESPONSE:", resp.read().decode('utf-8'))
        print("SET-COOKIE:", resp.headers.get('Set-Cookie'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print("ERROR:", e)
