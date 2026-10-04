(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.Brrrr=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const DAY=86400000;
  const RULES=Object.freeze({radius:2,maxDays:730,minComps:3,maxComps:5,maxWeight:.4});
  const norm=x=>String(x??'').trim().toLowerCase().replace(/\s+/g,' ');
  function num(x){if(!['number','string'].includes(typeof x)||(typeof x==='string'&&!x.trim()))return null;const n=Number(x);return Number.isFinite(n)?n:null;}
  const positive=x=>{const n=num(x);return n>0?n:null;};
  const nonnegative=x=>{const n=num(x);return n!=null&&n>=0?n:null;};
  const feature=(r,k)=>r[k]??r.features?.[k];
  const same=(a,b)=>!!norm(a)&&norm(a)===norm(b);
  const addressKey=r=>norm(r.formattedAddress||[r.addressLine1,r.addressLine2,r.city,r.state,r.zipCode].filter(Boolean).join(' ')).replace(/[.,]/g,'');
  const propertyKey=r=>addressKey(r)||norm(r.id);
  function dateTime(x){
    if(typeof x!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(x))return null;
    const t=Date.parse(x),day=x.slice(0,10);
    return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===day?t:null;
  }
  function haversine(a,b){
    const vals=[a.latitude,a.longitude,b.latitude,b.longitude].map(num);
    if(vals.some(x=>x==null)||Math.abs(vals[0])>90||Math.abs(vals[2])>90||Math.abs(vals[1])>180||Math.abs(vals[3])>180)return null;
    const [la,lo,lb,lp]=vals,rad=Math.PI/180;
    const q=Math.sin((lb-la)*rad/2)**2+Math.cos(la*rad)*Math.cos(lb*rad)*Math.sin((lp-lo)*rad/2)**2;
    return 7917.6*Math.asin(Math.sqrt(Math.min(1,Math.max(0,q))));
  }
  function normalizeRecord(r={}){
    if(!r||typeof r!=='object'||Array.isArray(r))r={};
    const out={...r};
    for(const k of ['garageSpaces','floorCount','roomCount'])out[k]=nonnegative(feature(r,k));
    for(const k of ['foundationType','architectureType','garageType','exteriorType'])out[k]=feature(r,k)||'';
    out.garage=typeof feature(r,'garage')==='boolean'?feature(r,'garage'):null;
    return out;
  }
  function profile(d){
    const r=normalizeRecord(d.subject||{}),e=d.editedSubject||{};
    const edited=(k,convert)=>Object.hasOwn(e,k)?convert(e[k]):convert(r[k]);
    return {id:r.id,address:addressKey(r),type:norm(r.propertyType),beds:nonnegative(r.bedrooms),baths:positive(r.bathrooms),
      total:positive(r.squareFootage),lot:edited('lotSize',positive),year:edited('yearBuilt',positive),garage:edited('garageSpaces',nonnegative),
      floorCount:positive(r.floorCount),foundationType:r.foundationType,architectureType:r.architectureType,subdivision:r.subdivision||'',
      aboveGrade:edited('aboveGrade',positive),basementSqft:edited('basementSqft',nonnegative)};
  }
  function areaProfile(s){
    if(s.aboveGrade)return {primary:s.aboveGrade,alternative:null,kind:'known-above-grade'};
    if(s.basementSqft!=null&&s.total>s.basementSqft)return {primary:s.total-s.basementSqft,alternative:null,kind:'derived-above-grade'};
    const lowRise=s.floorCount==null||s.floorCount===1;
    const contrary=/slab|raft|mat|crawl|pier|pile/i.test(s.foundationType)||/colonial|victorian|multi.?story/i.test(s.architectureType);
    // A half-area possibility is a screening hypothesis, never a recovered fact.
    const legacy=s.type==='single family'&&s.year<1985&&s.year>=1800&&lowRise&&!contrary;
    return {primary:s.total,alternative:legacy?s.total*.5:null,kind:legacy?'ambiguous-total':'reported-total'};
  }
  function candidateArea(c,subjectArea){
    const ag=positive(c.aboveGrade),bs=nonnegative(c.basementSqft),sf=positive(c.totalFinishedSqft)||positive(c.squareFootage);
    if(ag)return {area:ag,kind:'known-above-grade',uncertain:false};
    if(bs!=null&&sf>bs)return {area:sf-bs,kind:'derived-above-grade',uncertain:false};
    // Unknown candidate splits are not inferred from its selling price.
    return {area:sf,kind:'reported-total',uncertain:subjectArea.kind.includes('above-grade')};
  }
  function scoreRow(s,raw,asOf){
    const c=normalizeRecord(raw),sf=positive(c.squareFootage),lot=positive(c.lotSize),year=positive(c.yearBuilt),distance=nonnegative(c.distance);
    const beds=nonnegative(c.bedrooms),baths=positive(c.bathrooms),stories=positive(c.floorCount);
    const price=positive(c.price??c.lastSalePrice),saleDate=c.saleDate??c.lastSaleDate,t=dateTime(saleDate);
    const days=t==null?null:(asOf-t)/DAY,reasons=[],warnings=[],parts={};
    const reject=(condition,reason)=>{if(condition)reasons.push(reason);};
    reject(!propertyKey(c),'missing property identity');
    reject(!price,'missing or invalid recorded sale price');
    reject(['asking','estimate','avm','auction-bid'].includes(norm(c.priceSource)),'price is not a closed-sale amount');
    reject(c.saleVerified===false,'sale evidence explicitly unverified');
    reject(['foreclosure','auction','non-arm-length'].includes(norm(c.transactionType)),'transaction requires separate market review');
    reject(['poor','unrenovated'].includes(norm(c.condition)),'condition does not support after-repair comparison');
    reject(t==null,'missing or invalid sale date');
    reject(days!=null&&days<0,'future sale date');
    reject(days>RULES.maxDays,'older than 24 months');
    reject(distance==null||distance>RULES.radius,'missing distance or outside search area');
    reject(!norm(c.propertyType)||s.type!==norm(c.propertyType),'property type mismatch or missing');
    reject(!sf,'missing living area');reject(!year||year<1800||year>new Date(asOf).getUTCFullYear(),'missing or invalid year built');
    reject(beds!=null&&s.beds!=null&&Math.abs(beds-s.beds)>1,'bedroom mismatch');
    reject(baths!=null&&s.baths!=null&&Math.abs(baths-s.baths)>1,'bath mismatch');
    reject(year&&s.year&&Math.abs(year-s.year)>30,'age mismatch');
    reject(stories&&s.floorCount&&stories!==s.floorCount,'story mismatch');
    reject(lot&&s.lot&&(lot/s.lot<.33||lot/s.lot>3),'site mismatch');
    const cag=positive(c.aboveGrade),cbs=nonnegative(c.basementSqft),finished=positive(c.totalFinishedSqft),areaTotal=finished||sf;
    reject(Object.hasOwn(c,'totalFinishedSqft')&&!finished,'invalid verified total finished area');
    reject(cag&&areaTotal&&cag>areaTotal,'comp above-grade area exceeds total');
    reject(cbs!=null&&areaTotal&&cbs>=areaTotal,'comp basement area conflicts with total');
    reject(cag&&cbs!=null&&areaTotal&&Math.abs(cag+cbs-areaTotal)>Math.max(50,areaTotal*.05),'comp area split conflicts with total');
    if(finished&&sf&&Math.abs(finished-sf)>Math.max(50,sf*.05))warnings.push('verified finished area differs from provider area');
    const a=areaProfile(s),ca=candidateArea(c,a);
    let gap=ca.area&&a.primary?Math.abs(Math.log(ca.area/a.primary)):Infinity,areaMatch=a.kind;
    if(a.alternative&&ca.kind==='reported-total'&&(!stories||stories===1)){
      const altGap=Math.abs(Math.log(ca.area/a.alternative));
      if(altGap<gap){gap=altGap;areaMatch='possible-ranch-footprint';}
      warnings.push('subject above-grade/basement split unknown');
    }
    if(ca.uncertain)warnings.push('comp above-grade/basement split unknown');
    // When candidate GLA is known but subject is not, compare both subject hypotheses.
    if(a.alternative&&ca.kind!=='reported-total'&&(!stories||stories===1)){
      const altGap=Math.abs(Math.log(ca.area/a.alternative));
      if(altGap<gap){gap=altGap;areaMatch='possible-ranch-footprint';}
      warnings.push('subject above-grade/basement split unknown');
    }
    const limit=a.alternative?Math.log(1.45):Math.log(1.35);
    const ratio=ca.area/a.primary;
    reject(a.alternative?gap>limit:(!Number.isFinite(ratio)||ratio<.70||ratio>1.35),'living area mismatch');
    if(beds==null)warnings.push('missing bedrooms');if(baths==null)warnings.push('missing bathrooms');
    if(!lot)warnings.push('missing lot size');if(!stories)warnings.push('missing story count');
    if(reasons.length)return {c:{...c,price,saleDate,distance},key:propertyKey(c),eligible:false,reasons,warnings,parts,score:Infinity,weight:0,tier:'Reject',areaMatch};
    parts.location=distance/.5;
    parts.age=Math.abs(year-s.year)/10;
    parts.rooms=(beds==null?1.25:Math.abs(beds-s.beds)*1.25)+(baths==null?1.5:Math.abs(baths-s.baths)*1.5);
    parts.site=lot&&s.lot?Math.min(Math.abs(Math.log(lot/s.lot))/.35,3):1;
    parts.area=gap*(a.alternative?1.1:1.5)+(ca.uncertain?.6:0)+(a.alternative?.4:0);
    parts.stories=stories&&s.floorCount?0:.4;
    parts.style=s.architectureType&&c.architectureType?(same(s.architectureType,c.architectureType)?0:1.25):.4;
    parts.foundation=s.foundationType&&c.foundationType?(same(s.foundationType,c.foundationType)?0:.75):.25;
    parts.garage=s.garage!=null&&c.garageSpaces!=null?Math.min(Math.abs(c.garageSpaces-s.garage),2)*.75:.25;
    parts.recency=Math.min(days/365,2)*.5;
    parts.neighborhood=same(s.subdivision,c.subdivision)?-.75:0;
    const score=Math.max(0,Object.values(parts).reduce((a,b)=>a+b,0));
    const strict=distance<=1.5&&Math.abs(year-s.year)<=20&&beds!=null&&baths!=null;
    return {c:{...c,price,saleDate,distance},key:propertyKey(c),eligible:true,reasons,warnings,parts,score,
      weight:1/(1+score)**2,tier:strict?'Strict':'Acceptable',areaMatch};
  }
  function median(values){const a=values.filter(Number.isFinite).sort((a,b)=>a-b),n=a.length;return n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):0;}
  function cappedWeights(rows){
    if(!rows.length)return [];
    const cap=Math.max(RULES.maxWeight,1/rows.length);
    const result=Array(rows.length).fill(0);let remaining=rows.map((r,i)=>i),budget=1;
    while(remaining.length){
      const total=remaining.reduce((sum,i)=>sum+rows[i].weight,0);
      const over=remaining.filter(i=>budget*(total?rows[i].weight/total:1/remaining.length)>cap);
      if(!over.length){for(const i of remaining)result[i]=budget*(total?rows[i].weight/total:1/remaining.length);break;}
      for(const i of over){result[i]=cap;budget-=cap;}
      remaining=remaining.filter(i=>!over.includes(i));
    }
    return result;
  }
  function weightedMedian(rows){
    const a=rows.slice().sort((a,b)=>a.c.price-b.c.price);let run=0;
    for(let i=0;i<a.length;i++){run+=a[i].normalizedWeight;if(Math.abs(run-.5)<1e-12&&i+1<a.length)return (a[i].c.price+a[i+1].c.price)/2;if(run>.5)return a[i].c.price;}
    return a.at(-1)?.c.price||0;
  }
  function appraisalModel(d,now=Date.now()){
    const asOf=typeof now==='string'?Date.parse(now):now;
    if(!Number.isFinite(asOf))throw Error('Invalid analysis date');
    const s=profile(d),subjectIssues=[];
    for(const [k,label] of [['type','property type'],['total','living area'],['year','year built'],['baths','bathrooms']])if(!s[k])subjectIssues.push('subject missing '+label);
    if(s.beds==null)subjectIssues.push('subject missing bedrooms');
    if(s.year<1800||s.year>new Date(asOf).getUTCFullYear())subjectIssues.push('subject invalid year built');
    if(s.aboveGrade&&s.total&&s.aboveGrade>s.total)subjectIssues.push('above-grade area exceeds total living area');
    if(s.basementSqft!=null&&s.total&&s.basementSqft>=s.total)subjectIssues.push('basement area must be less than total living area');
    if(s.aboveGrade&&s.basementSqft!=null&&s.total&&Math.abs(s.aboveGrade+s.basementSqft-s.total)>Math.max(50,s.total*.05))subjectIssues.push('above-grade and basement areas conflict with total living area');
    const rows=(Array.isArray(d.comps)?d.comps:[]).map(c=>scoreRow(s,c,asOf));
    const conflicts=new Set(),signatures=new Map();
    for(const row of rows){
      const signature=JSON.stringify([row.c.price,row.c.saleDate]);
      for(const identity of [row.key,norm(row.c.id)].filter(Boolean)){
        if(signatures.has(identity)&&signatures.get(identity)!==signature)conflicts.add(identity);
        else signatures.set(identity,signature);
      }
    }
    const seen=new Map(),seenIds=new Set();
    rows.sort((a,b)=>a.score-b.score||String(a.key).localeCompare(String(b.key)));
    for(const row of rows){
      const id=norm(row.c.id),self=(id&&id===norm(s.id))||(s.address&&addressKey(row.c)===s.address);
      if(conflicts.has(row.key)||(id&&conflicts.has(id))){row.eligible=false;row.reasons.push('conflicting duplicate sale records');}
      if(self){row.eligible=false;row.reasons.push('subject property');}
      if(seen.has(row.key)||(id&&seenIds.has(id))){row.eligible=false;row.reasons.push('duplicate property');}
      else {seen.set(row.key,row);if(id)seenIds.add(id);}
      row.manual=d.manualComps?.[row.key]??(id?d.manualComps?.[row.c.id]:undefined);
    }
    const eligible=rows.filter(r=>r.eligible&&r.manual!=='exclude'),strict=eligible.filter(r=>r.tier==='Strict');
    let selectionMode=strict.length>=RULES.minComps?'Strict':'Expanded';
    let auto=(selectionMode==='Strict'?strict:eligible).slice(0,RULES.maxComps);
    if(auto.length<RULES.minComps||subjectIssues.length)auto=[];
    const automatic=new Set(auto.map(r=>r.key));
    for(const r of rows)r.used=!subjectIssues.length&&r.eligible&&r.manual!=='exclude'&&(r.manual==='include'||automatic.has(r.key));
    const used=rows.filter(r=>r.used),weights=used.length>=RULES.minComps?cappedWeights(used):used.map(()=>0);
    used.forEach((r,i)=>r.normalizedWeight=weights[i]);
    const sw2=weights.reduce((sum,w)=>sum+w*w,0),effectiveN=sw2?1/sw2:0;
    let arv=used.length>=RULES.minComps?weightedMedian(used):0;
    const prices=used.map(r=>r.c.price),med=median(prices),dispersion=med?1.4826*median(prices.map(p=>Math.abs(p-med)))/med:1;
    const warnings=[...subjectIssues];
    if(areaProfile(s).alternative)warnings.push('Basement configuration is ambiguous; the alternative footprint is a hypothesis.');
    if(used.some(r=>r.warnings.includes('comp above-grade/basement split unknown')))warnings.push('Some comp areas cannot be verified as above grade.');
    if(used.some(r=>!positive(r.c.lotSize)))warnings.push('Some comp lot sizes are missing.');
    if(used.some(r=>r.manual==='include'||r.manual==='exclude')||Object.values(d.manualComps||{}).includes('exclude'))selectionMode='Manual';
    const avgScore=used.length?used.reduce((sum,r)=>sum+r.score,0)/used.length:Infinity;
    const areaAlternatives={};
    if(areaProfile(s).alternative){
      // Diagnose competing area hypotheses using separately defensible cohorts.
      // Prices do not change eligibility or similarity weights in either cohort.
      for(const [name,match] of [['reported','ambiguous-total'],['footprint','possible-ranch-footprint']]){
        const cohort=eligible.filter(r=>r.areaMatch===match),tight=cohort.filter(r=>r.tier==='Strict');
        const best=(tight.length>=RULES.minComps?tight:cohort).slice(0,RULES.maxComps);
        if(best.length>=RULES.minComps){const weights=cappedWeights(best);areaAlternatives[name]=weightedMedian(best.map((r,i)=>({...r,normalizedWeight:weights[i]})));}
      }
      if(areaAlternatives.reported&&areaAlternatives.footprint){
        warnings.push('Both reported-area and ranch-footprint cohorts have at least three sales.');
        if(Math.max(...Object.values(areaAlternatives))/Math.min(...Object.values(areaAlternatives))>1.2){
          arv=0;warnings.push('The area interpretations change the indication by more than 20%; verify above-grade and basement areas before using an ARV.');
        }
      }
    }
    // MAD alone misses a split market or a single extreme price; inspect the entire selected range.
    const spread=prices.length?Math.max(...prices)/Math.min(...prices)-1:0;
    if(spread>.6){arv=0;warnings.push('Selected sales span conflicting price levels; review the evidence before using an ARV.');}
    let confidence='Very Low';
    if(arv&&effectiveN>=2.5&&dispersion<=.18&&spread<=.4)confidence='Low';
    if(arv&&selectionMode==='Strict'&&used.length>=4&&effectiveN>=3.3&&avgScore<=4&&dispersion<=.12&&spread<=.25&&!areaProfile(s).alternative&&used.every(r=>!r.warnings.length))confidence='Moderate';
    if(d.searchTruncated){confidence='Very Low';warnings.push('The provider search reached its record limit; omitted sales may change the strongest available comparisons.');}
    warnings.push('Renovation condition and sale concessions are not verified by these public records.');
    warnings.push('Provider sale amounts have not been independently corroborated; asking prices and value estimates are not closing prices.');
    return {s,rows,used,arv,low:prices.length?Math.min(...prices):0,high:prices.length?Math.max(...prices):0,
      confidence,effectiveN,dispersion,avgScore,selectionMode,warnings,subjectIssues,asOf:new Date(asOf).toISOString(),area:areaProfile(s),areaAlternatives};
  }
  function assumptions(input,subject){
    const purchase=positive(input.purchasePrice);if(!purchase||purchase>1e9)throw Error('Enter a positive purchase price below $1 billion.');
    const read=(value,fallback,label,min,max)=>{const n=value==null||value===''?fallback:num(value);if(n==null||n<min||n>max)throw Error('Invalid '+label+'.');return n;};
    const rate=read(input.rehabRate,25,'rehab rate',0,200),ltv=read(input.ltv,.75,'LTV',.01,1);
    const rehabIsManual=input.rehab!=null&&input.rehab!=='',otherIsManual=input.otherCosts!=null&&input.otherCosts!=='';
    const sf=positive(subject.squareFootage);
    const rehab=rehabIsManual?read(input.rehab,0,'rehab',0,1e9):Math.round(sf?sf*rate:purchase*.35);
    const otherCosts=otherIsManual?read(input.otherCosts,0,'other costs',0,1e9):Math.round((purchase+rehab)*.07);
    if(!Number.isFinite(rehab)||!Number.isFinite(otherCosts)||!Number.isFinite(purchase+rehab+otherCosts))throw Error('Property area produces an invalid rehab estimate.');
    return {purchasePrice:purchase,rehab,rehabRate:rate,rehabIsManual,otherCosts,otherIsManual,totalBasis:purchase+rehab+otherCosts,ltv};
  }
  function financials(deal,arv){
    if(!(arv>0))return {arv:null,refi:null,cashResult:null,equity:null,maxPurchase:null};
    const refi=arv*deal.ltv;
    return {arv,refi,cashResult:refi-deal.totalBasis,equity:arv-refi,
      maxPurchase:Math.max(0,deal.otherIsManual?refi-deal.rehab-deal.otherCosts:refi/1.07-deal.rehab)};
  }
  return {RULES,num,positive,nonnegative,norm,propertyKey,dateTime,haversine,normalizeRecord,profile,areaProfile,scoreRow,appraisalModel,assumptions,financials,median};
});
