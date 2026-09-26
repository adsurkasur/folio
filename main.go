package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"html/template"
	"image"
	"image/jpeg"
	_ "image/png"
	_ "golang.org/x/image/webp"
	"io"
	"io/fs"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/microcosm-cc/bluemonday"
	"golang.org/x/image/draw"
	_ "modernc.org/sqlite"
)

//go:embed web/templates/* web/static/*
var webFS embed.FS
var tmpl *template.Template

var (
	db       *sql.DB
	policy   *bluemonday.Policy
	baseURL  string
	uploads  = "uploads"
	dataDir  = "data"
)

// --- MODELS ---
type Article struct {
	ID              int
	Slug            string
	Title           string
	AuthorName      string
	ContentHTML     template.HTML
	ContentText     string
	OGImageURL      string
	AuthorTokenHash string
	ViewsCount      int
	CreatedAt       time.Time
}

// --- RATE LIMITER ---
var (
	rateMu      sync.Mutex
	rateLimiter = make(map[string]*rateLimit)
)

type rateLimit struct {
	articles int
	images   int
	resetAt  time.Time
}

func allowRequest(ip string, isArticle bool) bool {
	rateMu.Lock()
	defer rateMu.Unlock()
	
	now := time.Now()
	rl, exists := rateLimiter[ip]
	if !exists || now.After(rl.resetAt) {
		rl = &rateLimit{resetAt: now.Add(time.Hour)}
		rateLimiter[ip] = rl
	}

	if isArticle {
		if rl.articles >= 5 {
			return false
		}
		rl.articles++
	} else {
		if rl.images >= 15 {
			return false
		}
		rl.images++
	}
	return true
}

func getIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return strings.TrimSpace(strings.Split(xff, ",")[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// --- UTILS ---
func randHex(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

func generateSlug(title string) string {
	title = strings.ToLower(title)
	re := regexp.MustCompile(`[^a-z0-9]+`)
	slug := re.ReplaceAllString(title, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		slug = "post"
	}
	dateStr := time.Now().Format("01-02")
	baseSlug := fmt.Sprintf("%s-%s", slug, dateStr)
	
	finalSlug := baseSlug
	counter := 2
	for {
		var exists int
		err := db.QueryRow("SELECT 1 FROM articles WHERE slug = ?", finalSlug).Scan(&exists)
		if err == sql.ErrNoRows {
			break
		}
		finalSlug = fmt.Sprintf("%s-%d", baseSlug, counter)
		counter++
	}
	return finalSlug
}

// --- HANDLERS ---
func handleHome(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	
	// Ensure author cookie exists
	_, err := r.Cookie("folio_author_token")
	if err != nil {
		http.SetCookie(w, &http.Cookie{
			Name:     "folio_author_token",
			Value:    randHex(16),
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   315360000,
		})
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tmpl.ExecuteTemplate(w, "editor.html", nil)
}

func handleArticle(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	
	var a Article
	var contentHTML string
	err := db.QueryRow("SELECT id, slug, title, author_name, content_html, content_text, og_image_url, author_token_hash, views_count, created_at FROM articles WHERE slug = ?", slug).
		Scan(&a.ID, &a.Slug, &a.Title, &a.AuthorName, &contentHTML, &a.ContentText, &a.OGImageURL, &a.AuthorTokenHash, &a.ViewsCount, &a.CreatedAt)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	a.ContentHTML = template.HTML(contentHTML)

	// Update view count
	db.Exec("UPDATE articles SET views_count = views_count + 1 WHERE id = ?", a.ID)

	canEdit := false
	cookie, err := r.Cookie("folio_author_token")
	tokenQuery := r.URL.Query().Get("token")
	
	if tokenQuery != "" && hashToken(tokenQuery) == a.AuthorTokenHash {
		canEdit = true
		// Restore cookie
		http.SetCookie(w, &http.Cookie{
			Name:     "folio_author_token",
			Value:    tokenQuery,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   315360000,
		})
	} else if err == nil && hashToken(cookie.Value) == a.AuthorTokenHash {
		canEdit = true
	}

	data := struct {
		Article Article
		CanEdit bool
		BaseURL string
	}{a, canEdit, baseURL}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	tmpl.ExecuteTemplate(w, "article.html", data)
}

func handleEditPage(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	http.Redirect(w, r, "/"+slug+"?edit=1", http.StatusFound)
}

func handlePublish(w http.ResponseWriter, r *http.Request) {
	if !allowRequest(getIP(r), true) {
		http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
		return
	}
	
	// Max 5MB text payload
	r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)
	
	var req struct {
		Title       string `json:"title"`
		AuthorName  string `json:"author_name"`
		ContentHTML string `json:"content_html"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	cleanHTML := policy.Sanitize(req.ContentHTML)
	reStrip := regexp.MustCompile(`<[^>]*>`)
	plainText := reStrip.ReplaceAllString(cleanHTML, "")
	if len(plainText) > 200 {
		plainText = plainText[:197] + "..."
	}

	// Extract first image for OG
	ogImage := ""
	reImg := regexp.MustCompile(`src="(/uploads/[^"]+)"`)
	if match := reImg.FindStringSubmatch(cleanHTML); len(match) > 1 {
		ogImage = strings.Replace(match[1], "img_", "thumb_", 1)
	}

	var tokenVal string
	cookie, err := r.Cookie("folio_author_token")
	if err != nil || cookie == nil || cookie.Value == "" {
		tokenVal = randHex(16)
		http.SetCookie(w, &http.Cookie{
			Name:     "folio_author_token",
			Value:    tokenVal,
			Path:     "/",
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   315360000,
		})
	} else {
		tokenVal = cookie.Value
	}
	tokenHash := hashToken(tokenVal)
	slug := generateSlug(req.Title)

	log.Printf("[Publish] Title: %q by %q, slug: %s", req.Title, req.AuthorName, slug)

	_, err = db.Exec("INSERT INTO articles (slug, title, author_name, content_html, content_text, og_image_url, author_token_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
		slug, req.Title, req.AuthorName, cleanHTML, plainText, ogImage, tokenHash)
	if err != nil {
		log.Printf("[Publish ERROR] DB Insert failed: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"slug":       slug,
		"edit_token": tokenVal,
	})
}

func handleUpdate(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	r.Body = http.MaxBytesReader(w, r.Body, 5*1024*1024)

	var req struct {
		Title       string `json:"title"`
		AuthorName  string `json:"author_name"`
		ContentHTML string `json:"content_html"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	cookie, _ := r.Cookie("folio_author_token")
	tokenQuery := r.URL.Query().Get("token")
	tokenToHash := ""
	if tokenQuery != "" {
		tokenToHash = tokenQuery
	} else if cookie != nil {
		tokenToHash = cookie.Value
	}

	var hash string
	err := db.QueryRow("SELECT author_token_hash FROM articles WHERE slug = ?", slug).Scan(&hash)
	if err != nil || hashToken(tokenToHash) != hash {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	cleanHTML := policy.Sanitize(req.ContentHTML)
	reStrip := regexp.MustCompile(`<[^>]*>`)
	plainText := reStrip.ReplaceAllString(cleanHTML, "")
	if len(plainText) > 200 {
		plainText = plainText[:197] + "..."
	}

	ogImage := ""
	reImg := regexp.MustCompile(`src="(/uploads/[^"]+)"`)
	if match := reImg.FindStringSubmatch(cleanHTML); len(match) > 1 {
		ogImage = strings.Replace(match[1], "img_", "thumb_", 1)
	}

	db.Exec("UPDATE articles SET title=?, author_name=?, content_html=?, content_text=?, og_image_url=?, updated_at=CURRENT_TIMESTAMP WHERE slug=?",
		req.Title, req.AuthorName, cleanHTML, plainText, ogImage, slug)

	json.NewEncoder(w).Encode(map[string]string{"slug": slug})
}

func handleDelete(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	cookie, _ := r.Cookie("folio_author_token")
	tokenQuery := r.URL.Query().Get("token")
	tokenToHash := ""
	if tokenQuery != "" {
		tokenToHash = tokenQuery
	} else if cookie != nil {
		tokenToHash = cookie.Value
	}

	var hash, contentHTML string
	err := db.QueryRow("SELECT author_token_hash, content_html FROM articles WHERE slug = ?", slug).Scan(&hash, &contentHTML)
	if err != nil || hashToken(tokenToHash) != hash {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Delete referenced images
	reImg := regexp.MustCompile(`src="(/uploads/([^"]+))"`)
	matches := reImg.FindAllStringSubmatch(contentHTML, -1)
	for _, m := range matches {
		filename := m[2]
		os.Remove(filepath.Join(uploads, filename))
		if strings.HasPrefix(filename, "img_") {
			os.Remove(filepath.Join(uploads, strings.Replace(filename, "img_", "thumb_", 1)))
		}
	}

	db.Exec("DELETE FROM articles WHERE slug=?", slug)
	w.WriteHeader(http.StatusOK)
}

func handleUpload(w http.ResponseWriter, r *http.Request) {
	if !allowRequest(getIP(r), false) {
		http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 10*1024*1024) // 10MB limit
	file, header, err := r.FormFile("image")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		http.Error(w, "Invalid image", http.StatusBadRequest)
		return
	}

	id := randHex(8)
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	imgName := fmt.Sprintf("img_%s%s", id, ext)
	imgPath := filepath.Join(uploads, imgName)
	
	// Save original
	out, err := os.Create(imgPath)
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}
	file.Seek(0, 0)
	io.Copy(out, file)
	out.Close()

	// Generate WhatsApp Thumbnail (<300KB)
	createThumbnail(imgPath)

	json.NewEncoder(w).Encode(map[string]string{
		"url": "/uploads/" + imgName,
	})
}

