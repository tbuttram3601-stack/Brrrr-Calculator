const express=require('express');
const path=require('path');
const app=express();
app.use(express.json());
app.use(express.static(__dirname));
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

async function rentcast(url){
  const r=await fetch(url,{headers:{Accept:'application/json','X-Api-Key':process.env.RENTCAST_API_KEY}});
  const text=await r.text();
  if(!r.ok){const e=new Error(text.slice(0,220)||'RentCast request failed');e.status=r.status;throw e}
  try{return JSON.parse(text)}catch(_){throw new Error('RentCast returned invalid JSON')}
}
function firstRecord(x){return Array.isArray(x)?x[0]:x}
function haversine(a,b){
  const lat1=Number(a.latitude),lon1=Number(a.longitude),lat2=Number(b.latitude),lon2=Number(b.longitude);
  if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return null;
  const R=3958.8,rad=Math.PI/180,dlat=(lat2-lat1)*rad,dlon=(lon2-lon1)*rad;
  const q=Math.sin(dlat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dlon/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}

app.post('/api/analyze',async(req,res)=>{
  let counted=0;
  try{
    const {address,purchasePrice,rehab,rehabRate=25,otherCosts,ltv=.75}=req.body||{};
    const purchase=Number(purchasePrice);
    if(!address||!Number.isFinite(purchase)||purchase<=0)return res.status(400).json({error:'Address and purchase price are required.'});
    if(!process.env.RENTCAST_API_KEY)return res.status(500).json({error:'RENTCAST_API_KEY is not configured on the server.'});
    const base='https://api.rentcast.io/v1/properties?';

    // Request 1: authoritative public-record profile for the subject.
    const subjectQs=new URLSearchParams({address:String(address).trim(),limit:'1'});
    const subjectRaw=await rentcast(base+subjectQs); counted++; res.set('X-RentCast-Request-Counted',String(counted));
    const subject=firstRecord(subjectRaw);
    if(!subject||!subject.formattedAddress) return res.status(422).json({error:'No property record was found for this address.'});

    // Request 2: actual SOLD property records, not AVM/listing comparables.
    const sf=Number(subject.squareFootage)||0, lot=Number(subject.lotSize)||0, yr=Number(subject.yearBuilt)||0;
    const beds=Number(subject.bedrooms), baths=Number(subject.bathrooms);
    // Broad sold search: do NOT pre-filter on square footage/year/lot.
    // Those fields can be misleading for basement homes. Fetch the local sold universe
    // and rank it locally using the full structural profile.
    const q={address:String(address).trim(),radius:'2',saleDateRange:'730',limit:'500'};
    if(subject.propertyType)q.propertyType=subject.propertyType;
    const salesRaw=await rentcast(base+new URLSearchParams(q)); counted++; res.set('X-RentCast-Request-Counted',String(counted));
    const sales=(Array.isArray(salesRaw)?salesRaw:[]).filter(c=>Number(c.lastSalePrice)>0&&c.lastSaleDate&&c.id!==subject.id).map(c=>({
      ...c,
      price:Number(c.lastSalePrice),
      saleDate:c.lastSaleDate,
      distance:haversine(subject,c),
      garageSpaces:Number.isFinite(Number(c.features?.garageSpaces))?Number(c.features.garageSpaces):null,
      floorCount:Number.isFinite(Number(c.features?.floorCount))?Number(c.features.floorCount):null,
      foundationType:c.features?.foundationType||null,
      architectureType:c.features?.architectureType||null,
      garageType:c.features?.garageType||null,
      garage:c.features?.garage===true,
      roomCount:Number.isFinite(Number(c.features?.roomCount))?Number(c.features.roomCount):null,
      exteriorType:c.features?.exteriorType||null
    }));

    const rate=clamp(Number(rehabRate)||25,0,200);
    const rehabIsManual=rehab!==null&&rehab!==undefined&&rehab!=='';
    const rehabCost=rehabIsManual?Math.max(0,Number(rehab)||0):Math.round(sf?sf*rate:purchase*.35);
    const otherIsManual=otherCosts!==null&&otherCosts!==undefined&&otherCosts!=='';
    const other=otherIsManual?Math.max(0,Number(otherCosts)||0):Math.round((purchase+rehabCost)*.07);
    const L=clamp(Number(ltv)||.75,.01,1);
    const totalBasis=purchase+rehabCost+other;

    res.json({
      purchasePrice:purchase,rehab:rehabCost,rehabRate:rate,rehabIsManual,
      otherCosts:other,otherIsManual,totalBasis,ltv:L,
      subject:{...subject,garageSpaces:Number.isFinite(Number(subject.features?.garageSpaces))?Number(subject.features.garageSpaces):null,
        floorCount:Number.isFinite(Number(subject.features?.floorCount))?Number(subject.features.floorCount):null,
        foundationType:subject.features?.foundationType||null,architectureType:subject.features?.architectureType||null,
        garageType:subject.features?.garageType||null,garage:subject.features?.garage===true,
        roomCount:Number.isFinite(Number(subject.features?.roomCount))?Number(subject.features.roomCount):null,
        exteriorType:subject.features?.exteriorType||null},
      comps:sales,
      soldCandidateCount:sales.length,
      requestCount:counted,
      dataMethod:'RentCast public-record closed sales'
    });
  }catch(e){
    if(counted)res.set('X-RentCast-Request-Counted',String(counted));
    res.status(e.status||500).json({error:e.message||'Unexpected server error.'});
  }
});
module.exports=app;
if(require.main===module){const port=process.env.PORT||3000;app.listen(port,()=>console.log(`BRRRR analyzer running on http://localhost:${port}`))}
