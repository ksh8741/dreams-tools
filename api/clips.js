function safeImage(value){try{const u=new URL(value);return u.protocol==='https:'&&['sooplive.com','sooplive.co.kr','afreecatv.com'].some(h=>u.hostname===h||u.hostname.endsWith('.'+h))?u.href:null}catch(_){return null}}
function normalize(payload){
 if(!Array.isArray(payload.contents))throw Error('Unexpected SOOP clip response');
 return payload.contents.filter(row=>Number(row.authNo)===101&&row.ucc?.fileType==='CLIP'&&!row.ucc?.paidPpv&&!row.isGeoblock&&Number(row.ucc?.grade||0)===0&&row.copyright?.delFlag!=='Y'&&!/개\s*선물/.test(String(row.titleName||''))).map(row=>{
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
const RANDOM_BATCH=8;
function randomSlots(totalPages,seed,page){return shuffled(Array.from({length:totalPages*20},(_,i)=>i),seed).slice((page-1)*RANDOM_BATCH,page*RANDOM_BATCH)}
async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 const sort=String(req.query?.sort??'popular');if(!['popular','reg_date','random'].includes(sort))return res.status(400).json({error:'Invalid sort'});
 const page=Number(req.query?.page??1);if(!Number.isInteger(page)||page<1||page>(sort==='random'?25000:1000))return res.status(400).json({error:'Invalid page'});
 const seed=String(req.query?.seed??'');if(sort==='random'&&!/^[a-f0-9]{1,8}$/.test(seed))return res.status(400).json({error:'Invalid seed'});
 const knownPages=Number(req.query?.pages??0);if(!Number.isInteger(knownPages)||knownPages<0||knownPages>10000)return res.status(400).json({error:'Invalid catalog'});
 try{
  let clips,totalPages,hasMore;
  if(sort==='random'){
   const first=knownPages?null:await upstream(1,'reg_date');totalPages=knownPages||Number(first?.meta?.totalPages)||1;
   const slots=randomSlots(totalPages,seed,page),pages=[...new Set(slots.map(slot=>Math.floor(slot/20)+1))];
   const payloads=new Map(await Promise.all(pages.map(async p=>[p,p===1&&first?first:await upstream(p,'reg_date')])));
   for(const payload of payloads.values())if(!Array.isArray(payload.contents))throw Error('Unexpected SOOP clip response');
   // Preserve the global slot permutation; never append the rest of a selected page.
   clips=slots.flatMap(slot=>{const row=payloads.get(Math.floor(slot/20)+1)?.contents?.[slot%20];return row?normalize({contents:[row]}):[]});
   hasMore=page*RANDOM_BATCH<totalPages*20;
  }else{const payload=await upstream(page,sort);clips=normalize(payload);totalPages=Number(payload.meta?.totalPages)||1;hasMore=totalPages>page}
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=30, stale-while-revalidate=30');
  return res.status(200).json({clips,page,sort,totalPages,hasMore});
 }catch(error){console.error('[clips]',error.message);res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'클립을 불러오지 못했습니다.'})}
}
module.exports=handler;module.exports.normalize=normalize;module.exports.shuffled=shuffled;module.exports.randomSlots=randomSlots;
