function safeImage(value){try{const u=new URL(value);return u.protocol==='https:'&&['sooplive.com','sooplive.co.kr','afreecatv.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null}catch(_){return null}}
function normalize(payload){
 if(!Array.isArray(payload.contents))throw Error('Unexpected SOOP clip response');
 return payload.contents.filter(row=>Number(row.authNo)===101&&row.ucc?.fileType==='CLIP'&&!row.ucc?.paidPpv&&!row.isGeoblock&&Number(row.ucc?.grade||0)===0&&row.copyright?.delFlag!=='Y').map(row=>{
  const id=String(row.titleNo);if(!/^\d+$/.test(id))return null;
  return{id,title:String(row.titleName||'').replace(/^\[클립\]\s*/,''),author:String(row.userNick||''),date:String(row.regDate||''),thumbnail:safeImage(row.ucc.thumb),duration:Math.round(Number(row.ucc.totalFileDuration||0)/1000),views:Number(row.count?.readCnt||0)};
 }).filter(Boolean);
}
function seededRandom(seed){let value=parseInt(seed,16)>>>0;return()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296}}
function shuffled(items,seed){const result=[...items],random=seededRandom(seed);for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
async function upstream(page,sort){
 const response=await fetch('https://api-channel.sooplive.com/v1.1/channel/tjgpdus97/vod/clip?page='+page+'&perPage=20&orderBy='+sort,{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0',Referer:'https://www.sooplive.com/station/tjgpdus97/vod/clip'},signal:AbortSignal.timeout(12000),redirect:'error'});
 if(!response.ok)throw Error('SOOP '+response.status);return response.json();
}
async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 const sort=String(req.query?.sort??'popular');if(!['popular','reg_date','random'].includes(sort))return res.status(400).json({error:'Invalid sort'});
 const page=Number(req.query?.page??1);if(!Number.isInteger(page)||page<1||page>1000)return res.status(400).json({error:'Invalid page'});
 const seed=String(req.query?.seed??'');if(sort==='random'&&!/^[a-f0-9]{1,8}$/.test(seed))return res.status(400).json({error:'Invalid seed'});
 const knownPages=Number(req.query?.pages??0);if(!Number.isInteger(knownPages)||knownPages<0||knownPages>10000)return res.status(400).json({error:'Invalid catalog'});
 try{
  let payload,totalPages;
  if(sort==='random'){
   const first=knownPages?null:await upstream(1,'reg_date');totalPages=knownPages||Number(first?.meta?.totalPages)||1;
   if(page>totalPages)return res.status(200).json({clips:[],page,sort,totalPages,hasMore:false});
   const sourcePage=shuffled(Array.from({length:totalPages},(_,i)=>i+1),seed)[page-1];
   payload=sourcePage===1&&first?first:await upstream(sourcePage,'reg_date');
  }else{payload=await upstream(page,sort);totalPages=Number(payload.meta?.totalPages)||1}
  let clips=normalize(payload);if(sort==='random')clips=shuffled(clips,((parseInt(seed,16)+page)>>>0).toString(16));
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=30');
  return res.status(200).json({clips,page,sort,totalPages,hasMore:totalPages>page});
 }catch(error){console.error('[clips]',error.message);res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'클립을 불러오지 못했습니다.'})}
}
module.exports=handler;module.exports.normalize=normalize;module.exports.shuffled=shuffled;
