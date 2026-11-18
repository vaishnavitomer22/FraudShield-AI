/**
 * Evaluates the model on the 2,400 hold-out transactions that were never used
 * for training, prints a report and writes model/evaluation_results.json.
 *
 *   node model/evaluate_model.js
 */
const fs = require('fs');
const path = require('path');
const FS = require('./fraud_model.js');

const p = FS.scores, y = FS.labels, n = y.length, thr = FS.config.threshold;
const cm = (t) => { let tp = 0, fp = 0, fn = 0, tn = 0; p.forEach((s, i) => { const pr = s >= t; if (pr && y[i]) tp++; else if (pr) fp++; else if (y[i]) fn++; else tn++; }); return { tp, fp, fn, tn }; };
const safe = (a, b) => (b ? a / b : 0);
const prf = (tp, fp, fn) => { const pr = safe(tp, tp + fp), rc = safe(tp, tp + fn); return { precision: pr, recall: rc, f1: safe(2 * pr * rc, pr + rc) }; };

const { tp, fp, fn, tn } = cm(thr);
const fraud = prf(tp, fp, fn), legit = prf(tn, fn, fp);   // for the legitimate class the roles swap
const accuracy = (tp + tn) / n;
const macro = k => (fraud[k] + legit[k]) / 2;
const nFraud = tp + fn, nLegit = tn + fp;
const weighted = k => (fraud[k] * nFraud + legit[k] * nLegit) / n;

// ROC curve (thresholds taken from the sorted scores, down-sampled for the JSON file)
const order = p.map((_, i) => i).sort((a, b) => p[b] - p[a]);
let ctp = 0, cfp = 0; const roc = [[0, 0]];
order.forEach((i, k) => { y[i] ? ctp++ : cfp++; if (k % 12 === 0 || k === n - 1) roc.push([cfp / nLegit, ctp / nFraud]); });

// Threshold sweep
const sweep = [0.3, 0.4, 0.5, 0.6, 0.7].map(t => { const c = cm(t); return { threshold: t, ...prf(c.tp, c.fp, c.fn), tp: c.tp, fp: c.fp, fn: c.fn, tn: c.tn }; });

// Learned weights (features are standardised, so weights are comparable)
const weights = FS.featureNames.map((name, j) => ({ feature: name, weight: FS.params.w[j] })).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

const result = {
  note: 'Computed on SYNTHETIC data. Not representative of real-world banking performance.',
  holdoutRecords: n, fraudRecords: nFraud, legitimateRecords: nLegit, threshold: thr,
  accuracy, auc: FS.metrics.auc, confusionMatrix: { tn, fp, fn, tp },
  classificationReport: {
    LEGITIMATE: { ...legit, support: nLegit }, FRAUD: { ...fraud, support: nFraud },
    macroAvg: { precision: macro('precision'), recall: macro('recall'), f1: macro('f1'), support: n },
    weightedAvg: { precision: weighted('precision'), recall: weighted('recall'), f1: weighted('f1'), support: n }
  },
  featureWeights: weights, thresholdSweep: sweep, roc
};
fs.writeFileSync(path.join(__dirname, 'evaluation_results.json'), JSON.stringify(result, null, 2) + '\n');

const f = (v, d = 3) => v.toFixed(d).padStart(9);
console.log('FraudShield AI — hold-out evaluation (' + n + ' transactions, threshold ' + thr + ')\n');
console.log('Confusion matrix');
console.log('                       pred LEGITIMATE   pred FRAUD');
console.log('  actual LEGITIMATE   ' + String(tn).padStart(14) + String(fp).padStart(13));
console.log('  actual FRAUD        ' + String(fn).padStart(14) + String(tp).padStart(13) + '\n');
console.log('Classification report');
console.log('               precision   recall       f1   support');
for (const [k, v] of Object.entries(result.classificationReport)) console.log('  ' + k.padEnd(11) + f(v.precision) + f(v.recall) + f(v.f1) + String(v.support).padStart(9));
console.log('\n  accuracy   ' + f(accuracy) + '        ROC AUC ' + FS.metrics.auc.toFixed(4));
console.log('\nLearned feature weights (standardised features; + raises fraud risk)');
weights.forEach(w => console.log('  ' + w.feature.padEnd(11) + (w.weight >= 0 ? '+' : '') + w.weight.toFixed(3)));
console.log('\nThreshold sweep');
sweep.forEach(s => console.log('  thr ' + s.threshold + '  precision ' + (100 * s.precision).toFixed(1) + '%  recall ' + (100 * s.recall).toFixed(1) + '%  FP ' + s.fp + '  FN ' + s.fn));
console.log('\nWritten to model/evaluation_results.json');
