const fs = require('fs');

let code = fs.readFileSync('E:/Projects/folio/web/static/folio.js', 'utf8');

// 1. Add switchButtonText
code = `let embedMode = null;
let isArticleEditing = false;
let savedBubbleRange = null;
let isMouseSelecting = false;

function switchButtonText(btn, text) {
    if (btn.textContent === text) return;
    btn.style.opacity = '0';
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        btn.textContent = text;
        btn.style.opacity = '1';
        btn.style.transform = 'scale(1)';
    }, 150);
}
` + code.replace(/let embedMode = null;[\s\S]*?let isMouseSelecting = false;/, '');

// 2. Replace textContent setters
code = code.replace(/editBtn\.textContent = 'SAVE';/g, "switchButtonText(editBtn, 'SAVE');");
code = code.replace(/editBtn\.textContent = 'SAVING\.\.\.';/g, "switchButtonText(editBtn, 'SAVING...');");
code = code.replace(/editBtn\.textContent = 'EDIT';/g, "switchButtonText(editBtn, 'EDIT');");

// 3. Add img onload handler for new images
code = code.replace(/img\.src = src;/, "img.onload = () => img.classList.add('loaded');\n    img.src = src;");

// 4. Add existing images fade-in logic
code += `
// Handle existing image fade-ins
document.querySelectorAll('.folio-canvas img').forEach(img => {
    if (img.complete) img.classList.add('loaded');
    else img.onload = () => img.classList.add('loaded');
});
`;

fs.writeFileSync('E:/Projects/folio/web/static/folio.js', code, 'utf8');
