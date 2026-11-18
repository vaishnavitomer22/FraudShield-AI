/**
 * FraudShield AI — fraud detection model (single source of truth)
 *
 * Everything between the ML_START / ML_END markers is copied VERBATIM into
 * frontend/FraudShield_AI.html, so the website and the Node.js scripts in this
 * repository run exactly the same model. tests/model.test.js checks that the two
 * copies are identical.
 *
 * What it does: generates synthetic PaySim-style transactions, engineers 15
 * features, trains a class-weighted logistic regression by gradient descent,
 * evaluates it on a hold-out set and exposes predict() with explanations.
 */
// ML_START
const FS = (function () {
  function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
  const TYPES=['PAYMENT','TRANSFER','CASH_OUT','CASH_IN','DEBIT'];
  const gauss=r=>{let u=0;while(!u)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r())};
  const pick=(r,w)=>{let s=r(),c=0;for(let i=0;i<w.length;i++){c+=w[i];if(s<c)return i}return w.length-1};
  const ln=(m,s,r)=>Math.round(Math.exp(Math.log(m)+s*gauss(r)));
  const tracked=t=>t==='TRANSFER'||t==='CASH_OUT';
  // Synthetic transactions following the PaySim schema (type, amount, old/new balance of sender and receiver).
  function gen(r){
    let type=TYPES[pick(r,[.34,.12,.30,.20,.04])],fraud=false;
    if(tracked(type)&&r()<0.14){fraud=true}
    const t={type,hour:0,oldOrg:0,newOrg:0,oldDest:0,newDest:0,amount:0,fraud};
    if(fraud){
      t.oldOrg=Math.max(2000,ln(120000,1.3,r));
      if(r()<0.85){t.amount=t.oldOrg;t.newOrg=0}else{t.amount=Math.round(t.oldOrg*(0.5+0.45*r()));t.newOrg=t.oldOrg-t.amount}
      if(r()<0.6){t.oldDest=0;t.newDest=0}else{t.oldDest=ln(40000,1.5,r);t.newDest=t.oldDest+t.amount}
      t.hour=r()<0.35?Math.floor(r()*6):6+Math.floor(r()*18);
    }else{
      t.oldOrg=Math.max(1000,ln(15000,1.5,r));
      if(type==='CASH_IN'){t.amount=Math.max(10,ln(60000,1.1,r));t.newOrg=t.oldOrg+t.amount}
      else{const f=r()<0.04?1:Math.min(0.98,-Math.log(1-r())*0.18);t.amount=Math.max(10,Math.round(t.oldOrg*f));t.newOrg=t.oldOrg-t.amount}
      if(tracked(type)){t.oldDest=r()<0.25?0:ln(40000,1.6,r);t.newDest=r()<0.08?t.oldDest:t.oldDest+t.amount}
      t.hour=r()<0.07?Math.floor(r()*6):6+Math.floor(r()*18);
    }
    if(r()<0.005)t.fraud=!t.fraud;
    return t;
  }
  const risky=t=>+tracked(t.type),inr=n=>'₹'+Math.round(n).toLocaleString('en-IN');
  const errO=t=>Math.min(1,Math.abs(t.newOrg-(t.type==='CASH_IN'?t.oldOrg+t.amount:t.oldOrg-t.amount))/(t.amount+1));
  const errD=t=>risky(t)?Math.min(1,Math.abs(t.newDest-(t.oldDest+t.amount))/(t.amount+1)):0;
  const drain=t=>+(t.oldOrg>0&&t.newOrg===0&&t.type!=='CASH_IN');
  const FEATS=[
    ['amt',t=>Math.log1p(t.amount),t=>`Large transaction value (${inr(t.amount)})`,t=>`Modest transaction value (${inr(t.amount)})`],
    ['frac',t=>Math.min(1.5,t.amount/(t.oldOrg+1)),t=>`Moves ${Math.round(100*t.amount/(t.oldOrg+1))}% of the sender's balance`,t=>`Uses only ${Math.round(100*t.amount/(t.oldOrg+1))}% of the sender's balance`],
    ['drain',drain,()=>'Sender account is left with ₹0',()=>'Sender keeps a balance afterwards'],
    ['drainRisky',t=>drain(t)*risky(t),()=>'Whole balance emptied via transfer / cash-out — classic account-takeover pattern',()=>'No account-emptying pattern'],
    ['errOrg',errO,()=>"Sender balances don't add up (before vs after)",()=>'Sender balances are consistent'],
    ['errDest',errD,()=>"Receiver balances don't add up (before vs after)",()=>'Receiver balances are consistent'],
    ['destEmpty',t=>risky(t)*+(t.oldDest===0),()=>'Receiver account was empty before — typical of mule accounts',()=>'Receiver account already held funds'],
    ['destFlat',t=>risky(t)*+(t.newDest===t.oldDest),()=>'Receiver balance did not increase after the transfer',()=>'Receiver balance increased as expected'],
    ['oldOrg',t=>Math.log1p(t.oldOrg),t=>`High sender balance (${inr(t.oldOrg)}) — a valuable target`,t=>`Low sender balance (${inr(t.oldOrg)})`],
    ['night',t=>+(t.hour<=5),t=>`Made at ${String(t.hour).padStart(2,'0')}:00 — unusual night-time hour`,()=>'Made at a normal daytime hour']
  ].concat(TYPES.map(k=>['t_'+k,t=>+(t.type===k),t=>`${k.replace('_',' ')} is a higher-risk transaction type`,t=>`${t.type.replace('_',' ')} is a lower-risk transaction type`]));
  const vec=t=>FEATS.map(f=>f[1](t)),sig=z=>1/(1+Math.exp(-z));
  function auc(ps,ys){const idx=ps.map((p,i)=>i).sort((a,b)=>ps[a]-ps[b]);let rs=0,np=0;idx.forEach((i,k)=>{if(ys[i]){rs+=k+1;np++}});return(rs-np*(np+1)/2)/(np*(ys.length-np))}
  const r=rng(20260611),data=[];for(let i=0;i<12000;i++)data.push(gen(r));
  const split=9600,train=data.slice(0,split),test=data.slice(split);
  const X=train.map(vec),d=X[0].length,mu=Array(d).fill(0),sd=Array(d).fill(0);
  X.forEach(x=>x.forEach((v,j)=>mu[j]+=v/X.length));
  X.forEach(x=>x.forEach((v,j)=>sd[j]+=(v-mu[j])**2/X.length));sd.forEach((v,j)=>sd[j]=Math.sqrt(v)||1);
  const Z=X.map(x=>x.map((v,j)=>(v-mu[j])/sd[j])),Y=train.map(t=>+t.fraud);
  const w=Array(d).fill(0);let b=0;const PW=4,L2=1e-3,LR=0.3;
  for(let ep=0;ep<400;ep++){const gw=Array(d).fill(0);let gb=0;
    for(let i=0;i<Z.length;i++){const e=(sig(Z[i].reduce((s,v,j)=>s+v*w[j],b))-Y[i])*(Y[i]?PW:1);gb+=e;for(let j=0;j<d;j++)gw[j]+=e*Z[i][j]}
    const n=Z.length;b-=LR*gb/n;for(let j=0;j<d;j++)w[j]-=LR*(gw[j]/n+L2*w[j])}
  function predictWith(P,t){
    const z=vec(t).map((v,j)=>(v-P.mu[j])/P.sd[j]),p=sig(z.reduce((s,v,j)=>s+v*P.w[j],P.b));
    const contrib=FEATS.map((f,j)=>({k:f[0],c:z[j]*P.w[j],text:z[j]*P.w[j]>=0?f[2](t):f[3](t)}));
    const score=Math.round(p*1000)/10;
    return{p,score,fraud:p>=0.5,level:p>=.75?'critical':p>=.5?'high':p>=.25?'medium':'low',contrib};
  }
  const predict=t=>predictWith({mu,sd,w,b},t);
  const ps=test.map(t=>predict(t).p),ys=test.map(t=>+t.fraud);
  let tp=0,fp=0,fn=0,tn=0;ps.forEach((p,i)=>{const pr=p>=.5;if(pr&&ys[i])tp++;else if(pr)fp++;else if(ys[i])fn++;else tn++});
  const M={accuracy:(tp+tn)/ps.length,precision:tp/Math.max(1,tp+fp),recall:tp/Math.max(1,tp+fn),auc:auc(ps,ys),n:ps.length,trainN:train.length,tp,fp,fn,tn,features:d};
  M.f1=2*M.precision*M.recall/Math.max(1e-9,M.precision+M.recall);
  return{predict,predictWith,metrics:M,test,train,data,TYPES,gen,rng,scores:ps,labels:ys,
    featureNames:FEATS.map(f=>f[0]),params:{mu:mu.slice(),sd:sd.slice(),w:w.slice(),b},
    config:{seed:20260611,records:12000,trainRecords:split,testRecords:12000-split,epochs:400,learningRate:LR,l2:L2,fraudClassWeight:PW,threshold:0.5}};
})();
// ML_END

// Node.js export (outside the markers, not part of the browser copy)
if (typeof module !== 'undefined' && module.exports) module.exports = FS;
