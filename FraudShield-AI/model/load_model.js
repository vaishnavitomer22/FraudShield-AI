/**
 * Loads the saved model (model/fraud_model.json) and predicts a transaction.
 *
 *   node model/load_model.js                       # runs a built-in example
 *   node model/load_model.js '{"type":"TRANSFER","hour":3,"amount":181000,"oldOrg":181000,"newOrg":0,"oldDest":0,"newDest":0}'
 *
 * Field names: type (PAYMENT|TRANSFER|CASH_OUT|CASH_IN|DEBIT), hour (0-23), amount,
 * oldOrg / newOrg (sender balance before / after), oldDest / newDest (receiver balance before / after).
 */
const fs = require('fs');
const path = require('path');
const FS = require('./fraud_model.js');

function loadModel(file = path.join(__dirname, 'fraud_model.json')) {
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { saved, predict: tx => FS.predictWith(saved.params, tx) };
}
module.exports = { loadModel };

if (require.main === module) {
  const tx = process.argv[2] ? JSON.parse(process.argv[2])
    : { type: 'TRANSFER', hour: 3, amount: 181000, oldOrg: 181000, newOrg: 0, oldDest: 0, newDest: 0 };
  const r = loadModel().predict(tx);
  console.log('Transaction :', JSON.stringify(tx));
  console.log('Verdict     :', r.fraud ? 'FRAUD' : 'LEGITIMATE');
  console.log('Fraud risk  :', r.score + '%  (' + r.level + ')');
  console.log('Raising risk:');
  r.contrib.filter(x => x.c > 0.2).sort((a, b) => b.c - a.c).slice(0, 5).forEach(x => console.log('  +', x.text));
}
