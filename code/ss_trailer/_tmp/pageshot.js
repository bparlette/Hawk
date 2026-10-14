const { chromium } = require('/workspace/work/ss_trailer/node_modules/playwright');
const fs = require('fs');
(async () => { const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 390, height: 1600 } });
await pg.goto('file:///workspace/work/ss_trailer/deploy/index.html', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1500);
const s = await pg.context().newCDPSession(pg); const r = await s.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('/workspace/work/ss_trailer/_tmp/page_top.png', Buffer.from(r.data, 'base64')); await b.close(); })();
