'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {assumptions,normalizeRecord,haversine,positive}=require('./core');
const PUBLIC={'/':'index.html','/index.html':'index.html','/math.html':'math.html','/core.js':'core.js','/app.js':'app.js'};
function createHandler({fetchImpl=globalThis.fetch,apiKey=()=>process.env.RENTCAST_API_KEY,now=()=>Date.now()}={}){
  return async function handler(req,res){
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Cache-Control','no-store');
    const send=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
    const pathname=new URL(req.url,'http://localhost').pathname;
    if(req.method==='GET'&&Object.hasOwn(PUBLIC,pathname)){
      try{const file=PUBLIC[pathname];res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':'application/javascript; charset=utf-8');res.end(await fs.readFile(path.join(__dirname,file)));}
      catch{send(500,{error:'Page could not be loaded.'});}return;
    }
    if(pathname!=='/api/analyze'){send(404,{error:'Not found.'});return;}
    if(req.method!=='POST'){res.setHeader('Allow','POST');send(405,{error:'Use POST to analyze a property.'});return;}
    let counted=0;
    res.setHeader('X-RentCast-Request-Counted','0');
    const request=async params=>{
      const response=await fetchImpl('https://api.rentcast.io/v1/properties?'+new URLSearchParams(params),{
        headers:{Accept:'application/json','X-Api-Key':apiKey()},signal:AbortSignal.timeout(20000)});
      // Count the provider's successful HTTP response even if its JSON is malformed.
      if(response.status===200){counted++;res.setHeader('X-RentCast-Request-Counted',String(counted));}
      if(response.status!==200){const e=Error(response.status===401||response.status===403?'RentCast authentication or subscription failed.':response.status===429?'RentCast rate limit reached. Please try later.':'RentCast request failed.');e.status=502;throw e;}
      try{return await response.json();}catch{throw Error('RentCast returned invalid JSON.');}
    };
    try{
      if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host){send(403,{error:'Analysis must be requested from this website.'});return;}}
      if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json')){send(415,{error:'Use JSON for analysis requests.'});return;}
      let input=req.body;
      if(input==null){let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>16384){send(413,{error:'Request is too large.'});return;}raw+=chunk;}
        try{input=JSON.parse(raw);}catch{send(400,{error:'Invalid request JSON.'});return;}}
      if(!input||Array.isArray(input)||typeof input!=='object'){send(400,{error:'Invalid analysis request.'});return;}
      if(typeof input.address!=='string'||!input.address.trim()||input.address.length>300){send(400,{error:'Enter a property address.'});return;}
      try{assumptions(input,{});}catch(e){send(400,{error:e.message});return;}
      if(!apiKey()){send(503,{error:'RENTCAST_API_KEY is not configured on the server.'});return;}
      const address=input.address.trim();
      const subjects=await request({address,limit:'1'});
      if(!Array.isArray(subjects)){throw Error('RentCast returned an unexpected subject response.');}
      if(!subjects.length){send(422,{error:'No property record was found for this address.'});return;}
      const subject=publicRecord(subjects[0]);
      if(!subject.formattedAddress||!subject.propertyType){send(422,{error:'The property record is incomplete. No comp request was made.'});return;}
      const query={address:subject.formattedAddress,radius:'2',saleDateRange:'730',limit:'500',propertyType:subject.propertyType};
      const raw=await request(query);
      if(!Array.isArray(raw))throw Error('RentCast returned an unexpected sales response.');
      const comps=raw.map(publicRecord).filter(c=>positive(c.lastSalePrice)&&c.lastSaleDate).map(c=>({...c,price:positive(c.lastSalePrice),saleDate:c.lastSaleDate,distance:haversine(subject,c)}));
      send(200,{...assumptions(input,subject),subject,comps,soldCandidateCount:comps.length,rawCandidateCount:raw.length,
        searchTruncated:raw.length===500,requestCount:counted,analysisDate:new Date(now()).toISOString(),dataMethod:'RentCast provider-reported sales'});
    }catch(e){send(e.status||502,{error:e.name==='TimeoutError'?'RentCast timed out. No automatic retry was made.':e.message||'Analysis failed.'});}
  };
}
function publicRecord(raw){
  const r=normalizeRecord(raw),out={};
  for(const k of ['id','formattedAddress','addressLine1','addressLine2','city','state','zipCode','latitude','longitude','propertyType',
    'bedrooms','bathrooms','squareFootage','lotSize','yearBuilt','lastSalePrice','lastSaleDate','subdivision',
    'garageSpaces','floorCount','foundationType','architectureType','garageType','garage','roomCount','exteriorType'])out[k]=r[k]??null;
  return out;
}
const handler=createHandler();
module.exports=handler;
module.exports.createHandler=createHandler;
if(require.main===module)http.createServer(handler).listen(process.env.PORT||3000,'127.0.0.1',()=>console.log('BRRRR analyzer ready locally.'));

