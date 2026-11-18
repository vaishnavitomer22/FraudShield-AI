/**
 * Model, data and consistency tests (no dependencies).   node tests/model.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const FS = require(path.join(root, 'model/fraud_model.js'));
const { loadModel } = require(path.join(root, 'model/load_model.js'));

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS  ' + name); }
  catch (e) { failed++; console.log('  FAIL  ' + name + '\n        ' + e.message); }
}
const tx = (o) => Object.assign({ type: 'PAYMENT', hour: 14, amount: 1200, oldOrg: 50000, newOrg: 48800, oldDest: 0, newDest: 0 }, o);

console.log('Model metrics');
test('accuracy rounds to 97.6%', () => assert.strictEqual((FS.metrics.accuracy * 100).toFixed(1), '97.6'));
test('precision rounds to 78.0%', () => assert.strictEqual((FS.metrics.precision * 100).toFixed(1), '78.0'));
test('recall rounds to 89.5%', () => assert.strictEqual((FS.metrics.recall * 100).toFixed(1), '89.5'));
test('AUC rounds to 0.969', () => assert.strictEqual(FS.metrics.auc.toFixed(3), '0.969'));
test('confusion matrix adds up to the 2,400 hold-out records', () => { const m = FS.metrics; assert.strictEqual(m.tp + m.fp + m.fn + m.tn, 2400); });

console.log('Data');
test('12,000 records, 9,600 train / 2,400 test', () => { assert.strictEqual(FS.data.length, 12000); assert.strictEqual(FS.train.length, 9600); assert.strictEqual(FS.test.length, 2400); });
test('test records are the last 2,400 (no overlap with training)', () => assert.ok(FS.test.every((t, i) => t === FS.data[9600 + i])));
test('fraud is concentrated in TRANSFER and CASH_OUT', () => {
  const f = FS.data.filter(t => t.fraud), risky = f.filter(t => t.type === 'TRANSFER' || t.type === 'CASH_OUT').length;
  assert.ok(risky / f.length > 0.95, 'share ' + risky / f.length);
});
test('dataset is deterministic (same seed -> same weights in a fresh process)', () => {
  const run = () => execFileSync('node', ['-e', "const F=require('./model/fraud_model.js');console.log(JSON.stringify(F.params.w))"], { cwd: root }).toString();
  assert.strictEqual(run(), run());
});
test('sample CSV has a header and 300 rows', () => {
  const lines = fs.readFileSync(path.join(root, 'data/sample_transactions.csv'), 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 301); assert.strictEqual(lines[0].split(',').length, 10);
});

console.log('Predictions');
const cases = [
  ['everyday payment', tx({}), false],
  ['salary cash-in', tx({ type: 'CASH_IN', amount: 42000, oldOrg: 8000, newOrg: 50000, hour: 11 }), false],
  ['normal transfer', tx({ type: 'TRANSFER', amount: 15000, oldOrg: 90000, newOrg: 75000, oldDest: 60000, newDest: 75000, hour: 16 }), false],
  ['account drained to new account', tx({ type: 'TRANSFER', amount: 181000, oldOrg: 181000, newOrg: 0, hour: 3 }), true],
  ['cash-out after takeover', tx({ type: 'CASH_OUT', amount: 215000, oldOrg: 215000, newOrg: 0, oldDest: 21182, newDest: 236182, hour: 2 }), true]
];
cases.forEach(([name, t, fraud]) => test(name + ' -> ' + (fraud ? 'FRAUD' : 'LEGITIMATE'), () => assert.strictEqual(FS.predict(t).fraud, fraud)));
test('risk score equals 100 x model probability', () => { const r = FS.predict(cases[3][1]); assert.ok(Math.abs(r.score - r.p * 100) < 0.051); });
test('probabilities stay within 0..1', () => assert.ok(FS.scores.every(p => p >= 0 && p <= 1)));
test('explanations are produced for every verdict', () => assert.ok(FS.predict(cases[3][1]).contrib.filter(x => x.c > 0.2).length >= 3));

console.log('Save / load');
test('saved model parameters equal the live model', () => assert.deepStrictEqual(loadModel().saved.params, FS.params));
test('loaded model gives identical predictions on 200 test records', () => {
  const m = loadModel(); FS.test.slice(0, 200).forEach(t => assert.strictEqual(m.predict(t).p, FS.predict(t).p));
});
test('saved hold-out metrics match the live model', () => assert.strictEqual(loadModel().saved.holdoutMetrics.tp, FS.metrics.tp));
test('evaluation_results.json matches the live model', () => {
  const e = JSON.parse(fs.readFileSync(path.join(root, 'model/evaluation_results.json'), 'utf8'));
  assert.deepStrictEqual(e.confusionMatrix, { tn: FS.metrics.tn, fp: FS.metrics.fp, fn: FS.metrics.fn, tp: FS.metrics.tp });
});

console.log('Website consistency');
test('model code in the website is identical to model/fraud_model.js', () => {
  const grab = s => s.slice(s.indexOf('// ML_START'), s.indexOf('// ML_END') + 9).trim();
  const a = grab(fs.readFileSync(path.join(root, 'model/fraud_model.js'), 'utf8'));
  const b = grab(fs.readFileSync(path.join(root, 'frontend/FraudShield_AI.html'), 'utf8'));
  assert.ok(a.length > 1000 && a === b);
});
test('website contains no phone-number checker', () => assert.ok(!/phoneInput|scorePhone/i.test(fs.readFileSync(path.join(root, 'frontend/FraudShield_AI.html'), 'utf8'))));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
