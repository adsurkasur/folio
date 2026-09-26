<div align="center">
  <img src="assets/logo.svg" alt="Folio Logo" width="100" />
  <h1>Folio</h1>
  <p>A minimalist, zero-dependency self-hosted publishing platform inspired by <strong><a href="https://telegra.ph">Telegra.ph</a></strong>.</p>

  [![Live Demo](https://img.shields.io/badge/Demo-folio.arinahub.com-000000?style=for-the-badge)](https://folio.arinahub.com)
  [![Privacy Policy](https://img.shields.io/badge/Privacy-Policy-000000?style=for-the-badge)](https://folio.arinahub.com/privacy)
  [![Terms of Service](https://img.shields.io/badge/Terms-of_Service-000000?style=for-the-badge)](https://folio.arinahub.com/terms)

  [![Go Version](https://img.shields.io/github/go-mod/go-version/adsurkasur/folio?style=for-the-badge&color=00ADD8)](https://github.com/adsurkasur/folio/blob/master/go.mod)
  [![License](https://img.shields.io/github/license/adsurkasur/folio?style=for-the-badge)](https://github.com/adsurkasur/folio/blob/master/LICENSE)
  [![Last Commit](https://img.shields.io/github/last-commit/adsurkasur/folio?style=for-the-badge&color=success)](https://github.com/adsurkasur/folio/commits/master)
</div>

<br>

Folio strips publishing down to its absolute essentials: **Title**, **Author**, and **Story**. It requires no accounts, no separate database servers to install, and no complex configurations. 

Compiled into a **single, portable Go binary**, it is fast, standalone, and ready to publish in one click.

## Key Features

- **No Accounts Required**: Instant anonymous publishing. Ownership and edit rights are managed via secure browser cookies and secret backup tokens.
- **Pure Keyboard Markdown**: Fast inline formatting for headings (`#`, `##`, `###`), quotes (`>`), dividers (`---`), bullet and numbered lists, inline code (`code`), and code blocks (```).
- **Media & Embeds**: Upload local images or embed links directly into the canvas.
- **Automated Social Previews**: Server automatically resizes and compresses the lead image to guarantee Open Graph preview compatibility (< 300KB) across messaging apps (WhatsApp, Telegram, Discord, X/Twitter).
- **Single Portable Binary**: Built entirely in Go with pure-Go SQLite (`modernc.org/sqlite`). Templates and static HTML/CSS/JS assets are fully embedded (`//go:embed`). No external web server or database setup required.
- **Spam Control & Storage Cleanup**: Built-in IP rate limiting and an automated background worker that purges unreferenced draft media.
- **Local Draft Recovery**: Work in progress is automatically preserved in the browser's local storage to prevent accidental data loss.

---

## 🚀 Quickstart: Download & Run (No Installation Required)

Because Folio is compiled into a single binary, you **do not** need to install Go, Apache, PHP, or MySQL. 

1. Go to the [Releases page](../../releases/latest) and download the file for your operating system (Windows `.exe`, Linux, or macOS).
2. Place the file in an empty folder on your computer or server.
3. **Double-click** the file (or run it via terminal).
4. Open your browser and go to `http://localhost:8085`.

**Where does the data go?**
Folio is 100% portable. When run, it will automatically create a `folio.db` (database file) and an `uploads/` folder in the **exact same directory** as the binary. All your articles and uploaded images are saved locally right there. To backup or move your entire web app, just copy the folder!

---

## 🛠️ Build from Source

If you prefer to compile Folio yourself or want to modify the code:

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

## License

Licensed under the [Apache License 2.0](LICENSE).
