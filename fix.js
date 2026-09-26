const fs = require('fs');
let code = fs.readFileSync('E:/Projects/folio/web/static/folio.js', 'utf8');

// Normalize CRLF to LF
code = code.replace(/\r\n/g, '\n');

const targetStr = `        // Let native browser handle selections (e.g. Ctrl+A -> Backspace)
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
        }`;

const replacementStr = `        // Let native browser handle selections (e.g. Ctrl+A -> Backspace)
        if (!sel.isCollapsed && (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter')) {
            if (e.key === 'Backspace' || e.key === 'Delete') {
                e.preventDefault();
                const range = sel.getRangeAt(0);
                if (range.commonAncestorContainer === canvasEl || range.commonAncestorContainer.parentNode === canvasEl) {
                    const textLen = sel.toString().length;
                    const canvasLen = canvasEl.textContent.length;
                    if (textLen >= canvasLen - 1) { // selected almost everything
                        canvasEl.innerHTML = '<p><br></p>';
                        setCaret(canvasEl.firstElementChild, 0);
                        updatePlaceholder();
                        return;
                    }
                }
                document.execCommand('delete', false, null);
                setTimeout(() => {
                    if (canvasEl.innerHTML.trim() === '' || canvasEl.innerHTML === '<br>') {
                        canvasEl.innerHTML = '<p><br></p>';
                        setCaret(canvasEl.firstElementChild, 0);
                    }
                    updatePlaceholder();
                }, 10);
            }
            return;
        }`;

code = code.replace(targetStr, replacementStr);

const targetBubble = `    const sel = window.getSelection();
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
    
    const rect = range.getBoundingClientRect();`;

const replacementBubble = `    const sel = window.getSelection();
    if (!sel.rangeCount) {
        hideFormatBubble();
        return;
    }
    
    const range = sel.getRangeAt(0);
    let linkNode = null;
    
    if (sel.isCollapsed) {
        let node = range.startContainer;
        if (node.nodeType === 3) node = node.parentNode;
        linkNode = node.closest('a');
        if (!linkNode || !canvasEl.contains(linkNode)) {
            hideFormatBubble();
            return;
        }
    } else {
        if (!canvasEl.contains(range.commonAncestorContainer)) {
            hideFormatBubble();
            return;
        }
        const text = sel.toString().trim();
        if (!text) {
            hideFormatBubble();
            return;
        }
    }
    
    const rect = linkNode ? linkNode.getBoundingClientRect() : range.getBoundingClientRect();`;

code = code.replace(targetBubble, replacementBubble);

// Convert back to CRLF for Windows just in case
code = code.replace(/\n/g, '\r\n');

fs.writeFileSync('E:/Projects/folio/web/static/folio.js', code, 'utf8');
