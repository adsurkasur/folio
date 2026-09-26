import re

with open('web/static/folio.js', 'r', encoding='utf-8') as f:
    code = f.read()

code = re.sub(r"editBtn\.textContent = '([^']+)'", r"switchButtonText(editBtn, '\1')", code)
code = re.sub(r"publishBtn\.textContent = '([^']+)'", r"switchButtonText(publishBtn, '\1')", code)

with open('web/static/folio.js', 'w', encoding='utf-8') as f:
    f.write(code)
