/**
 * Writes the synthetic transaction dataset used by FraudShield AI to CSV.
 * The records come from the same seeded generator the website uses, so the file
 * is identical to the data the browser model is trained and tested on.
 *
 *   node data/generate_dataset.js
 *
 * Outputs:
 *   data/synthetic_transactions.csv  all 12,000 records (git-ignored, re-creatable)
 *   data/sample_transactions.csv     first 300 records (committed, for a quick look)
 */
const fs = require('fs');
const path = require('path');
const FS = require('../model/fraud_model.js');

const HEADER = ['id', 'split', 'type', 'hour', 'amount', 'oldbalanceOrg', 'newbalanceOrig', 'oldbalanceDest', 'newbalanceDest', 'isFraud'];
const trainN = FS.config.trainRecords;
const rows = FS.data.map((t, i) => [
  'T' + String(i + 1).padStart(5, '0'), i < trainN ? 'train' : 'test',
  t.type, t.hour, t.amount, t.oldOrg, t.newOrg, t.oldDest, t.newDest, t.fraud ? 1 : 0].join(','));

fs.writeFileSync(path.join(__dirname, 'synthetic_transactions.csv'), [HEADER.join(','), ...rows].join('\n') + '\n');
fs.writeFileSync(path.join(__dirname, 'sample_transactions.csv'), [HEADER.join(','), ...rows.slice(0, 300)].join('\n') + '\n');

const count = (arr, f) => arr.filter(f).length;
const summary = split => {
  const d = FS.data.filter((_, i) => (i < trainN) === (split === 'train'));
  const f = count(d, t => t.fraud);
  return `${split.padEnd(5)} records=${d.length}  fraud=${f} (${(100 * f / d.length).toFixed(2)}%)`;
};
console.log('Dataset written to data/synthetic_transactions.csv (' + rows.length + ' rows)');
console.log(summary('train'));
console.log(summary('test'));
console.log('Transaction types:', FS.TYPES.map(k => k + '=' + count(FS.data, t => t.type === k)).join(', '));
console.log('Fraud by type    :', FS.TYPES.map(k => k + '=' + count(FS.data, t => t.type === k && t.fraud)).join(', '));
