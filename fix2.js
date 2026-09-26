const fs = require('fs');
let code = fs.readFileSync('E:/Projects/folio/web/static/folio.js', 'utf8');

// Normalize CRLF to LF
code = code.replace(/\r\n/g, '\n');

const targetStr = `        // Let native browser handle selections (e.g. Ctrl+A -> Backspace)
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

const replacementStr = `        // Let native browser handle selections
        if (!sel.isCollapsed && (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter')) {
            e.preventDefault();
            
            // Manually remove figures that are part of the selection to prevent browser native delete bugs
            canvasEl.querySelectorAll('figure').forEach(fig => {
                if (sel.containsNode(fig, true)) {
                    fig.remove();
                }
            });

            document.execCommand('delete', false, null);
            
            if (e.key === 'Enter') {
                document.execCommand('insertParagraph', false, null);
            }

            setTimeout(() => {
                if (canvasEl.innerHTML.trim() === '' || canvasEl.innerHTML === '<br>') {
                    canvasEl.innerHTML = '<p><br></p>';
                    setCaret(canvasEl.firstElementChild, 0);
                }
                updatePlaceholder();
            }, 10);
            return;
        }`;

code = code.replace(targetStr, replacementStr);

// Convert back to CRLF
code = code.replace(/\n/g, '\r\n');

fs.writeFileSync('E:/Projects/folio/web/static/folio.js', code, 'utf8');
