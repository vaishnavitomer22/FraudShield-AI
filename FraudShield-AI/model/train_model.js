/**
 * Trains the FraudShield AI model and saves it to model/fraud_model.json.
 *
 *   node model/train_model.js
 *
 * Training itself (feature standardisation + class-weighted logistic regression
 * by gradient descent) lives in model/fraud_model.js and is deterministic: the
 * data generator uses a fixed seed, so every run produces the same weights.
 */
const fs = require('fs');
const path = require('path');
const FS = require('./fraud_model.js');

const c = FS.config, m = FS.metrics;
console.log('Training configuration');
console.log('  records           :', c.records, `(train ${c.trainRecords} / test ${c.testRecords})`);
console.log('  features          :', FS.featureNames.length);
console.log('  optimiser         : full-batch gradient descent,', c.epochs, 'epochs, learning rate', c.learningRate);
console.log('  regularisation    : L2 =', c.l2);
console.log('  fraud class weight:', c.fraudClassWeight);

const out = {
  name: 'FraudShield AI logistic regression',
  format: 'fraudshield-model-v1',
  note: 'Trained on SYNTHETIC PaySim-style data. Metrics do not represent real-world banking performance.',
  config: c,
  features: FS.featureNames,
  params: FS.params,            // standardisation (mu, sd), weights w, bias b
  holdoutMetrics: {
    accuracy: m.accuracy, precision: m.precision, recall: m.recall, f1: m.f1, auc: m.auc,
    n: m.n, tp: m.tp, fp: m.fp, fn: m.fn, tn: m.tn
  }
};
fs.writeFileSync(path.join(__dirname, 'fraud_model.json'), JSON.stringify(out, null, 2) + '\n');
console.log('\nModel saved to model/fraud_model.json');
console.log('Hold-out accuracy', (m.accuracy * 100).toFixed(2) + '%  precision', (m.precision * 100).toFixed(2) + '%  recall', (m.recall * 100).toFixed(2) + '%  AUC', m.auc.toFixed(4));
