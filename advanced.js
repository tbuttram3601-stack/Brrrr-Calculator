(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core'):root.Brrrr);if(typeof module==='object'&&module.exports)module.exports=api;else root.BrrrrAdvanced=api;})(typeof globalThis==='object'?globalThis:this,function(E){
 'use strict';
 const projects={
  bathroom:{label:'Add one bathroom in existing space',field:'bathrooms',delta:1,cost:[10000,35000],source:'https://www.fixr.com/costs/bathroom-addition'},
  bedroom:{label:'Create one bedroom in existing space',field:'bedrooms',delta:1,cost:null,source:null},
  garage:{label:'Build a one-car garage',field:'garageSpaces',delta:1,cost:[15000,35000],source:'https://homeguide.com/costs/cost-to-build-a-garage'},
  addition:{label:'Add above-grade living space',field:'aboveGrade',cost:[125,250],source:'https://homeguide.com/costs/home-addition-cost'},
  basement:{label:'Finish existing basement space',field:'basementSqft',cost:[30,50],source:'https://homeguide.com/costs/basement-remodel-cost/'}
 };
 const n=E.num,positive=E.positive,nonnegative=E.nonnegative;
 const validDate=(c,now)=>{const t=E.dateTime(c.saleDate??c.lastSaleDate);return t!=null&&now>=t&&(now-t)<=730*86400000;};
 const close=(a,b,fraction=.1)=>a>0&&b>0&&Math.abs(Math.log(a/b))<=Math.log(1+fraction);
function measurement(r,k){const c=E.normalizeRecord(r);return ['basementSqft','garageSpaces','bedrooms'].includes(k)?nonnegative(c[k]):positive(c[k]);}
 function neighborhood(s,c){return s.subdivision?E.norm(c.subdivision)===E.norm(s.subdivision):nonnegative(c.distance)!=null&&c.distance<=.5;}
 function analyze(d,input,now=Date.now()){
  const p=projects[input.type];if(!p)throw Error('Choose an improvement.');
  const s=E.profile(d),raw=E.normalizeRecord(d.subject),before={...raw,yearBuilt:s.year,lotSize:s.lot,aboveGrade:s.aboveGrade,basementSqft:s.basementSqft,garageSpaces:s.garage};
  const amount=p.delta||positive(input.amount);if(!amount||amount>5000)throw Error('Enter added square feet between 1 and 5,000.');
  const contingency=input.contingency==null||input.contingency===''?.15:n(input.contingency);
  if(contingency==null||contingency<0||contingency>1)throw Error('Contingency must be between 0% and 100%.');
  const manual=input.cost!=null&&input.cost!=='';
  const quote=manual?nonnegative(input.cost):null;if(manual&&(quote==null||quote>1e9))throw Error('Enter a valid project cost.');
  let costLow=manual?quote:p.cost?p.cost[0]*(p.delta?1:amount):null,costHigh=manual?quote:p.cost?p.cost[1]*(p.delta?1:amount):null;
  if(costLow!=null){costLow*=1+contingency;costHigh*=1+contingency;}
  const cost=costLow==null?null:(costLow+costHigh)/2;
  const original=measurement(before,p.field),target=original==null?null:original+amount;
  const reasons=[],warnings=['Sale differences are observational; condition, concessions and unrecorded features can explain part of the difference.'];
  if(original==null)reasons.push('The current '+p.field+' measurement is unknown.');
  if(['aboveGrade','basementSqft'].includes(p.field)&&!positive(s.aboveGrade))reasons.push('A verified subject above-grade measurement is needed for a space comparison.');
  if(!positive(s.aboveGrade))warnings.push('Reported living areas are compared on the same field; above-grade versus basement coverage remains unverified.');
  if(!s.lot||!s.year||!s.type)reasons.push('Subject type, year and lot are required for a local comparison.');
  if(!positive(d.ltv)||d.ltv>1)reasons.push('A valid refinance LTV is required.');
  if(!s.subdivision)warnings.push('Neighborhood proxy: within 0.5 mile. A matching subdivision is not available.');
  if(d.searchTruncated)reasons.push('The provider sample is incomplete; improvement value is withheld.');
  const keys=new Set(),ids=new Set(),conflicts=new Set(),signatures=new Map();
  for(const rawComp of d.comps||[]){const c=E.normalizeRecord(rawComp);for(const key of [E.propertyKey(c),E.norm(c.id)].filter(Boolean)){const sig=JSON.stringify([c.price??c.lastSalePrice,c.saleDate??c.lastSaleDate,c.bedrooms,c.bathrooms,c.squareFootage,c.aboveGrade,c.basementSqft,c.yearBuilt,c.lotSize,c.garageSpaces]);if(signatures.has(key)&&signatures.get(key)!==sig)conflicts.add(key);signatures.set(key,sig);}}
  const candidates=(d.comps||[]).map(E.normalizeRecord).sort((a,b)=>E.propertyKey(a).localeCompare(E.propertyKey(b))).filter(c=>{
   const key=E.propertyKey(c),id=E.norm(c.id);if(!key||keys.has(key)||(id&&ids.has(id))||conflicts.has(key)||(id&&conflicts.has(id)))return false;keys.add(key);if(id)ids.add(id);
   if(key===s.address||(id&&id===E.norm(s.id))||d.manualComps?.[key]==='exclude'||d.manualComps?.[c.id]==='exclude')return false;
   if(!positive(c.price??c.lastSalePrice)||positive(c.price??c.lastSalePrice)>1e9||!validDate(c,now)||E.norm(c.propertyType)!==s.type||!positive(c.yearBuilt)||Math.abs(c.yearBuilt-s.year)>20||!positive(c.lotSize)||!close(c.lotSize,s.lot,.35)||!neighborhood(s,c))return false;
   if(nonnegative(c.distance)==null||c.distance>.75)return false;
   if(s.floorCount&&positive(c.floorCount)&&s.floorCount!==positive(c.floorCount))return false;
   for(const f of ['foundationType','architectureType'])if(s[f]&&c[f]&&E.norm(s[f])!==E.norm(c[f]))return false;
   if(c.saleVerified===false||['asking','estimate','avm','auction-bid'].includes(E.norm(c.priceSource))||['foreclosure','auction','non-arm-length'].includes(E.norm(c.transactionType))||['poor','unrenovated'].includes(E.norm(c.condition)))return false;
   // Room/garage changes use like-for-like area bases. Space changes require explicit GLA and basement data.
   const area=positive(before.aboveGrade)?positive(c.aboveGrade):positive(c.squareFootage);
   const baseArea=positive(before.aboveGrade)||positive(before.squareFootage);
   if(p.field!=='aboveGrade'&&!close(area,baseArea,.15))return false;
   if(p.field==='aboveGrade'&&(!positive(c.aboveGrade)||!close(c.aboveGrade,s.aboveGrade,.15+amount/s.aboveGrade)))return false;
   if(['aboveGrade','basementSqft'].includes(p.field)&&nonnegative(c.basementSqft)==null)return false;
   for(const f of ['bedrooms','bathrooms'])if(f!==p.field&&(measurement(c,f)==null||measurement(c,f)!==measurement(before,f)))return false;
   if(p.field!=='garageSpaces'&&s.garage!=null&&measurement(c,'garageSpaces')!==s.garage)return false;
   if(p.field!=='basementSqft'&&s.basementSqft!=null&&(nonnegative(c.basementSqft)==null||!close(c.basementSqft+1,s.basementSqft+1,.2)))return false;
   return true;
  });
  const nearFeature=(v,t)=>v!=null&&t!=null&&(p.delta?v===t:Math.abs(v-t)<=Math.max(30,amount*.15));
  const lower=candidates.filter(c=>nearFeature(measurement(c,p.field),original)),upper=candidates.filter(c=>nearFeature(measurement(c,p.field),target));
  const matches=[];
  for(const a of lower)for(const b of upper){
   if(E.propertyKey(a)===E.propertyKey(b))continue;
   if(s.subdivision&&E.norm(a.subdivision)!==E.norm(b.subdivision))continue;
   if(!s.subdivision&&a.subdivision&&b.subdivision&&E.norm(a.subdivision)!==E.norm(b.subdivision))continue;
   const days=Math.abs(E.dateTime(a.saleDate??a.lastSaleDate)-E.dateTime(b.saleDate??b.lastSaleDate))/86400000;
   if(days>180||Math.abs(a.yearBuilt-b.yearBuilt)>10||!close(a.lotSize,b.lotSize,.2))continue;
   let compatible=true;
   for(const f of ['floorCount','architectureType','foundationType','garageType'])if(a[f]!=null&&b[f]!=null&&a[f]!==''&&b[f]!==''&&E.norm(a[f])!==E.norm(b[f]))compatible=false;
   const areaKey=s.aboveGrade?'aboveGrade':'squareFootage';
   if(p.field!=='aboveGrade'&&!close(positive(a[areaKey]),positive(b[areaKey]),.1))compatible=false;
   if(p.field!=='basementSqft'&&a.basementSqft!=null&&b.basementSqft!=null&&!close(a.basementSqft+1,b.basementSqft+1,.15))compatible=false;
   if(!compatible)continue;
   const score=Math.abs(a.yearBuilt-b.yearBuilt)/10+days/180+Math.abs(a.distance-b.distance)/.5+Math.abs(Math.log(a.lotSize/b.lotSize));
   matches.push({before:a,after:b,score,key:E.propertyKey(a)+'|'+E.propertyKey(b),difference:positive(b.price??b.lastSalePrice)-positive(a.price??a.lastSalePrice)});
  }
  matches.sort((a,b)=>a.score-b.score||a.key.localeCompare(b.key));const used=new Set(),pairs=[];
  for(const pair of matches){const a=E.propertyKey(pair.before),b=E.propertyKey(pair.after);if(used.has(a)||used.has(b))continue;pairs.push(pair);used.add(a);used.add(b);if(pairs.length===8)break;}
  if(pairs.length<3)reasons.push('Need at least 3 independent matched comparisons; found '+pairs.length+'.');
  const differences=pairs.map(x=>x.difference),mid=E.median(differences),mad=E.median(differences.map(x=>Math.abs(x-mid)));
  if(pairs.some(x=>Math.abs(x.difference)>positive(x.before.price??x.before.lastSalePrice)*.5))reasons.push('A feature-only price difference exceeds 50% of its before-sale price; other property differences need review.');
  if(pairs.length>=3&&(mid===0&&differences.some(x=>x!==0)||mad>Math.max(5000,Math.abs(mid)*.5)||(differences.some(x=>x<0)&&differences.some(x=>x>0))))reasons.push('The matched sale differences conflict; no defensible value increment.');
  const supported=!reasons.length,value=supported?mid:null,range=supported?[Math.min(...differences),Math.max(...differences)]:null;
  // Simple can contain mixed feature counts. Use only the current-feature cohort
  // as Advanced's starting indication, so the estimated feature gain is not counted twice.
  const baseline=E.appraisalModel({...d,comps:lower,manualComps:{}},now),scenarioArv=value!=null&&baseline.arv>0&&baseline.arv+value>0?baseline.arv+value:null;
  const addedOther=cost!=null?(d.otherIsManual?0:Math.round((d.purchasePrice+d.rehab+cost)*.07)-d.otherCosts):null;
  const extraBasis=cost!=null?cost+addedOther:null,extraRefi=value!=null?value*d.ltv:null;
  const projected=extraBasis!=null&&scenarioArv!=null?E.financials({...d,totalBasis:d.totalBasis+extraBasis},scenarioArv):null;
  const breakEvenValue=extraBasis!=null&&positive(d.ltv)?extraBasis/d.ltv:null;
  return {type:input.type,label:p.label,amount,original,target,costLow,costHigh,cost,costSource:manual?'Your project cost':p.source,costManual:manual,contingency,
   value,range,pairs,beforeCount:lower.length,afterCount:upper.length,reasons,warnings,supported,baselineArv:baseline.arv||null,scenarioArv,
   extraBasis,addedOther,extraRefi,netValue:value!=null&&extraBasis!=null?value-extraBasis:null,cashChange:extraRefi!=null&&extraBasis!=null?extraRefi-extraBasis:null,breakEvenValue,projected,
   evidence:supported?'Limited local evidence':'Insufficient local evidence'};
 }
 return {projects,analyze};
});
