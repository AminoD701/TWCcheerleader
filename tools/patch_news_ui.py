from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')
original = text

text = text.replace('每日情報 INTEL', '最新情報 INTEL')
text = text.replace('每日情報 (news)', '最新情報 (news)')
text = text.replace('每日情報專屬彈窗', '最新情報專屬彈窗')
text = text.replace('每日動態情報牆核心渲染引擎', '最新情報牆核心渲染引擎')

old_split = '''            // ✨ 4. 智慧分流：將「短動態」與「一般新聞」徹底拆開處理
            let shortPosts = [];
            let longPosts = [];
            
            sortedNews.forEach(n => {
                const tagText = getField(n, ['tag', '標籤', '分類標籤', '分類'], '情報');
                const isShort = tagText.includes('快訊') || tagText.includes('動態') || tagText.toLowerCase().includes('threads') || tagText.includes('脆') || tagText.toLowerCase().includes('ig');
                if (isShort) shortPosts.push(n);
                else longPosts.push(n);
            });
'''
new_split = '''            // 4. 所有情報統一進入一般情報流，不再建立獨立「社群時報」區塊
            let shortPosts = [];
            let longPosts = [...sortedNews];
'''

if old_split in text:
    text = text.replace(old_split, new_split, 1)
else:
    text = text.replace('let shortPosts = [];\n            let longPosts = [];', 'let shortPosts = [];\n            let longPosts = [...sortedNews];', 1)

if text == original:
    print('No changes were required.')
else:
    path.write_text(text, encoding='utf-8')
    print('index.html patched successfully.')
