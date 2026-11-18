from pathlib import Path
old='v5-unified-full-product-20261118/'
new='v5-bv2-media-v9-full-product-20261118/'
for filename,target in (
    ('tests/v5-collection-v2-webkit.test.cjs','tests/v5-collection-v2-webkit-combined.test.cjs'),
    ('tests/v5-unified-product-20261118.test.cjs','tests/v5-unified-product-combined.test.cjs')):
    s=Path(filename).read_text(encoding='utf-8')
    assert old in s,filename
    s=s.replace(old,new)
    if 'v5-unified-product-20261118.test.cjs' in filename:
        assert "const {chromium}=require('playwright-core');" in s
        s=s.replace("const {chromium}=require('playwright-core');","const {chromium}=require('playwright');")
        assert 'executablePath:chrome,' in s
        s=s.replace('executablePath:chrome,','')
        assert "if(!chrome)throw Error('Chrome not installed');" in s
        s=s.replace("if(!chrome)throw Error('Chrome not installed');",'')
    Path(target).write_text(s,encoding='utf-8')
print('PASS QA tests adapted ONLY to isolated product URL and bundled Chromium')
