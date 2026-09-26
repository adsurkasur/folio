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

function getActiveBlock(node) {
    let block = node;
    while (block && block.parentNode !== canvasEl && block !== canvasEl) {
        block = block.parentNode;
    }
    return (block && block !== canvasEl) ? block : null;
}

btnCamera.addEventListener('click', () => {
    embedMode = 'image';
    if (currentActiveNode) {
        currentActiveNode.setAttribute('data-placeholder', 'Paste a link to image or video and press Enter');
        currentActiveNode.classList.add('embed-placeholder');
        canvasEl.classList.remove('empty');
        currentActiveNode.focus();
    }
});

btnEmbed.addEventListener('click', () => {
    embedMode = 'embed';
    if (currentActiveNode) {
        currentActiveNode.setAttribute('data-placeholder', 'Paste a YouTube, Vimeo or Twitter link, and press Enter');
        currentActiveNode.classList.add('embed-placeholder');
        canvasEl.classList.remove('empty');
        currentActiveNode.focus();
    }
});

// Keydown handler: enter & backspace block escape & embed fetch
canvasEl.addEventListener('keydown', async (e) => {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    let node = sel.anchorNode;
    if (node.nodeType === 3) node = node.parentNode;
    const block = getActiveBlock(node);

    // Enter key handling
    if (e.key === 'Enter') {
        // Embed URL submission
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
                if (!res.ok) throw new Error('Fetch failed');
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
            return;
        }

        // Exit blockquote / heading on Enter if empty
        if (block && !e.shiftKey) {
            const tag = block.tagName;
            const text = block.textContent.replace(/\u200B/g, '').trim();

            if (['BLOCKQUOTE', 'H1', 'H2', 'H3', 'PRE'].includes(tag)) {
                if (text === '') {
                    e.preventDefault();
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    block.parentNode.replaceChild(p, block);

                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                    return;
                }
                
                // If in H1/H2/H3 and at end of text, Enter creates a normal paragraph below
                if (['H1', 'H2', 'H3'].includes(tag)) {
                    if (sel.anchorNode && (sel.anchorOffset === sel.anchorNode.textContent.length || sel.anchorNode === block)) {
                        e.preventDefault();
                        const p = document.createElement('p');
                        p.innerHTML = '<br>';
                        if (block.nextSibling) {
                            canvasEl.insertBefore(p, block.nextSibling);
                        } else {
                            canvasEl.appendChild(p);
                        }
                        const range = document.createRange();
                        range.setStart(p, 0);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        return;
                    }
                }
            }
        }
    }

    // Backspace handling: escape blockquote, heading, pre when empty
    if (e.key === 'Backspace' && block) {
        const tag = block.tagName;
        if (['BLOCKQUOTE', 'H1', 'H2', 'H3', 'PRE'].includes(tag)) {
            const text = block.textContent.replace(/\u200B/g, '').trim();
            if (text === '' || (sel.anchorOffset === 0 && (sel.anchorNode === block || sel.anchorNode === block.firstChild))) {
                e.preventDefault();
                const p = document.createElement('p');
                p.innerHTML = text ? text : '<br>';
                block.parentNode.replaceChild(p, block);

                const range = document.createRange();
                if (text && p.firstChild) {
                    range.setStart(p.firstChild, 0);
                } else {
                    range.setStart(p, 0);
                }
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return;
            }
        }
    }
});

function transformBlock(node, tag, text) {
    const el = document.createElement(tag);
    if (!text || text.trim() === '') {
        el.innerHTML = '<br>';
    } else {
        el.textContent = text;
    }
    node.parentNode.replaceChild(el, node);
    el.focus();
    const range = document.createRange();
    const sel = window.getSelection();
    if (el.firstChild && el.firstChild.nodeType === 3) {
        range.setStart(el.firstChild, el.firstChild.length);
        range.collapse(true);
    } else {
        range.setStart(el, 0);
        range.collapse(true);
    }
    sel.removeAllRanges();
    sel.addRange(range);
}

