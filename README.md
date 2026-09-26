<div align="center">
  <img src="assets/logo.svg" alt="Folio Logo" width="100" />
  <h1>Folio</h1>
  <p>A minimalist, zero-dependency self-hosted publishing platform inspired by <strong><a href="https://telegra.ph">Telegra.ph</a></strong>.</p>
  <p><a href="https://folio.arinahub.com"><strong>folio.arinahub.com</strong></a> &middot; <a href="https://folio.arinahub.com/privacy">Privacy</a> &middot; <a href="https://folio.arinahub.com/terms">Terms</a></p>

  [![Go Version](https://img.shields.io/github/go-mod/go-version/adsurkasur/folio?style=for-the-badge&color=00ADD8)](https://github.com/adsurkasur/folio/blob/master/go.mod)
  [![License](https://img.shields.io/github/license/adsurkasur/folio?style=for-the-badge)](https://github.com/adsurkasur/folio/blob/master/LICENSE)
  [![Last Commit](https://img.shields.io/github/last-commit/adsurkasur/folio?style=for-the-badge&color=success)](https://github.com/adsurkasur/folio/commits/master)
</div>

<br>

Folio strips publishing down to its absolute essentials: **Title**, **Author**, and **Story**. It requires no accounts, no separate database servers to install, and no complex configurations. Compiled into a single Go binary, it is fast, portable, and ready to publish.

## Key Features

- **No Accounts Required**: Instant anonymous publishing. Ownership and edit rights are managed via secure browser cookies and secret backup tokens.
- **Pure Keyboard Markdown**: Fast inline formatting for headings (`#`, `##`, `###`), quotes (`>`), dividers (`---`), bullet and numbered lists, inline code (\`code\`), and code blocks (\`\`\`).
- **Media & Embeds**: Upload local images or embed links directly into the canvas.
- **Automated Social Previews**: Server automatically resizes and compresses the lead image to guarantee Open Graph preview compatibility (< 300KB) across messaging apps (WhatsApp, Telegram, Discord, X/Twitter).
- **Single Standalone Binary**: Built entirely in Go with pure-Go SQLite (`modernc.org/sqlite`) in WAL mode. Templates and static assets are fully embedded (`//go:embed`). No external web server required.
- **Spam Control & Storage Cleanup**: Built-in IP rate limiting and an automated background worker that purges unreferenced draft media.
- **Local Draft Recovery**: Work in progress is automatically preserved in the browser's local storage to prevent accidental data loss.

## Quickstart

### Prerequisites
- Go 1.22 or higher

### Build & Run
```bash
# Clone the repository
git clone https://github.com/adsurkasur/folio.git
cd folio

# Build binary
go build -o folio main.go

# Run
./folio -port 8085
```

Open `http://localhost:8085` in your browser.

## License

Licensed under the [Apache License 2.0](LICENSE).
