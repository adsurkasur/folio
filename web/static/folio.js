const titleEl = document.getElementById('title');
const authorEl = document.getElementById('author');
const canvasEl = document.getElementById('canvas');
const publishBtn = document.getElementById('publishBtn');
const toolbar = document.getElementById('mediaToolbar');
const btnCamera = document.getElementById('btnCamera');
const btnEmbed = document.getElementById('btnEmbed');

let currentActiveNode = null;
let embedMode = null; // 'image' or 'embed'

// Placeholder polyfill for contenteditable
function updatePlaceholder() {
    if (canvasEl.textContent.trim() === '' && canvasEl.children.length <= 1) {
        canvasEl.classList.add('empty');
    } else {
        canvasEl.classList.remove('empty');
    }
}

// Position Toolbar
function updateToolbarPosition() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;
    
    // Ensure we are inside canvas
    if (!canvasEl.contains(node)) {
        toolbar.classList.remove('active');
        return;
    }

    // Show toolbar if node is a top-level empty paragraph/div
    if ((node === canvasEl || node.parentNode === canvasEl) && node.textContent.trim() === '') {
        const rect = node.getBoundingClientRect();
        const containerRect = document.querySelector('.folio-container').getBoundingClientRect();
        
        toolbar.style.top = (rect.top - containerRect.top + 5) + 'px';
        toolbar.classList.add('active');
        currentActiveNode = node === canvasEl ? null : node;
    } else {
        toolbar.classList.remove('active');
        embedMode = null;
    }
}

document.addEventListener('selectionchange', updateToolbarPosition);
canvasEl.addEventListener('input', () => {
    updatePlaceholder();
    updateToolbarPosition();
    saveDraft();
});

// Toolbar Actions
btnCamera.addEventListener('click', () => {
    embedMode = 'image';
    if(currentActiveNode) {
        currentActiveNode.setAttribute('data-placeholder', 'Paste a link to image or video and press Enter');
        currentActiveNode.classList.add('embed-placeholder');
    }
});

btnEmbed.addEventListener('click', () => {
    embedMode = 'embed';
    if(currentActiveNode) {
        currentActiveNode.setAttribute('data-placeholder', 'Paste a YouTube, Vimeo or Twitter link, and press Enter');
        currentActiveNode.classList.add('embed-placeholder');
    }
});

// Handle URL Enter for fetching
canvasEl.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        const sel = window.getSelection();
        let node = sel.anchorNode;
        if (node.nodeType === 3) node = node.parentNode;
        
        if (embedMode && node.textContent.trim().startsWith('http')) {
            e.preventDefault();
            const url = node.textContent.trim();
            node.textContent = 'Fetching...';
            
            try {
                const res = await fetch('/api/fetch-url', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ url, type: embedMode })
                });
                if(!res.ok) throw new Error('Fetch failed');
                const data = await res.json();
                
                node.innerHTML = '';
                const img = document.createElement('img');
                img.src = data.url;
                node.appendChild(img);
                
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                node.parentNode.insertBefore(p, node.nextSibling);
                
                const range = document.createRange();
                range.setStart(p, 0);
                sel.removeAllRanges();
                sel.addRange(range);
                
            } catch (err) {
                node.textContent = '';
                alert('Gagal mengambil gambar/link.');
            }
            embedMode = null;
            node.classList.remove('embed-placeholder');
        } else {
            // Remove placeholder styling on normal enter
            if (node.classList && node.classList.contains('embed-placeholder')) {
                node.classList.remove('embed-placeholder');
                embedMode = null;
            }
        }
    }
});

// Auto-format markdown headers
canvasEl.addEventListener('input', (e) => {
    const sel = window.getSelection();
    if (!sel.anchorNode) return;
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;
    
    if (node.tagName === 'P' || node.tagName === 'DIV') {
        const text = node.textContent;
        if (text.startsWith('# ')) {
            node.outerHTML = '<h1>' + text.substring(2) + '</h1>';
            placeCaretAtEnd(canvasEl);
        } else if (text.startsWith('## ')) {
            node.outerHTML = '<h2>' + text.substring(3) + '</h2>';
            placeCaretAtEnd(canvasEl);
        } else if (text.startsWith('> ')) {
            node.outerHTML = '<blockquote>' + text.substring(2) + '</blockquote>';
            placeCaretAtEnd(canvasEl);
        }
    }
});

function placeCaretAtEnd(el) {
    el.focus();
    if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

// Save & Publish
function saveDraft() {
    if (window.location.pathname === '/') {
        localStorage.setItem('folio_draft_title', titleEl.value);
        localStorage.setItem('folio_draft_author', authorEl.value);
        localStorage.setItem('folio_draft_content', canvasEl.innerHTML);
    }
}

titleEl.addEventListener('input', saveDraft);
authorEl.addEventListener('input', saveDraft);

window.onload = () => {
    if (window.location.pathname === '/') {
        titleEl.value = localStorage.getItem('folio_draft_title') || '';
        authorEl.value = localStorage.getItem('folio_draft_author') || '';
        canvasEl.innerHTML = localStorage.getItem('folio_draft_content') || '<p><br></p>';
    } else {
        // Init editor on edit page
        if (!canvasEl.innerHTML.trim()) canvasEl.innerHTML = '<p><br></p>';
    }
    updatePlaceholder();
};

publishBtn.addEventListener('click', async () => {
    const html = canvasEl.innerHTML;
    const isEdit = window.location.pathname.startsWith('/edit/');
    const url = isEdit ? '/api/articles/' + window.location.pathname.split('/').pop() : '/api/articles';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
            title: titleEl.value,
            author: authorEl.value,
            contentHTML: html
        })
    });
    
    if (res.ok) {
        const data = await res.json();
        localStorage.removeItem('folio_draft_title');
        localStorage.removeItem('folio_draft_author');
        localStorage.removeItem('folio_draft_content');
        window.location.href = '/' + data.slug;
    } else {
        alert("Failed to publish");
    }
});
