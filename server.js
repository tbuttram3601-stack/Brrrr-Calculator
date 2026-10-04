const express=require('express');
const path=require('path');
const app=express();
app.use(express.json());
app.use(express.static(__dirname));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

app.post('/api/analyze',async(req,res)=>{
  try{
    const {address,purchasePrice,rehab,rehabRate=25,otherCosts,ltv=.75}=req.body||{};
    const purchase=Number(purchasePrice);
    if(!address||!Number.isFinite(purchase)||purchase<=0)return res.status(400).json({error:'Address and purchase price are required.'});
    if(!process.env.RENTCAST_API_KEY)return res.status(500).json({error:'RENTCAST_API_KEY is not configured on the server.'});

    const qs=new URLSearchParams({
      address:String(address).trim(),
      maxRadius:'1.5',
      daysOld:'365',
      compCount:'25',
      lookupSubjectAttributes:'true'
    });

    const r=await fetch('https://api.rentcast.io/v1/avm/value?'+qs,{
      headers:{Accept:'application/json','X-Api-Key':process.env.RENTCAST_API_KEY}
    });

    if(!r.ok){
      const t=await r.text();
      return res.status(r.status).json({error:'Property data request failed: '+t.slice(0,180)});
    }

    // A successful RentCast HTTP 200 is billable. Tell the browser counter immediately.
    res.set('X-RentCast-Request-Counted','1');

    const v=await r.json();
    const arv=Number(v.price)||0;
    if(!arv)return res.status(422).json({error:'RentCast returned no usable valuation for this address.'});

    const subject=v.subjectProperty||{};
    const sf=Number(subject.squareFootage)||0;
    const rate=clamp(Number(rehabRate)||25,0,200);
    const rehabIsManual=rehab!==null&&rehab!==undefined&&rehab!=='';
    const rehabCost=rehabIsManual?Math.max(0,Number(rehab)||0):Math.round(sf?sf*rate:purchase*.35);

    const otherIsManual=otherCosts!==null&&otherCosts!==undefined&&otherCosts!=='';
    const other=otherIsManual?Math.max(0,Number(otherCosts)||0):Math.round((purchase+rehabCost)*.07);

    const L=clamp(Number(ltv)||.75,.01,1);
    const totalBasis=purchase+rehabCost+other;
    const refi=arv*L;
    const cashResult=refi-totalBasis;
    const equity=arv-refi;

    // If "other costs" are automatic, they equal 7% of purchase + rehab.
    // Solve: P + rehab + .07(P + rehab) = refi  =>  P = refi/1.07 - rehab.
    const maxPurchase=otherIsManual
      ? Math.max(0,refi-rehabCost-other)
      : Math.max(0,(refi/1.07)-rehabCost);

    res.json({
      purchasePrice:purchase,
      rehab:rehabCost,
      rehabRate:rate,
      rehabIsManual,
      otherCosts:other,
      otherIsManual,
      totalBasis,
      arv,
      rentcastValue:arv,
      low:Number(v.priceRangeLow)||arv*.9,
      high:Number(v.priceRangeHigh)||arv*1.1,
      arvMethod:'RentCast comp-supported baseline valuation',
      refi,
      ltv:L,
      cashResult,
      equity,
      maxPurchase,
      subject,
      comps:(v.comparables||[]).slice(0,25)
    });
  }catch(e){
    res.status(500).json({error:e.message||'Unexpected server error.'});
  }
});

module.exports=app;
if(require.main===module){
  const port=process.env.PORT||3000;
  app.listen(port,()=>console.log(`BRRRR analyzer running on http://localhost:${port}`));
}