// Markdown input formatting
canvasEl.addEventListener('input', (e) => {
    if (embedMode && currentActiveNode && currentActiveNode.textContent.trim() !== '') {
        currentActiveNode.classList.remove('embed-placeholder');
        embedMode = null;
    }
    updatePlaceholder();
    updateToolbarPosition();
    saveDraft();

    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.anchorNode) return;
    let node = sel.anchorNode;
    let parentBlock = node;
    if (parentBlock.nodeType === 3) parentBlock = parentBlock.parentNode;

    // Check inline markdown (code, bold, italic) on text nodes
    if (node.nodeType === 3) {
        const text = node.nodeValue;

        // Inline code `code `
        const codeMatch = text.match(/`([^`]+)`(\s?)/);
        if (codeMatch) {
            const start = codeMatch.index;
            const fullLen = codeMatch[0].length;
            const codeContent = codeMatch[1];
            const space = codeMatch[2] || '';

            const before = text.substring(0, start);
            const after = text.substring(start + fullLen);

            const p = node.parentNode;
            const codeEl = document.createElement('code');
            codeEl.textContent = codeContent;

            const frag = document.createDocumentFragment();
            if (before) frag.appendChild(document.createTextNode(before));
            frag.appendChild(codeEl);
            const afterNode = document.createTextNode(space ? '\u00A0' : '');
            frag.appendChild(afterNode);

            p.replaceChild(frag, node);

            const range = document.createRange();
            range.setStart(afterNode, afterNode.length);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        // Bold **text** 
        const boldMatch = text.match(/\*\*([^*]+)\*\*(\s?)/);
        if (boldMatch) {
            const start = boldMatch.index;
            const fullLen = boldMatch[0].length;
            const boldContent = boldMatch[1];
            const space = boldMatch[2] || '';

            const before = text.substring(0, start);
            const after = text.substring(start + fullLen);

            const p = node.parentNode;
            const bEl = document.createElement('b');
            bEl.textContent = boldContent;

            const frag = document.createDocumentFragment();
            if (before) frag.appendChild(document.createTextNode(before));
            frag.appendChild(bEl);
            const afterNode = document.createTextNode(space ? '\u00A0' : '');
            frag.appendChild(afterNode);

            p.replaceChild(frag, node);

            const range = document.createRange();
            range.setStart(afterNode, afterNode.length);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }
    }

    // Block markdown conversion
    if (parentBlock.tagName === 'P' || parentBlock.tagName === 'DIV') {
        const text = parentBlock.textContent;

        // Code block ```
        if (text.startsWith('```')) {
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.innerHTML = '<br>';
            pre.appendChild(code);
            parentBlock.parentNode.replaceChild(pre, parentBlock);
            const range = document.createRange();
            range.setStart(code, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        // Bullet lists
        if (text.startsWith('- ') || text.startsWith('* ')) {
            const ul = document.createElement('ul');
            const li = document.createElement('li');
            const rem = text.substring(2);
            li.innerHTML = rem.trim() ? rem : '<br>';
            ul.appendChild(li);
            parentBlock.parentNode.replaceChild(ul, parentBlock);
            const range = document.createRange();
            if (rem.trim() && li.firstChild) {
                range.setStart(li.firstChild, rem.length);
            } else {
                range.setStart(li, 0);
            }
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        // Numbered lists
        if (text.startsWith('1. ')) {
            const ol = document.createElement('ol');
            const li = document.createElement('li');
            const rem = text.substring(3);
            li.innerHTML = rem.trim() ? rem : '<br>';
            ol.appendChild(li);
            parentBlock.parentNode.replaceChild(ol, parentBlock);
            const range = document.createRange();
            if (rem.trim() && li.firstChild) {
                range.setStart(li.firstChild, rem.length);
            } else {
                range.setStart(li, 0);
            }
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        // Horizontal rule
        if (text === '---') {
            const hr = document.createElement('hr');
            const p = document.createElement('p');
            p.innerHTML = '<br>';
            parentBlock.parentNode.replaceChild(hr, parentBlock);
            hr.parentNode.insertBefore(p, hr.nextSibling);
            const range = document.createRange();
            range.setStart(p, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }

        // Headings & Quote
        if (text.startsWith('### ')) {
            transformBlock(parentBlock, 'h3', text.substring(4));
        } else if (text.startsWith('## ')) {
            transformBlock(parentBlock, 'h2', text.substring(3));
        } else if (text.startsWith('# ')) {
            transformBlock(parentBlock, 'h1', text.substring(2));
        } else if (text.startsWith('> ')) {
            transformBlock(parentBlock, 'blockquote', text.substring(2));
        }
    }
});

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
        const errText = await res.text();
        errorMsg.textContent = errText || 'Failed to publish';
    }
});