<div align="center">
  <img src="assets/logo.svg" alt="Folio Logo" width="120" />
  <h1>Folio</h1>
  <p><strong>A lightning-fast, ultra-minimalist, zero-dependency self-hosted publishing platform.</strong></p>

  [![Website Status](https://img.shields.io/website?url=https%3A%2F%2Ffolio.arinahub.com&style=for-the-badge&label=folio.arinahub.com)](https://folio.arinahub.com)
  [![Go Version](https://img.shields.io/github/go-mod/go-version/adsurkasur/folio?style=for-the-badge&color=00ADD8)](https://github.com/adsurkasur/folio/blob/master/go.mod)
  [![License](https://img.shields.io/github/license/adsurkasur/folio?style=for-the-badge)](https://github.com/adsurkasur/folio/blob/master/LICENSE)
  [![Last Commit](https://img.shields.io/github/last-commit/adsurkasur/folio?style=for-the-badge&color=success)](https://github.com/adsurkasur/folio/commits/master)
</div>

<br>

Folio is designed to be deployed as a single Go binary, offering a distraction-free editorial experience with enterprise-grade security features and a mathematically strict UI design. Inspired by Telegra.ph.

## Why Folio?

In an era of heavy JavaScript frameworks and complex CMS setups, Folio strips publishing down to its absolute essentials:
1. **Title**
2. **Author**
3. **Story**

It requires no user accounts, no databases to configure, and no external dependencies. Despite its simplicity, it is robust enough to handle millions of reads and secure enough to run openly on the public internet.

## Key Features

### Design & UX Philosophy
- **Strict 8-Point Modular Spacing System**: The entire UI is built on a mathematically precise 8-point CSS grid (`--space-1` to `--space-9`), guaranteeing perfect typography and spacing consistency across all viewports.
- **AMOLED-Optimized Dark Mode**: Features a "True Black" (`#000000`) dark mode to save power on OLED screens, automatically adjusting based on the user's `prefers-color-scheme`.
- **Zero Native Popups**: Absolutely no lazy `alert()`, `confirm()`, or `prompt()` calls. Destructive actions (like deleting an article) use smooth, custom-built centered modal overlays.
- **Floating Action Bar (FAB)**: Editing and managing published articles is handled seamlessly via an elegant floating action container at the bottom right.
- **Distraction-Free Canvas**: A pure HTML5 `contenteditable` editor without any heavy third-party WYSIWYG libraries.

### Engineering & Architecture
- **Zero Registration**: Anonymous publishing out of the box. Edit rights are securely managed via a 10-year `HttpOnly` browser cookie and a cryptographic backup token.
- **Single Binary Architecture**: Written entirely in Go. The database is a pure-Go SQLite implementation (`modernc.org/sqlite`) running in WAL mode, and all static assets (HTML/CSS/JS) are embedded (`//go:embed`). No external web server is needed.
- **Universal Link Previews (Open Graph)**: Automatically resizes and compresses the first uploaded image to guarantee perfect link previews (< 300KB) across WhatsApp, X/Twitter, Telegram, LinkedIn, and Discord.
- **Markdown Auto-Format**: Type `# ` to create an H1, `## ` for H2, and `> ` for a blockquote. Format text effortlessly without leaving your keyboard.
- **Local Auto-Save**: Drafts are automatically persisted to the browser's `localStorage` to prevent accidental data loss.

### Safety & Compliance
- **Anti-Spam & Security**:
  - In-memory IP rate limiting (Max 5 articles & 15 image uploads per hour).
  - Strict XSS sanitization (via `bluemonday`) to eliminate malicious script injections.
  - Network payload capping to prevent Denial of Service (OOM) attacks.
- **Storage Garbage Collection**: A silent background worker automatically cleans up orphaned draft images every 24 hours, keeping server disks pristine.
- **Built-in Legal Pages**: Comes pre-configured with minimalist Privacy Policy and Terms of Service templates linked seamlessly in the footer.

## Running Locally

Folio is designed to be effortlessly compiled and run. 

### Prerequisites
- Go 1.22 or higher

### Build & Run
```bash
# 1. Clone the repository
git clone https://github.com/adsurkasur/folio.git
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
