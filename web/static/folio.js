const titleEl = document.getElementById('title');
const authorEl = document.getElementById('author');
const authorDot = document.getElementById('authorDot');
const canvasEl = document.getElementById('canvas');
const publishBtn = document.getElementById('publishBtn');
const editBtn = document.getElementById('editBtn');
const errorMsg = document.getElementById('errorMsg');
const toolbar = document.getElementById('mediaToolbar');
const btnCamera = document.getElementById('btnCamera');
const btnEmbed = document.getElementById('btnEmbed');
const formatBubble = document.getElementById('formatBubble');
const linkTooltip = document.getElementById('linkTooltip');

let currentActiveNode = null;
let embedMode = null;
let isArticleEditing = false;
let savedBubbleRange = null;
let isMouseSelecting = false;

function setCaret(node, offset = 0) {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
}

function scrollCaretIntoView() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if (rect.height === 0 || rect.width === 0) {
        const node = sel.anchorNode;
        if (node && node.nodeType === 1) {
            rect = node.getBoundingClientRect();
        } else if (node && node.parentElement) {
            rect = node.parentElement.getBoundingClientRect();
        }
    }
    if (rect) {
        // Add an 80px buffer so we don't scroll exactly to the edge
        if (rect.bottom > window.innerHeight - 80) {
            window.scrollBy({ top: rect.bottom - (window.innerHeight - 80), behavior: 'auto' });
        } else if (rect.top < 80) {
            window.scrollBy({ top: rect.top - 80, behavior: 'auto' });
        }
    }
}

function updatePlaceholder() {
    if (!canvasEl) return;
    if (canvasEl.textContent.trim() === '' && canvasEl.children.length <= 1 && !embedMode) {
        canvasEl.classList.add('empty');
    } else {
        canvasEl.classList.remove('empty');
    }

    // Toggle empty class on figcaptions
    const figcaptions = canvasEl.querySelectorAll('figcaption');
    figcaptions.forEach(fc => {
        if (fc.textContent.trim() === '') {
            fc.classList.add('empty');
        } else {
            fc.classList.remove('empty');
        }
    });
}

function getActiveBlock(node) {
    let block = node;
    while (block && block.parentNode !== canvasEl && block !== canvasEl) {
        block = block.parentNode;
    }
    return (block && block !== canvasEl) ? block : null;
}

