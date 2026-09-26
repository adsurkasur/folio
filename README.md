# Folio

Folio is a lightning-fast, ultra-minimalist, and zero-dependency self-hosted publishing platform inspired by Telegra.ph. It is designed to be deployed as a single Go binary, offering a distraction-free editorial experience with enterprise-grade security features.

## Why Folio?

In an era of heavy JavaScript frameworks and complex CMS setups, Folio strips publishing down to its absolute essentials:
1. **Title**
2. **Author**
3. **Story**

It requires no user accounts, no databases to configure, and no external dependencies. Despite its simplicity, it is robust enough to handle millions of reads and secure enough to run openly on the public internet.

## Key Features

- **Distraction-Free Canvas**: A pure HTML5 `contenteditable` editor without any heavy third-party WYSIWYG libraries.
- **Zero Registration**: Anonymous publishing out of the box. Edit rights are securely managed via a 10-year `HttpOnly` browser cookie and a cryptographic backup token.
- **Single Binary Architecture**: Written entirely in Go. The database is a pure-Go SQLite implementation (`modernc.org/sqlite`) running in WAL mode, and all static assets (HTML/CSS/JS) are embedded (`//go:embed`). No external web server is needed.
- **Universal Link Previews (Open Graph)**: Automatically resizes and compresses the first uploaded image to guarantee perfect link previews (< 300KB) across WhatsApp, X/Twitter, Telegram, LinkedIn, and Discord.
- **Markdown Auto-Format**: Type `# ` to create an H1, `## ` for H2, and `> ` for a blockquote. Format text effortlessly without leaving your keyboard.
- **Local Auto-Save**: Drafts are automatically persisted to the browser's `localStorage` to prevent accidental data loss.
- **Anti-Spam & Security**:
  - In-memory IP rate limiting (Max 5 articles & 15 image uploads per hour).
  - Strict XSS sanitization (via `bluemonday`) to eliminate malicious script injections.
  - Network payload capping to prevent Denial of Service (OOM) attacks.
- **Storage Garbage Collection**: A silent background worker automatically cleans up orphaned draft images every 24 hours, keeping server disks pristine.

## Running Locally

Folio is designed to be effortlessly compiled and run. 

### Prerequisites
- Go 1.22 or higher

### Build & Run
```bash
# 1. Clone the repository
git clone https://github.com/your-username/folio.git
cd folio

# 2. Download dependencies
go mod tidy

# 3. Build the binary
go build -o folio main.go

# 4. Run the application
./folio -port 8085
```
Visit `http://localhost:8085` in your browser.

## Deployment Guide (Production)

Folio is optimized for deployment on Linux servers (e.g., Ubuntu) and pairs perfectly with **Cloudflare Tunnels (cloudflared)**, eliminating the need for Nginx or Certbot.

### 1. Transfer to Server
Compile the binary for Linux and transfer it to your server:
```bash
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o folio-linux ./main.go
scp folio-linux user@your-server-ip:/opt/folio/folio
```

### 2. Setup Systemd Service
Create a service file at `/etc/systemd/system/folio.service`:
```ini
[Unit]
Description=Folio Minimalist Publishing Platform
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/folio
ExecStart=/opt/folio/folio -port 8085
Restart=on-failure
RestartSec=5
# Set your public domain here for Open Graph tags
Environment=BASE_URL=https://folio.yourdomain.com

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now folio
```

### 3. Expose via Cloudflare Tunnel
Instead of exposing ports, use a secure tunnel:
```bash
cloudflared tunnel create folio
cloudflared tunnel route dns folio folio.yourdomain.com
cloudflared tunnel run folio
```
In your Cloudflare dashboard, route the tunnel to `http://localhost:8085`.

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.