func initDB() {
	os.MkdirAll(dataDir, 0755)
	os.MkdirAll(uploads, 0755)
	
	var err error
	db, err = sql.Open("sqlite", filepath.Join(dataDir, "folio.db")+"?_pragma=journal_mode(WAL)")
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS articles (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		slug TEXT NOT NULL UNIQUE,
		title TEXT NOT NULL,
		author_name TEXT DEFAULT '',
		content_html TEXT NOT NULL,
		content_text TEXT NOT NULL,
		og_image_url TEXT DEFAULT '',
		author_token_hash TEXT NOT NULL,
		views_count INTEGER DEFAULT 0,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);`)
	if err != nil {
		log.Fatal(err)
	}
}

func runGC() {
	for {
		time.Sleep(24 * time.Hour)
		files, err := os.ReadDir(uploads)
		if err != nil {
			continue
		}
		for _, f := range files {
			if f.IsDir() || !strings.HasPrefix(f.Name(), "img_") {
				continue
			}
			info, err := f.Info()
			if err != nil || time.Since(info.ModTime()) < 24*time.Hour {
				continue
			}
			
			// Check if referenced
			var count int
			db.QueryRow("SELECT COUNT(*) FROM articles WHERE content_html LIKE ?", "%"+f.Name()+"%").Scan(&count)
			if count == 0 {
				os.Remove(filepath.Join(uploads, f.Name()))
				os.Remove(filepath.Join(uploads, strings.Replace(f.Name(), "img_", "thumb_", 1)))
			}
		}
	}
}

func main() {
	port := flag.String("port", "8085", "Port to run on")
	flag.StringVar(&baseURL, "base-url", os.Getenv("BASE_URL"), "Base URL for Open Graph (e.g. https://folio.arinahub.com)")
	flag.Parse()

	if baseURL == "" {
		baseURL = "http://localhost:" + *port
	}

	initDB()
	defer db.Close()
	
	go runGC()

	policy = bluemonday.UGCPolicy()
	policy.AllowElements("iframe", "figure", "figcaption")
	policy.AllowAttrs("src", "width", "height", "frameborder", "allowfullscreen").OnElements("iframe")
	policy.AllowAttrs("data-placeholder", "class").OnElements("figcaption")

	tmpl = template.Must(template.ParseFS(webFS, "web/templates/*.html"))

	mux := http.NewServeMux()
	mux.HandleFunc("GET /", handleHome)
	mux.HandleFunc("GET /privacy", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		tmpl.ExecuteTemplate(w, "privacy.html", nil)
	})
	mux.HandleFunc("GET /terms", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		tmpl.ExecuteTemplate(w, "terms.html", nil)
	})
	mux.HandleFunc("GET /{slug}", handleArticle)
	mux.HandleFunc("GET /edit/{slug}", handleEditPage)
	
	mux.HandleFunc("POST /api/upload", handleUpload)
	mux.HandleFunc("POST /api/fetch-url", handleFetchUrl)
	mux.HandleFunc("POST /api/articles", handlePublish)
	mux.HandleFunc("PUT /api/articles/{slug}", handleUpdate)
	mux.HandleFunc("DELETE /api/articles/{slug}", handleDelete)

	subFS, _ := fs.Sub(webFS, "web")
	mux.Handle("GET /static/", http.FileServer(http.FS(subFS)))
	mux.Handle("GET /uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploads))))

	log.Printf("Folio running on :%s\n", *port)
	log.Fatal(http.ListenAndServe(":"+*port, mux))
}
func handleFetchUrl(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		URL string `json:"url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	resp, err := http.Get(req.URL)
	if err != nil || resp.StatusCode != 200 {
		http.Error(w, "Failed to fetch", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	if resp.ContentLength > 10*1024*1024 {
		http.Error(w, "File too large", http.StatusRequestEntityTooLarge)
		return
	}

	ext := ".jpg"
	if exts, err := mime.ExtensionsByType(resp.Header.Get("Content-Type")); err == nil && len(exts) > 0 {
		ext = exts[0]
	}

	fileName := "img_" + randHex(8) + ext
	filePath := filepath.Join(uploads, fileName)
	
	outFile, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Failed to save", http.StatusInternalServerError)
		return
	}
	io.Copy(outFile, resp.Body)
	outFile.Close()

	// Create thumbnail
	createThumbnail(filePath)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"url": "/uploads/" + fileName})
}
func createThumbnail(imgPath string) {
	file, err := os.Open(imgPath)
	if err != nil { return }
	img, _, err := image.Decode(file)
	file.Close()
	if err != nil { return }

	bounds := img.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	
	targetW, targetH := 1200, 630
	if width > targetW || height > targetH {
		ratio := float64(width) / float64(height)
		if ratio > float64(targetW)/float64(targetH) {
			width = targetW
			height = int(float64(targetW) / ratio)
		} else {
			height = targetH
			width = int(float64(targetH) * ratio)
		}
	}

	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	draw.CatmullRom.Scale(dst, dst.Bounds(), img, bounds, draw.Over, nil)

	thumbPath := strings.Replace(imgPath, "img_", "thumb_", 1)
	thumbOut, _ := os.Create(thumbPath)
	defer thumbOut.Close()
	jpeg.Encode(thumbOut, dst, &jpeg.Options{Quality: 80})
}