// Media Toolbar Positioning
function updateToolbarPosition() {
    if (!toolbar || !canvasEl) return;
    if (canvasEl.contentEditable !== 'true') {
        toolbar.classList.remove('active');
        return;
    }
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentNode;
    
    if (!node || !canvasEl.contains(node)) {
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

// Floating Selection Format Bubble
function hideFormatBubble() {
    if (formatBubble) {
        formatBubble.classList.remove('active');
        setTimeout(() => {
            if (!formatBubble.classList.contains('active')) {
                resetBubbleLink();
            }
        }, 400); // 400ms ensures fade-out completes before resetting DOM
    }
}

function resetBubbleLink() {
    if (!formatBubble) return;
    const btnRow = formatBubble.querySelector('.folio-bubble-buttons');
    const linkBox = formatBubble.querySelector('.folio-bubble-link-box');
    const linkInput = formatBubble.querySelector('.folio-bubble-input');
    if (btnRow) btnRow.style.display = 'flex';
    if (linkBox) linkBox.style.display = 'none';
    if (linkInput) linkInput.value = '';
    savedBubbleRange = null;
}

function updateFormatBubble() {
    if (!formatBubble || !canvasEl) return;
    if (canvasEl.contentEditable !== 'true') {
        hideFormatBubble();
        return;
    }
    
    if (formatBubble.contains(document.activeElement)) {
        return; // Don't hide if typing in the link input
    }
    // If currently typing a link inside the bubble, don't close
    const linkBox = formatBubble.querySelector('.folio-bubble-link-box');
    if (linkBox && linkBox.style.display !== 'none' && formatBubble.contains(document.activeElement)) {
        return;
    }

    const sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
        hideFormatBubble();
        return;
    }
    const range = sel.getRangeAt(0);
    if (!canvasEl.contains(range.commonAncestorContainer)) {
        hideFormatBubble();
        return;
    }
    const text = sel.toString().trim();
    if (!text) {
        hideFormatBubble();
        return;
    }
    const range = sel.getRangeAt(0);
    if (!canvasEl.contains(range.commonAncestorContainer)) {
        hideFormatBubble();
        return;
    }

    const rect = range.getBoundingClientRect();
    let top = rect.top - 48 + window.scrollY;
    if (rect.top < 54) {
        top = rect.bottom + 8 + window.scrollY;
    }
    formatBubble.style.top = top + 'px';
    formatBubble.style.left = (rect.left + rect.width / 2) + 'px';
    if (!formatBubble.classList.contains('active')) {
        resetBubbleLink();
    }
    formatBubble.classList.add('active');
}

// Format Bubble Event Listeners
if (formatBubble) {
    const btnRow = formatBubble.querySelector('.folio-bubble-buttons');
    const linkBox = formatBubble.querySelector('.folio-bubble-link-box');
    const linkInput = formatBubble.querySelector('.folio-bubble-input');
    const closeBtn = formatBubble.querySelector('.folio-bubble-close');

    if (btnRow) {
        btnRow.addEventListener('mousedown', (e) => {
            const btn = e.target.closest('.folio-bubble-btn');
            if (!btn) return;
            e.preventDefault();
            const action = btn.dataset.action;

            if (action === 'bold') {
                document.execCommand('bold', false, null);
                updateFormatBubble();
            } else if (action === 'italic') {
                document.execCommand('italic', false, null);
                updateFormatBubble();
            } else if (action === 'link') {
                const sel = window.getSelection();
                if (sel.rangeCount) {
                    savedBubbleRange = sel.getRangeAt(0).cloneRange();
                    btnRow.style.display = 'none';
                    if (linkBox) {
                        linkBox.style.display = 'flex';
                        if (linkInput) {
                            linkInput.focus();
                        }
                    }
                }
            } else if (action === 'h1' || action === 'h2' || action === 'quote') {
                const sel = window.getSelection();
                if (sel.rangeCount) {
                    let node = sel.anchorNode;
                    if (node && node.nodeType === 3) node = node.parentNode;
                    const block = getActiveBlock(node);
                    if (block) {
                        const tag = action === 'h1' ? 'h1' : action === 'h2' ? 'h2' : 'blockquote';
                        document.execCommand('formatBlock', false, block.tagName.toLowerCase() === tag ? 'p' : tag);
                    }
                }
                updateFormatBubble();
            }
        });
    }

    if (linkInput) {
        linkInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                let url = linkInput.value.trim();
                if (url && savedBubbleRange) {
                    if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
                        url = 'https://' + url;
                    }
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(savedBubbleRange);
                    document.execCommand('createLink', false, url);
                }
                hideFormatBubble();
            } else if (e.key === 'Escape') {
                hideFormatBubble();
            }
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            hideFormatBubble();
        });
    }
}

// Link Tooltip Preview
function showLinkTooltip(targetEl, text) {
    if (!linkTooltip || !targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const href = text || targetEl.getAttribute('href') || targetEl.textContent.trim();
    if (!href) {
        linkTooltip.classList.remove('active');
        return;
    }
    linkTooltip.innerHTML = `<a href="${href}" target="_blank" rel="noopener">${href}</a>`;
    linkTooltip.style.top = (rect.bottom + 8 + window.scrollY) + 'px';
    linkTooltip.style.left = (rect.left + rect.width / 2) + 'px';
    linkTooltip.classList.add('active');
}

function hideLinkTooltip() {
    if (linkTooltip) linkTooltip.classList.remove('active');
}

if (canvasEl && linkTooltip) {
    canvasEl.addEventListener('mouseover', (e) => {
        const a = e.target.closest('a');
        if (a) {
            showLinkTooltip(a);
        }
    });

    canvasEl.addEventListener('mouseout', (e) => {
        const a = e.target.closest('a');
        if (a) {
            setTimeout(() => {
                if (!linkTooltip.matches(':hover')) {
                    hideLinkTooltip();
                }
            }, 150);
        }
    });

    linkTooltip.addEventListener('mouseleave', () => {
        hideLinkTooltip();
    });
}

document.addEventListener('mousedown', (e) => {
    if (formatBubble && formatBubble.contains(e.target)) return;
    isMouseSelecting = true;
    hideFormatBubble();
});

document.addEventListener('mouseup', () => {
    isMouseSelecting = false;
    setTimeout(updateFormatBubble, 50);
});

document.addEventListener('selectionchange', () => {
    updateToolbarPosition();
    
    if (isMouseSelecting) {
        hideFormatBubble();
    } else {
        // debounce keyboard selection slightly
        setTimeout(updateFormatBubble, 50);
    }
    
    // Remove figure focus if selection moved outside
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
        const node = sel.anchorNode;
        if (node && !node.closest('figure')) {
            document.querySelectorAll('figure.focus').forEach(fig => fig.classList.remove('focus'));
        }
    }

    if (isArticleEditing || window.location.pathname === '/') {
        scrollCaretIntoView();
    }
});

