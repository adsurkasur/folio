const titleEl = document.getElementById('title');
const authorEl = document.getElementById('author');
const canvasEl = document.getElementById('canvas');
const publishBtn = document.getElementById('publishBtn');
const errorMsg = document.getElementById('errorMsg');
const toolbar = document.getElementById('mediaToolbar');
const btnCamera = document.getElementById('btnCamera');
const btnEmbed = document.getElementById('btnEmbed');

let currentActiveNode = null;
let embedMode = null;

function updatePlaceholder() {
    if (canvasEl.textContent.trim() === '' && canvasEl.children.length <= 1 && !embedMode) {
        canvasEl.classList.add('empty');
    } else {
        canvasEl.classList.remove('empty');
    }
}

function updateToolbarPosition() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;
    
    if (!canvasEl.contains(node)) {
        toolbar.classList.remove('active');
        return;
    }

    if ((node === canvasEl || node.parentNode === canvasEl) && node.textContent.trim() === '') {
        const rect = node.getBoundingClientRect();
        const containerRect = document.querySelector('.folio-container').getBoundingClientRect();
        
        toolbar.style.top = (rect.top - containerRect.top + 5) + 'px';
        toolbar.classList.add('active');
        currentActiveNode = node === canvasEl ? null : node;
    } else {
        toolbar.classList.remove('active');
        if (embedMode && currentActiveNode) {
            currentActiveNode.classList.remove('embed-placeholder');
            embedMode = null;
        }
    }
}

document.addEventListener('selectionchange', updateToolbarPosition);

canvasEl.addEventListener('input', () => {
    if (embedMode && currentActiveNode && currentActiveNode.textContent.trim() !== '') {
        currentActiveNode.classList.remove('embed-placeholder');
        embedMode = null;
    }
    updatePlaceholder();
    updateToolbarPosition();
    saveDraft();
});

btnCamera.addEventListener('click', () => {
    embedMode = 'image';
    if(currentActiveNode) {
        currentActiveNode.setAttribute('data-placeholder', 'Paste a link to image or video and press Enter');
        currentActiveNode.classList.add('embed-placeholder');
        canvasEl.classList.remove('empty');
        currentActiveNode.focus();
    }
});

btnEmbed.addEventListener('click', () => {
    embedMode = 'embed';
    if(currentActiveNode) {
        currentActiveNode.setAttribute('data-placeholder', 'Paste a YouTube, Vimeo or Twitter link, and press Enter');
        currentActiveNode.classList.add('embed-placeholder');
        canvasEl.classList.remove('empty');
        currentActiveNode.focus();
    }
});

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
            if (node.classList && node.classList.contains('embed-placeholder')) {
                node.classList.remove('embed-placeholder');
                embedMode = null;
            }
        }
    }
});

canvasEl.addEventListener('input', (e) => {
    const sel = window.getSelection();
    if (!sel.anchorNode) return;
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;
    
    if (node.tagName === 'P' || node.tagName === 'DIV') {
        const text = node.textContent;
        let newHtml = null;
        if (text.startsWith('# ')) {
            newHtml = '<h1>' + text.substring(2) + '</h1>';
        } else if (text.startsWith('## ')) {
            newHtml = '<h2>' + text.substring(3) + '</h2>';
        } else if (text.startsWith('### ')) {
            newHtml = '<h3>' + text.substring(4) + '</h3>';
        } else if (text.startsWith('> ')) {
            newHtml = '<blockquote>' + text.substring(2) + '</blockquote>';
        }
        
        if (newHtml) {
            const temp = document.createElement('div');
            temp.innerHTML = newHtml;
            const newEl = temp.firstChild;
            node.parentNode.replaceChild(newEl, node);
            placeCaretAtEnd(newEl);
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

function saveDraft() {
    if (window.location.pathname === '/') {
        localStorage.setItem('folio_draft_title', titleEl.value);
        localStorage.setItem('folio_draft_author', authorEl.value);
        localStorage.setItem('folio_draft_content', canvasEl.innerHTML);
    }
}

titleEl.addEventListener('input', () => {
    titleEl.classList.remove('error');
    errorMsg.textContent = '';
    saveDraft();
});
authorEl.addEventListener('input', saveDraft);

window.onload = () => {
    if (window.location.pathname === '/') {
        titleEl.value = localStorage.getItem('folio_draft_title') || '';
        authorEl.value = localStorage.getItem('folio_draft_author') || '';
        canvasEl.innerHTML = localStorage.getItem('folio_draft_content') || '<p><br></p>';
    } else {
        if (!canvasEl.innerHTML.trim()) canvasEl.innerHTML = '<p><br></p>';
    }
    updatePlaceholder();
};

publishBtn.addEventListener('click', async () => {
    if (!titleEl.value.trim()) {
        titleEl.classList.add('error');
        errorMsg.textContent = 'Title is too small';
        titleEl.focus();
        return;
    }

    const html = canvasEl.innerHTML;
    const isEdit = window.location.pathname.startsWith('/edit/');
    const url = isEdit ? '/api/articles/' + window.location.pathname.split('/').pop() : '/api/articles';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
        method: method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            title: titleEl.value,
            author_name: authorEl.value,
            content_html: html
        })
    });
    
    if (res.ok) {
        const data = await res.json();
        localStorage.removeItem('folio_draft_title');
        localStorage.removeItem('folio_draft_author');
        localStorage.removeItem('folio_draft_content');
        window.location.href = '/' + data.slug;
    } else {
        errorMsg.textContent = 'Failed to publish';
    }
});