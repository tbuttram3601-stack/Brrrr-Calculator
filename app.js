'use strict';
const USAGE_KEY='brrrrRentcastUsageV1',LAST_KEY='brrrrLastAnalysisV5',INPUT_KEY='brrrrLastInputsV5';
const $=id=>document.getElementById(id);
const money=n=>n==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let lastDeal=null,busy=false,volatileUsage={requests:0,resetDate:''};
function read(key,storage=localStorage){try{return JSON.parse(storage.getItem(key));}catch{return null;}}
function write(key,value,storage=localStorage){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function loadUsage(){const u=read(USAGE_KEY)||volatileUsage;return {requests:Number.isInteger(u.requests)&&u.requests>=0?u.requests:0,resetDate:String(u.resetDate||''),analyses:Number.isInteger(u.analyses)?u.analyses:0};}
function saveUsage(u){volatileUsage=u;const saved=write(USAGE_KEY,u);renderUsage();if(!saved)$('usageNote').textContent='Browser storage is unavailable. This counter will not survive closing the page; sync with RentCast.';}
function renderUsage(){const u=loadUsage();$('uRequests').textContent=u.requests+' / 50';$('uRemaining').textContent=Math.max(0,50-u.requests);$('uReset').textContent='Reset date: '+(u.resetDate||'not set')+' · '+u.analyses+' analyses';}
function recordUsage(count,completed=false){const u=loadUsage();u.requests+=count;if(completed)u.analyses++;saveUsage(u);}
renderUsage();
$('syncUsage').addEventListener('click',()=>{const u=loadUsage(),n=prompt('Official successful request count from your RentCast dashboard:',u.requests);if(n===null)return;const v=Number(n);if(n.trim()&&Number.isInteger(v)&&v>=0){u.requests=v;saveUsage(u);}else alert('Enter a whole number of 0 or more.');});
$('setReset').addEventListener('click',()=>{const u=loadUsage(),v=prompt('RentCast billing reset date (YYYY-MM-DD). This is a reminder; use Sync when your billing period resets.',u.resetDate);if(v===null)return;if(v!==''&&Brrrr.dateTime(v)==null){alert('Use a valid YYYY-MM-DD date.');return;}u.resetDate=v;saveUsage(u);});
document.querySelectorAll('.rehab-choice').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.rehab-choice').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('rehabRate').value=b.dataset.rate;$('rehab').value='';}));
function payload(){return {address:$('address').value.trim(),purchasePrice:$('purchase').value,rehab:$('rehab').value||null,rehabRate:$('rehabRate').value,otherCosts:$('other').value||null,ltv:Number($('ltv').value)/100};}
function snapshot(d){const {model,screen,...saved}=d;return saved;}
function saveDeal(d){write(LAST_KEY,snapshot(d),sessionStorage);}
$('recalcProperty').addEventListener('click',()=>{
  if(!lastDeal)return;
  const fields={lotSize:['editLotAcres',43560],yearBuilt:['editYearBuilt',1],aboveGrade:['aboveGrade',1],basementSqft:['basementSqft',1],garageSpaces:['garageSpaces',1]};
  const edits={};
  for(const [key,[id,mult]] of Object.entries(fields)){const value=$(id).value;if(value==='')edits[key]=null;else{const n=Brrrr.nonnegative(value);if(n==null){$('error').textContent='Enter valid property details.';return;}edits[key]=n*mult;}}
  lastDeal.editedSubject=edits;renderSimple(lastDeal);
});
async function analyze(fresh=false){
  if(busy)return;
  $('error').textContent='';
  const input=payload();
  try{Brrrr.assumptions(input,{});}catch(e){$('error').textContent=e.message;return;}
  if(!fresh&&lastDeal&&Brrrr.norm(input.address)===Brrrr.norm(lastDeal.inputAddress)){
    Object.assign(lastDeal,Brrrr.assumptions(input,lastDeal.subject));lastDeal.cached=true;write(INPUT_KEY,input,sessionStorage);renderSimple(lastDeal);return;
  }
  busy=true;$('results').classList.add('hidden');$('analyzeButton').disabled=true;$('freshAnalysis').disabled=true;$('analyzeButton').textContent='Analyzing…';
  try{
    const response=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    const count=Brrrr.nonnegative(response.headers.get('X-RentCast-Request-Counted'))||0;
    if(count)recordUsage(count);
    const d=await response.json();if(!response.ok)throw Error(d.error||'Analysis failed.');
    lastDeal={...d,inputAddress:input.address};recordUsage(0,true);write(INPUT_KEY,input,sessionStorage);renderSimple(lastDeal);
  }catch(e){$('error').textContent=e.message||'Analysis failed.';}
  finally{busy=false;$('analyzeButton').disabled=false;$('freshAnalysis').disabled=false;$('analyzeButton').textContent='Analyze Deal';}
}
$('form').addEventListener('submit',e=>{e.preventDefault();analyze();});
$('freshAnalysis').addEventListener('click',()=>analyze(true));
function renderSimple(d){
  // Recheck sale age today, while keeping the original retrieval timestamp visible.
  const model=Brrrr.appraisalModel(d,Date.now());d.model=model;d.valuationDate=model.asOf;Object.assign(d,Brrrr.financials(d,model.arv));
  const s=model.s,known=model.arv>0;
  $('arv').textContent=known?money(model.arv):'Insufficient closed-sale evidence';
  $('arvRange').textContent=known?`${model.used.length} closed sales · ${model.confidence} evidence · observed ${money(model.low)}–${money(model.high)}`:`${model.used.length} selected sales · review needed`;
  $('arvMethod').textContent=known?'Screening ARV from provider sale amounts; closing prices and renovation condition need verification.':'Refinance, cash result and max purchase are unavailable until the sale evidence supports an estimate.';
  $('subject').textContent=[d.subject.formattedAddress,s.type,s.beds!=null?s.beds+' bed':'',s.baths!=null?s.baths+' bath':'',s.total?s.total.toLocaleString()+' total sq ft':'',s.aboveGrade?s.aboveGrade+' above grade':'',s.basementSqft!=null?s.basementSqft+' finished basement':'',s.lot?(s.lot/43560).toFixed(2)+' ac':'',s.year?'built '+s.year:''].filter(Boolean).join(' · ');
  $('editLotAcres').value=s.lot?(s.lot/43560).toFixed(5):'';$('editYearBuilt').value=s.year??'';$('garageSpaces').value=s.garage??'';
  $('aboveGrade').value=s.aboveGrade??'';$('basementSqft').value=s.basementSqft??'';
  const warnings=[...model.warnings];if(d.searchTruncated)warnings.push('The search returned its 500-record limit; coverage may be incomplete. No extra page was requested.');
  if(model.areaAlternatives.reported&&model.areaAlternatives.footprint)warnings.push(`Separate area indications: reported ${money(model.areaAlternatives.reported)}; possible footprint ${money(model.areaAlternatives.footprint)}.`);
  $('compAudit').innerHTML=`<strong>Why this estimate</strong><div class="muted">${esc(d.soldCandidateCount??d.comps?.length??0)} recorded-sale candidates · ${esc(model.selectionMode)} selection · effective comp count ${model.effectiveN.toFixed(1)}. Area interpretation: ${esc(model.area.kind)}. Physically different, duplicate and invalid sales cannot be included.</div><div class="muted">Selection uses physical similarity, neighborhood and recency. Prices enter only reconciliation: a weighted median, with no sale above 40% of the selected weight. No invented dollar adjustments.</div><div class="muted">${warnings.map(esc).join(' ')}</div>`;
  $('dataAge').textContent=`${d.cached?'Reusing saved data · ':''}Retrieved ${new Date(d.analysisDate||model.asOf).toLocaleString()}. Same-address recalculations use zero requests.`;
  $('mPurchase').textContent=money(d.purchasePrice);$('mRehab').textContent=money(d.rehab);$('mBasis').textContent=money(d.totalBasis);
  $('mRefi').textContent=money(d.refi);$('mCash').textContent=d.cashResult==null?'—':money(Math.abs(d.cashResult))+(d.cashResult>=0?' back at refinance':' left in');$('mEquity').textContent=money(d.equity);$('mMax').textContent=money(d.maxPurchase);
  $('comps').innerHTML=model.rows.slice().sort((a,b)=>Number(b.used)-Number(a.used)||a.score-b.score||a.key.localeCompare(b.key)).map(x=>{
    const c=x.c,parts=Object.entries(x.parts).map(([k,v])=>`${k}: ${v.toFixed(2)}`).join(' · ');
    const status=x.used?'USE':'NO',reason=x.reasons.join(', ')||(x.manual==='exclude'?'manually excluded':x.used?`${x.tier} · weight ${(x.normalizedWeight*100).toFixed(1)}%`:'not in strongest group');
    return `<tr class="${x.manual?'comp-manual':''}"><td><span class="comp-status ${x.used?'comp-used':'comp-reject'}">${status}</span><br><button class="comp-toggle" type="button" data-key="${esc(x.key)}" ${x.eligible?'':'disabled'}>${x.used?'Exclude':'Include'}</button></td><td>${esc(c.formattedAddress||c.addressLine1||c.id||'Unknown')}<div class="muted">${esc(reason)}</div><details><summary>Evidence</summary><div class="muted">Sold ${esc(c.saleDate||'unknown')} · ${esc(x.areaMatch)}<br>${esc(parts)}<br>${x.warnings.map(esc).join(' · ')}</div></details></td><td>${money(c.price)}</td><td>${esc(c.bedrooms??'—')} / ${esc(c.bathrooms??'—')}</td><td>${Brrrr.positive(c.squareFootage)?.toLocaleString()||'—'}</td><td>${Brrrr.positive(c.lotSize)?(c.lotSize/43560).toFixed(2)+' ac':'—'}</td><td>${esc(c.yearBuilt??'—')}</td><td>${c.distance!=null?c.distance.toFixed(2):'—'}</td></tr>`;
  }).join('');
  document.querySelectorAll('.comp-toggle').forEach(b=>b.addEventListener('click',()=>{const row=model.rows.find(r=>r.key===b.dataset.key&&r.eligible);if(!row)return;d.manualComps=d.manualComps||{};d.manualComps[row.key]=row.used?'exclude':'include';renderSimple(d);}));
  $('results').classList.remove('hidden');saveDeal(d);
}
$('resetReview').addEventListener('click',()=>{if(lastDeal){delete lastDeal.manualComps;delete lastDeal.editedSubject;renderSimple(lastDeal);}});
try{
  const input=read(INPUT_KEY,sessionStorage),saved=read(LAST_KEY,sessionStorage);
  if(input){$('address').value=input.address||'';$('purchase').value=input.purchasePrice||'';$('rehab').value=input.rehab??'';$('other').value=input.otherCosts??'';$('ltv').value=(input.ltv??.75)*100;$('rehabRate').value=input.rehabRate??25;document.querySelectorAll('.rehab-choice').forEach(b=>b.classList.toggle('active',Number(b.dataset.rate)===Number($('rehabRate').value)));}
  if(saved?.subject&&Array.isArray(saved.comps)){lastDeal={...saved,cached:true};renderSimple(lastDeal);}
}catch{$('error').textContent='Saved analysis could not be restored. Enter a property to analyze.';}