// Manage figure focus state
document.addEventListener('click', (e) => {
    if (!isArticleEditing && window.location.pathname !== '/') return;
    const clickedFigure = e.target.closest('figure');
    
    // Remove focus from all figures
    document.querySelectorAll('figure.focus').forEach(fig => {
        if (fig !== clickedFigure) fig.classList.remove('focus');
    });

    // If clicked on an image inside a figure, focus the figure
    if (clickedFigure && e.target.tagName === 'IMG') {
        clickedFigure.classList.add('focus');
        // Clear native selection so it doesn't look weird
        window.getSelection().removeAllRanges();
    }
});

document.addEventListener('keydown', (e) => {
    if (!isArticleEditing && window.location.pathname !== '/') return;
    const focusedFigure = document.querySelector('figure.focus');
    if (focusedFigure) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            let prev = focusedFigure.previousElementSibling;
            if (!prev) {
                prev = document.createElement('p');
                prev.innerHTML = '<br>';
                focusedFigure.parentNode.insertBefore(prev, focusedFigure);
            }
            focusedFigure.parentNode.removeChild(focusedFigure);
            const target = prev.lastChild || prev;
            setCaret(target, target.textContent ? target.textContent.length : 0);
            updatePlaceholder();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            focusedFigure.classList.remove('focus');
            let prev = focusedFigure.previousElementSibling;
            if (prev) {
                const target = prev.lastChild && prev.lastChild.nodeType === 3 ? prev.lastChild : prev;
                setCaret(target, target.textContent ? target.textContent.length : 0);
            }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            focusedFigure.classList.remove('focus');
            let caption = focusedFigure.querySelector('figcaption');
            if (caption) {
                caption.focus();
                setCaret(caption, 0);
            }
        }
    }
});

// Image / Figure insertion helper
function insertFigureWithImage(targetEl, src) {
    const figure = document.createElement('figure');
    figure.contentEditable = 'false';
    figure.tabIndex = -1; // make it focusable/selectable

    const img = document.createElement('img');
    img.src = src;
    figure.appendChild(img);

    const figcaption = document.createElement('figcaption');
    figcaption.contentEditable = 'true';
    figcaption.setAttribute('data-placeholder', 'Caption (optional)');
    figcaption.className = 'empty';
    figure.appendChild(figcaption);

    if (targetEl && targetEl.parentNode) {
        targetEl.parentNode.replaceChild(figure, targetEl);
    } else if (canvasEl) {
        canvasEl.appendChild(figure);
    }

    let nextP = figure.nextElementSibling;
    if (!nextP || nextP.tagName !== 'P') {
        nextP = document.createElement('p');
        nextP.innerHTML = '<br>';
        figure.parentNode.insertBefore(nextP, figure.nextSibling);
    }

    // Auto focus the figcaption
    figcaption.focus();
    updatePlaceholder();
}

async function uploadAndInsertImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    const figure = document.createElement('figure');
    figure.innerHTML = '<div style="color:var(--text-muted);font-style:italic;padding:16px;text-align:center;">Uploading...</div>';
    
    const sel = window.getSelection();
    let targetNode = currentActiveNode;
    if (!targetNode && sel && sel.rangeCount) {
        let node = sel.anchorNode;
        if (node && node.nodeType === 3) node = node.parentNode;
        targetNode = getActiveBlock(node);
    }
    
    if (targetNode && targetNode.parentNode === canvasEl) {
        canvasEl.replaceChild(figure, targetNode);
    } else {
        canvasEl.appendChild(figure);
    }
    
    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        insertFigureWithImage(figure, data.url);
    } catch (err) {
        if (figure.parentNode) figure.parentNode.removeChild(figure);
        if (errorMsg) {
            errorMsg.textContent = 'Upload failed';
            setTimeout(() => { if (errorMsg && errorMsg.textContent === 'Upload failed') errorMsg.textContent = ''; }, 3000);
        }
    }
}

