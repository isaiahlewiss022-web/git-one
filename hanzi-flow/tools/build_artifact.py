"""Bundle index.html + styles.css + js/*.js into one single-file page (used for the claude.ai artifact).

Usage: python3 tools/build_artifact.py <project dir> <output html>
The data/ and vendor/ scripts stay as separate files next to the page.
"""
import re, sys, os
P, OUT = sys.argv[1], sys.argv[2]
html = open(os.path.join(P, 'index.html'), encoding='utf-8').read()
body = html[html.index('<body>') + 6 : html.rindex('</body>')]
head = html[: html.index('<body>')]
title = re.search(r'<title>.*?</title>', head, re.S).group(0)
meta = re.search(r'<meta[^>]*claude:viewport-fit-sides[^>]*>', head, re.S).group(0)
fonts = re.search(r'<link[^>]*fonts\.googleapis[^>]*>', head, re.S).group(0)
fonts = ' '.join(fonts.split())
css = open(os.path.join(P, 'styles.css'), encoding='utf-8').read()
scripts = re.findall(r'<script src="(js/[^"]+)"></script>', body)
js = '\n'.join(open(os.path.join(P, s), encoding='utf-8').read() for s in scripts)
body = re.sub(r'\s*<script src="js/[^"]+"></script>', '', body)
body = re.sub(r'\s*<!-- The app, in load order[^\n]*', '', body)
out = '\n'.join([title, meta, fonts, '<style>\n' + css + '</style>', body.strip(), '<script>\n' + js + '\n</script>', ''])
open(OUT, 'w', encoding='utf-8').write(out)
print('artifact page:', len(out), 'bytes;', len(scripts), 'scripts inlined')
