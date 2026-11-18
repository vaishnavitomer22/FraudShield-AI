/**
 * Browser tests of the real website (needs Playwright).
 *   npm install && npx playwright install chromium
 *   node tests/e2e.test.js
 */
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.resolve(__dirname, '../frontend/FraudShield_AI.html');

let passed = 0, failed = 0;
const check = (name, ok, extra = '') => { ok ? passed++ : failed++; console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra ? '  [' + extra + ']' : '')); };
const topOf = (p, sel) => p.evaluate(s => Math.round(document.querySelector(s).getBoundingClientRect().top), sel);
const dash = p => p.evaluate(() => ['dTotal', 'dFraud', 'dLegit'].map(i => +document.getElementById(i).textContent.replace(/,/g, '')));

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts|net::|ERR_/.test(m.text())) errors.push(m.text()); });
  await p.goto(URL, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500);

  console.log('Get Started Free');
  await p.click('text=Get Started Free'); await p.waitForTimeout(1600);
  check('scrolls to the analyzer', Math.abs(await topOf(p, '#demo') - 76) < 30);
  check('focuses the Amount field', await p.evaluate(() => document.activeElement.id) === 'txAmount');
  check('form is pre-filled and ready (amount 1200)', await p.inputValue('#txAmount') === '1200');

  console.log('Navigation and buttons');
  for (const id of ['features', 'demo', 'how-it-works', 'dashboard', 'platforms', 'stats', 'contact']) {
    await p.click(`.nav-links a[href="#${id}"]`); await p.waitForTimeout(1300);
    check('nav link #' + id, Math.abs(await topOf(p, '#' + id)) < 130);
  }
  await p.click('.nav-actions .btn-login'); await p.waitForTimeout(1300); check('nav "Dashboard" button', Math.abs(await topOf(p, '#dashboard') - 76) < 30);
  await p.click('.nav-actions .btn-demo'); await p.waitForTimeout(1300); check('nav "Analyze Now" button', Math.abs(await topOf(p, '#demo') - 76) < 30);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  await p.click('text=Watch Demo'); await p.waitForTimeout(2200);
  check('"Watch Demo" shows a FRAUD verdict', (await p.textContent('#verdict')).includes('FRAUD'));
  await p.click('#contact .btn-primary'); await p.waitForTimeout(1500); check('CTA "Analyze a Transaction"', Math.abs(await topOf(p, '#demo') - 76) < 30);
  await p.click('#contact .btn-secondary'); await p.waitForTimeout(1500); check('CTA "View Dashboard"', Math.abs(await topOf(p, '#dashboard') - 76) < 30);
  const links = await p.$$eval('.footer a', a => a.map(x => x.textContent.trim())); let dead = [];
  for (const t of links) {
    await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(150);
    const before = await p.evaluate(() => scrollY); await p.locator('.footer a', { hasText: t }).first().click(); await p.waitForTimeout(900);
    const modal = await p.evaluate(() => !document.querySelector('.modal').hidden), after = await p.evaluate(() => scrollY);
    if (modal) await p.keyboard.press('Escape'); else if (Math.abs(after - before) < 20) dead.push(t);
  }
  check('all ' + links.length + ' footer/social links respond', dead.length === 0, dead.join(','));

  console.log('Fraud detection');
  const preset = async k => { await p.locator('.demo-preset', { hasText: k }).first().click(); return p.evaluate(() => ({ v: verdict.textContent, s: parseFloat(demoScore.textContent), lvl: levelChip.textContent })); };
  await p.click('#clearDash');   // start from an empty dashboard (earlier clicks, e.g. Watch Demo, also count as analyses)
  await p.evaluate(() => document.getElementById('demo').scrollIntoView());
  let r = await preset('Everyday payment'); check('everyday payment -> LEGITIMATE', r.v.includes('LEGITIMATE') && r.s < 25, r.v + ' ' + r.s + '%');
  r = await preset('Salary cash-in'); check('salary cash-in -> LEGITIMATE', r.v.includes('LEGITIMATE'), r.s + '%');
  r = await preset('Normal transfer'); check('normal transfer -> LEGITIMATE', r.v.includes('LEGITIMATE'), r.s + '%');
  r = await preset('Account drained'); check('account drained -> FRAUD', r.v.includes('FRAUD') && r.s > 90, r.s + '%');
  r = await preset('Cash-out after takeover'); check('cash-out after takeover -> FRAUD', r.v.includes('FRAUD') && r.s > 90, r.s + '%');
  check('gauge arc animates to the score', await p.evaluate(() => parseFloat(gArc.style.strokeDashoffset) < 100));
  check('explanation lists are shown', await p.evaluate(() => document.querySelectorAll('#badList li').length > 0));
  check('dashboard counted 5 analyses (2 fraud, 3 legitimate)', JSON.stringify(await dash(p)) === '[5,2,3]', JSON.stringify(await dash(p)));
  await p.click('#demoReset'); await p.selectOption('#txType', 'CASH_OUT'); await p.fill('#txAmount', '10000'); await p.fill('#txOldOrg', '10000');
  check('"balance after" fields auto-calculate', await p.inputValue('#txNewOrg') === '0' && await p.inputValue('#txNewDest') === '10000');
  await p.fill('#txAmount', ''); await p.click('#demoCheck'); check('empty amount shows an error', await p.isVisible('#demoError'));
  await p.fill('#txAmount', '-4'); await p.click('#demoCheck'); check('negative amount shows an error', await p.isVisible('#demoError'));
  await p.selectOption('#txType', 'PAYMENT'); check('receiver balances read-only for PAYMENT', await p.evaluate(() => txOldDest.readOnly && txNewDest.readOnly));
  check('invalid input did not change the dashboard', (await dash(p))[0] === 5);

  console.log('Dashboard');
  await p.click('#loadSamples'); let [t, f, l] = await dash(p); check('25 samples added; total = fraud + legitimate', t === 30 && t === f + l, t + '=' + f + '+' + l);
  check('charts drawn (bars, type rows, history)', await p.evaluate(() => document.querySelectorAll('#barsG rect').length === 20 && document.querySelectorAll('.type-row').length === 5 && document.querySelectorAll('#txFeed .feed-item').length === 8));
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForTimeout(1500);
  check('data persists after reload', (await dash(p))[0] === 30);
  await p.click('#clearDash'); check('"Clear dashboard" resets to zero', JSON.stringify(await dash(p)) === '[0,0,0]');

  console.log('Responsive');
  for (const w of [360, 390, 600, 820, 1024, 1366, 1920]) {
    const q = await (await browser.newContext({ viewport: { width: w, height: 800 } })).newPage();
    await q.goto(URL, { waitUntil: 'domcontentloaded' }); await q.waitForTimeout(1800);
    await q.evaluate(() => scrollTo(300, 0)); check('no sideways scroll at ' + w + 'px', await q.evaluate(() => scrollX) === 0);
    if (w === 390) {
      await q.click('#hamburger'); await q.waitForTimeout(500); check('mobile menu opens', await q.evaluate(() => document.body.classList.contains('menu-open')));
      await q.click('.nav-links a[href="#dashboard"]'); await q.waitForTimeout(1500);
      check('mobile menu closes after choosing a link', await q.evaluate(() => !document.body.classList.contains('menu-open')));
      await q.click('#hamburger'); await q.keyboard.press('Escape'); check('Esc closes the mobile menu', await q.evaluate(() => !document.body.classList.contains('menu-open')));
    }
    await q.close();
  }
  check('no JavaScript errors in the console', errors.length === 0, errors.join(' | '));
  await browser.close();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