// Camera upload button setup
if (btnCamera) {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    btnCamera.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async () => {
        if (fileInput.files && fileInput.files[0]) {
            await uploadAndInsertImage(fileInput.files[0]);
            fileInput.value = '';
        }
    });
}

// Embed button setup
if (btnEmbed) {
    btnEmbed.addEventListener('click', () => {
        embedMode = 'embed';
        if (currentActiveNode) {
            currentActiveNode.setAttribute('data-placeholder', 'Paste a YouTube, Vimeo or Twitter link, and press Enter');
            currentActiveNode.classList.add('embed-placeholder');
            canvasEl.classList.remove('empty');
            currentActiveNode.focus();
        }
    });
}

// Paste event for images
if (canvasEl) {
    canvasEl.addEventListener('paste', async (e) => {
        const items = (e.clipboardData || window.clipboardData)?.items;
        if (!items) return;
        for (let item of items) {
            if (item.type.indexOf('image') === 0) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) await uploadAndInsertImage(file);
                return;
            }
        }
    });
}

// Keydown handler: enter, backspace, figcaption, embed fetch
if (canvasEl) {
    canvasEl.addEventListener('keydown', async (e) => {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        
        // Let native browser handle selections (e.g. Ctrl+A -> Backspace)
        if (!sel.isCollapsed && (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter')) {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                setTimeout(() => {
                    if (canvasEl.innerHTML.trim() === '' || canvasEl.innerHTML === '<br>') {
                        canvasEl.innerHTML = '<p><br></p>';
                        setCaret(canvasEl.firstElementChild, 0);
                    }
                    updatePlaceholder();
                }, 10);
            }
            return;
        }

        let node = sel.anchorNode;
        if (node && node.nodeType === 3) node = node.parentNode;
        const block = getActiveBlock(node);

        // Enter key in figcaption: move caret to trailing paragraph
        if (e.key === 'Enter' && node && (node.tagName === 'FIGCAPTION' || node.closest('figcaption'))) {
            if (!e.shiftKey) {
                e.preventDefault();
                const fig = (node.tagName === 'FIGCAPTION' ? node : node.closest('figcaption')).closest('figure');
                if (fig) {
                    let nextP = fig.nextElementSibling;
                    if (!nextP || nextP.tagName !== 'P') {
                        nextP = document.createElement('p');
                        nextP.innerHTML = '<br>';
                        fig.parentNode.insertBefore(nextP, fig.nextSibling);
                    }
                    setCaret(nextP, 0);
                }
                return;
            }
        }

        // Backspace inside empty figcaption deletes the figure
        if (e.key === 'Backspace' && node && (node.tagName === 'FIGCAPTION' || node.closest('figcaption'))) {
            const figCap = node.tagName === 'FIGCAPTION' ? node : node.closest('figcaption');
            if (figCap.textContent.trim() === '') {
                e.preventDefault();
                const fig = figCap.closest('figure');
                if (fig) {
                    let prev = fig.previousElementSibling;
                    if (!prev) {
                        prev = document.createElement('p');
                        prev.innerHTML = '<br>';
                        fig.parentNode.insertBefore(prev, fig);
                    }
                    fig.parentNode.removeChild(fig);
                    const target = prev.lastChild || prev;
                    setCaret(target, target.textContent.length || 0);
                    updatePlaceholder();
                }
                return;
            }
        }

        // Enter key handling
        if (e.key === 'Enter') {
            const lineText = node.textContent.trim();

            // Link or Image URL conversion on Enter
            if (lineText.startsWith('http://') || lineText.startsWith('https://')) {
                if (embedMode || /\.(jpeg|jpg|gif|png|webp)($|\?)/i.test(lineText) || lineText.includes('picsum.photos') || lineText.includes('unsplash.com')) {
                    e.preventDefault();
                    hideLinkTooltip();
                    node.textContent = 'Fetching...';
                    
                    try {
                        const res = await fetch('/api/fetch-url', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ url: lineText })
                        });
                        if (!res.ok) throw new Error('Fetch failed');
                        const data = await res.json();
                        insertFigureWithImage(node, data.url);
                    } catch (err) {
                        node.textContent = lineText;
                        if (errorMsg) {
                            errorMsg.textContent = 'Failed to load image.';
                            setTimeout(() => { if (errorMsg && errorMsg.textContent === 'Failed to load image.') errorMsg.textContent = ''; }, 3000);
                        }
                    }
                    embedMode = null;
                    node.classList.remove('embed-placeholder');
                    return;
                }
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
                        setCaret(p, 0);
                        return;
                    }
                    
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
                            setCaret(p, 0);
                            return;
                        }
                    }
                }
            }
        }

        // Backspace handling: escape blockquote, heading, pre when empty
        if (e.key === 'Backspace' && block && sel.isCollapsed) {
            // Jump to figure caption if at the start of a block immediately following a figure
            if (sel.anchorOffset === 0 && (sel.anchorNode === block || sel.anchorNode === block.firstChild)) {
                const prevNode = block.previousElementSibling;
                if (prevNode && prevNode.tagName === 'FIGURE') {
                    e.preventDefault();
                    const figcap = prevNode.querySelector('figcaption');
                    if (figcap) {
                        figcap.focus();
                        const target = figcap.lastChild && figcap.lastChild.nodeType === 3 ? figcap.lastChild : figcap;
                        setCaret(target, target.textContent ? target.textContent.length : 0);
                        if (block.textContent.replace(/\u200B/g, '').trim() === '') {
                            block.remove();
                        }
                    }
                    return;
                }
            }

            const tag = block.tagName;
            if (['BLOCKQUOTE', 'H1', 'H2', 'H3', 'PRE'].includes(tag)) {
                const text = block.textContent.replace(/\u200B/g, '').trim();
                if (text === '' || (sel.anchorOffset === 0 && (sel.anchorNode === block || sel.anchorNode === block.firstChild))) {
                    e.preventDefault();
                    const p = document.createElement('p');
                    p.innerHTML = text ? text : '<br>';
                    block.parentNode.replaceChild(p, block);
                    setCaret(text && p.firstChild ? p.firstChild : p, 0);
                    return;
                }
            }
        }
    });
}

