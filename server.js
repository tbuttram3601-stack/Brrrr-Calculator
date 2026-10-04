const express=require('express');const path=require('path');const app=express();app.use(express.json());app.use(express.static(__dirname));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
app.post('/api/analyze',async(req,res)=>{try{const {address,purchasePrice,rehab,rehabRate=25,otherCosts,ltv=.75}=req.body;if(!address||!purchasePrice)return res.status(400).json({error:'Address and purchase price are required.'});if(!process.env.RENTCAST_API_KEY)return res.status(500).json({error:'RENTCAST_API_KEY is not configured on the server.'});const qs=new URLSearchParams({address,maxRadius:'3',daysOld:'365',compCount:'15',lookupSubjectAttributes:'true'});const r=await fetch('https://api.rentcast.io/v1/avm/value?'+qs,{headers:{Accept:'application/json','X-Api-Key':process.env.RENTCAST_API_KEY}});if(!r.ok){const t=await r.text();return res.status(r.status).json({error:'Property data request failed: '+t.slice(0,180)});}const v=await r.json();const rentcastValue=Number(v.price)||0;if(!rentcastValue)return res.status(422).json({error:'No usable valuation was returned for this address.'});const subject=v.subjectProperty||{};const sf=Number(subject.squareFootage)||0;
const comps=(v.comparables||[]).filter(c=>Number(c.price)>0&&Number(c.correlation)>=.9);
let arv=rentcastValue,arvMethod='RentCast AVM based on nearby comparable properties';
if(sf&&comps.length>=3){
  const usable=comps.filter(c=>Number(c.squareFootage)>0).slice(0,8);
  if(usable.length>=3){
    const weighted=usable.reduce((a,c)=>{const w=Math.max(.01,Number(c.correlation)||.01);return {sum:a.sum+(Number(c.price)/Number(c.squareFootage))*w,w:a.w+w}}, {sum:0,w:0});
    const compArv=(weighted.sum/weighted.w)*sf;
    // Blend our high-similarity comp $/sf estimate with RentCast AVM to avoid a single noisy method dominating.
    arv=Math.round((rentcastValue*.6)+(compArv*.4));
    arvMethod=`Blended ARV: RentCast AVM + ${usable.length} high-similarity comps`;
  }
}
const rate=clamp(Number(rehabRate)||25,0,200);const autoRehab=sf?sf*rate:purchasePrice*.35;const rehabCost=rehab==null?Math.round(autoRehab):Number(rehab);const other=otherCosts==null?Math.round((purchasePrice+rehabCost)*.07):Number(otherCosts);const L=clamp(Number(ltv)||.75,.01,1);const totalBasis=Number(purchasePrice)+rehabCost+other;const refi=arv*L;const cashResult=refi-totalBasis;const equity=arv-refi;const maxPurchase=Math.max(0,refi-rehabCost-other);res.json({purchasePrice:Number(purchasePrice),rehab:rehabCost,otherCosts:other,totalBasis,arv,low:Number(v.priceRangeLow)||arv*.9,high:Number(v.priceRangeHigh)||arv*1.1,arvMethod,refi,cashResult,equity,maxPurchase,subject,comps:(v.comparables||[]).slice(0,15)});}catch(e){res.status(500).json({error:e.message||'Unexpected server error.'})}});
module.exports=app;
if(require.main===module){const port=process.env.PORT||3000;app.listen(port,()=>console.log(`BRRRR analyzer running on http://localhost:${port}`));}
