document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    if (!canvas) return; // Not on editor page

    const titleInput = document.getElementById('title');
    const authorInput = document.getElementById('author');
    const publishBtn = document.getElementById('publishBtn');
    const bubble = document.getElementById('bubble');
    
    let isEditMode = publishBtn.dataset.slug ? true : false;
    let editSlug = publishBtn.dataset.slug || '';

    // Auto-save logic
    if (!isEditMode) {
        const draft = JSON.parse(localStorage.getItem('folio_draft') || '{}');
        if (draft.title) titleInput.value = draft.title;
        if (draft.author) authorInput.value = draft.author;
        if (draft.content) canvas.innerHTML = draft.content;

        const saveDraft = () => {
            localStorage.setItem('folio_draft', JSON.stringify({
                title: titleInput.value,
                author: authorInput.value,
                content: canvas.innerHTML
            }));
        };
        titleInput.addEventListener('input', saveDraft);
        authorInput.addEventListener('input', saveDraft);
        canvas.addEventListener('input', saveDraft);
    }

    // Markdown Auto-format & Auto-embed
    canvas.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const node = sel.anchorNode;
            if (node.nodeType === 3) { // Text node
                const text = node.textContent;
                
                // Embed Youtube
                const ytMatch = text.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                if (ytMatch && e.key === 'Enter') {
                    const iframe = document.createElement('iframe');
                    iframe.width = '100%';
                    iframe.height = '400';
                    iframe.src = `https://www.youtube.com/embed/${ytMatch[1]}`;
                    iframe.frameBorder = '0';
                    iframe.allowFullscreen = true;
                    node.parentNode.replaceChild(iframe, node);
                    return;
                }

                // Markdown
                if (text.startsWith('# ') && e.key === ' ') {
                    document.execCommand('formatBlock', false, 'H1');
                    node.textContent = text.substring(2);
                } else if (text.startsWith('## ') && e.key === ' ') {
                    document.execCommand('formatBlock', false, 'H2');
                    node.textContent = text.substring(3);
                } else if (text.startsWith('> ') && e.key === ' ') {
                    document.execCommand('formatBlock', false, 'BLOCKQUOTE');
                    node.textContent = text.substring(2);
                }
            }
        }
    });

    // Bubble Menu Logic
    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        if (sel.rangeCount > 0 && !sel.isCollapsed && canvas.contains(sel.anchorNode)) {
            const range = sel.getRangeAt(0).getBoundingClientRect();
            bubble.style.top = `${range.top + window.scrollY}px`;
            bubble.style.left = `${range.left + (range.width / 2)}px`;
            bubble.classList.add('active');
        } else {
            bubble.classList.remove('active');
        }
    });

    document.querySelectorAll('.bubble-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = btn.dataset.action;
            if (action === 'link') {
                const url = prompt('Enter link URL:');
                if (url) document.execCommand('createLink', false, url);
            } else if (['h1', 'h2', 'blockquote'].includes(action)) {
                document.execCommand('formatBlock', false, action);
            } else {
                document.execCommand(action, false, null);
            }
        });
    });

    // Image Upload (Paste & Drop)
    const uploadImage = async (file, nodeToReplace) => {
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Upload failed');
            const data = await res.json();
            
            const fig = document.createElement('figure');
            fig.innerHTML = `<img src="${data.url}"><figcaption contenteditable="true" placeholder="Caption (optional)"></figcaption>`;
            
            if (nodeToReplace) {
                nodeToReplace.parentNode.replaceChild(fig, nodeToReplace);
            } else {
                canvas.appendChild(fig);
            }
        } catch (err) {
            alert('Upload failed: ' + err.message);
        }
    };

    canvas.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.type.indexOf('image') === 0) {
                e.preventDefault();
                const file = item.getAsFile();
                
                // Placeholder
                const placeholder = document.createElement('p');
                placeholder.textContent = 'Uploading...';
                window.getSelection().getRangeAt(0).insertNode(placeholder);
                
                uploadImage(file, placeholder);
            }
        }
    });

    // Publish
    publishBtn.addEventListener('click', async () => {
        const payload = {
            title: titleInput.value.trim() || 'Untitled',
            author_name: authorInput.value.trim(),
            content_html: canvas.innerHTML
        };

        const method = isEditMode ? 'PUT' : 'POST';
        const url = isEditMode ? `/api/articles/${editSlug}` : '/api/articles';

        // Include token if available in URL
        const queryParams = new URLSearchParams(window.location.search);
        const token = queryParams.get('token');
        const fetchUrl = token ? `${url}?token=${token}` : url;

        publishBtn.disabled = true;
        publishBtn.textContent = 'Saving...';

        try {
            const res = await fetch(fetchUrl, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error || 'Failed to publish');

            localStorage.removeItem('folio_draft');
            
            if (!isEditMode && data.edit_token) {
                alert(`SUCCESS!\nSave this backup edit link:\n${window.location.origin}/${data.slug}?token=${data.edit_token}`);
            }
            window.location.href = `/${data.slug}`;
        } catch (err) {
            alert(err.message);
            publishBtn.disabled = false;
            publishBtn.textContent = isEditMode ? 'Save' : 'Publish';
        }
    });
});

// Delete Logic (only for article page with edit access)
const deleteBtn = document.getElementById('deleteBtn');
if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to permanently delete this article?')) return;
        
        const slug = deleteBtn.dataset.slug;
        const queryParams = new URLSearchParams(window.location.search);
        const token = queryParams.get('token');
        const url = token ? `/api/articles/${slug}?token=${token}` : `/api/articles/${slug}`;

        deleteBtn.disabled = true;
        try {
            const res = await fetch(url, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
            window.location.href = '/';
        } catch (err) {
            alert(err.message);
            deleteBtn.disabled = false;
        }
    });
}