function transformBlock(node, tag, text) {
    node.textContent = (text === undefined || text.trim() === '') ? '\u200B' : text;
    const target = node.firstChild && node.firstChild.nodeType === 3 ? node.firstChild : node;
    setCaret(target, target.nodeType === 3 ? target.length : 0);
    document.execCommand('formatBlock', false, tag);
}

// Markdown input formatting & Live URL tooltip detection
if (canvasEl) {
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

        // Check if caret is in a line with a typed/pasted URL for live tooltip
        if (parentBlock) {
            const text = parentBlock.textContent.trim();
            if (text.startsWith('http://') || text.startsWith('https://')) {
                showLinkTooltip(parentBlock, text);
            } else {
                hideLinkTooltip();
            }
        }

        // Check inline markdown (code, bold) on text nodes
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
                setCaret(afterNode, afterNode.length);
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
                setCaret(afterNode, afterNode.length);
                return;
            }
        }

        // Block markdown conversion
        if (parentBlock && (parentBlock.tagName === 'P' || parentBlock.tagName === 'DIV')) {
            const text = parentBlock.textContent;

            // Code block ```
            if (text.startsWith('```')) {
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.innerHTML = '<br>';
                pre.appendChild(code);
                parentBlock.parentNode.replaceChild(pre, parentBlock);
                setCaret(code, 0);
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
                const target = rem.trim() && li.firstChild ? li.firstChild : li;
                setCaret(target, rem.trim() && li.firstChild ? rem.length : 0);
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
                const target = rem.trim() && li.firstChild ? li.firstChild : li;
                setCaret(target, rem.trim() && li.firstChild ? rem.length : 0);
                return;
            }

            // Horizontal rule
            if (text === '---') {
                const hr = document.createElement('hr');
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                parentBlock.parentNode.replaceChild(hr, parentBlock);
                hr.parentNode.insertBefore(p, hr.nextSibling);
                setCaret(p, 0);
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
}

function saveDraft() {
    if (window.location.pathname === '/' && titleEl && authorEl && canvasEl) {
        localStorage.setItem('folio_draft_title', titleEl.value);
        localStorage.setItem('folio_draft_author', authorEl.value);
        localStorage.setItem('folio_draft_content', canvasEl.innerHTML);
    }
}

const inputsWrapper = document.querySelector('.folio-inputs');
if (inputsWrapper && titleEl && authorEl) {
    inputsWrapper.addEventListener('input', (e) => {
        if (e.target === titleEl) {
            titleEl.classList.remove('error');
            if (errorMsg) errorMsg.textContent = '';
        }
        if (isArticleEditing && authorDot && authorEl) {
            authorDot.style.display = authorEl.textContent.trim() ? 'inline' : 'none';
        }
        saveDraft();
    });
}

// Onload handlers
window.addEventListener('load', () => {
    if (window.location.pathname === '/' && titleEl && authorEl && canvasEl) {
        titleEl.value = localStorage.getItem('folio_draft_title') || '';
        authorEl.value = localStorage.getItem('folio_draft_author') || '';
        canvasEl.innerHTML = localStorage.getItem('folio_draft_content') || '<p><br></p>';
        updatePlaceholder();
    }
});

// Home Page Publish Button Handler
if (publishBtn) {
    publishBtn.addEventListener('click', async () => {
        if (!titleEl.value.trim()) {
            titleEl.classList.add('error');
            if (errorMsg) errorMsg.textContent = 'Title is too small';
            titleEl.focus();
            return;
        }

        const html = canvasEl.innerHTML;
        const res = await fetch('/api/articles', {
            method: 'POST',
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
            if (errorMsg) errorMsg.textContent = errText || 'Failed to publish';
        }
    });
}

// In-Place Article Editor Handler (for /{slug})
if (editBtn) {
    const slug = window.location.pathname.replace(/^\//, '').split('?')[0];

    function enterInPlaceEdit() {
        isArticleEditing = true;
        titleEl.contentEditable = 'true';
        if (authorEl) {
            authorEl.contentEditable = 'true';
            if (authorDot && !authorEl.textContent.trim()) {
                authorDot.style.display = 'none';
            }
        }
        canvasEl.contentEditable = 'true';
        
        // Setup figures for editing
        canvasEl.querySelectorAll('figure').forEach(fig => {
            fig.contentEditable = 'false';
            fig.tabIndex = -1;
        });

        // Make existing figcaptions editable
        canvasEl.querySelectorAll('figcaption').forEach(fc => {
            fc.contentEditable = 'true';
            fc.setAttribute('data-placeholder', 'Caption (optional)');
            if (fc.textContent.trim() === '') fc.classList.add('empty');
        });

        editBtn.textContent = 'SAVE';
        updatePlaceholder();
        titleEl.focus();
    }

    async function saveInPlaceEdit() {
        const titleText = titleEl ? (titleEl.tagName === 'INPUT' ? titleEl.value.trim() : titleEl.innerText.trim()) : '';
        const authorText = authorEl ? (authorEl.tagName === 'INPUT' ? authorEl.value.trim() : authorEl.innerText.trim()) : '';
        const contentHtml = canvasEl.innerHTML;

        if (!titleText) {
            titleEl.focus();
            return;
        }

        editBtn.textContent = 'SAVING...';
        try {
            const res = await fetch('/api/articles/' + slug, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    title: titleText,
                    author_name: authorText,
                    content_html: contentHtml
                })
            });
            if (res.ok) {
                isArticleEditing = false;
                titleEl.contentEditable = 'false';
                if (authorEl) {
                    authorEl.contentEditable = 'false';
                    if (authorDot) {
                        authorDot.style.display = authorText ? 'inline' : 'none';
                    }
                }
                canvasEl.contentEditable = 'false';
                canvasEl.querySelectorAll('figcaption').forEach(fc => {
                    fc.contentEditable = 'false';
                });
                editBtn.textContent = 'EDIT';
                hideFormatBubble();
                hideLinkTooltip();
                if (toolbar) toolbar.classList.remove('active');
                document.title = titleText;
                
                // Clear ?edit=1 from URL bar cleanly
                if (window.location.search.includes('edit=1')) {
                    window.history.replaceState({}, '', '/' + slug);
                }
            } else {
                editBtn.textContent = 'SAVE';
            }
        } catch (err) {
            editBtn.textContent = 'SAVE';
        }
    }

    editBtn.addEventListener('click', () => {
        if (!isArticleEditing) {
            enterInPlaceEdit();
        } else {
            saveInPlaceEdit();
        }
    });

    if (new URLSearchParams(window.location.search).get('edit') === '1') {
        enterInPlaceEdit();
    }
}