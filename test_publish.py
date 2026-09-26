import json, urllib.request

data = json.dumps({
    "title": "Actual Test Title",
    "author_name": "Test Author",
    "content_html": "<p>This is the test body</p>"
}).encode('utf-8')

req = urllib.request.Request(
    "http://localhost:8085/api/articles",
    data=data,
    headers={
        "Content-Type": "application/json",
        "Cookie": "folio_author_token=valid_token_12345"
    }
)

try:
    with urllib.request.urlopen(req) as resp:
        print("STATUS:", resp.status)
        print("RESPONSE:", resp.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code, e.read().decode('utf-8'))
except Exception as e:
    print("ERROR:", e)
