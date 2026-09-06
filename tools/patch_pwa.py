from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

manifest = '<link rel="manifest" href="manifest.json">'
head_additions = '''<link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#111418">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="啦啦隊資料庫">
    <link rel="apple-touch-icon" href="baseball.png">
    <script defer src="pwa.js"></script>'''

if 'src="pwa.js"' not in text:
    if manifest in text:
        text = text.replace(manifest, head_additions, 1)
    else:
        text = text.replace('</head>', f'    {head_additions}\n</head>', 1)

if text != original:
    path.write_text(text, encoding='utf-8')
    print('PWA app mode added to index.html')
else:
    print('PWA app mode already present')
