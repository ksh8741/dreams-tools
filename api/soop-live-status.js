const SUPABASE_URL='https://llqikrcqavwfbuajykig.supabase.co';
const LIVE='https://live.sooplive.com/afreeca/player_live_api.php';
const FALLBACK='https://live.sooplive.co.kr/afreeca/player_live_api.php';

function formFor(id){
  const p=new URLSearchParams();
  p.set('bid',id);p.set('type','live');p.set('pwd','');p.set('player_type','html5');
  p.set('stream_type','common');p.set('quality','HD');p.set('mode','landing');
  p.set('from_api','0');p.set('is_revive','false');return p.toString();
}
async function req(id,base){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),2200);
  try{
    const r=await fetch(`${base}?bjid=${encodeURIComponent(id)}`,{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','User-Agent':'Mozilla/5.0','Referer':'https://www.sooplive.co.kr/'},
      body:formFor(id),signal:ctrl.signal
    });
    if(!r.ok)return null;
    return await r.json().catch(()=>null);
  }catch(_){return null}finally{clearTimeout(timer)}
}
async function one(id){
  let j=await req(id,LIVE);if(!j)j=await req(id,FALLBACK);
  const ch=j?.CHANNEL||{},bno=String(ch.BNO||'').trim();
  const live=Number(ch.RESULT)===1&&!!bno;
  return {live,bno:live?bno:'',title:live?String(ch.TITLE||'').trim():'',thumbnail:live?`https://liveimg.sooplive.co.kr/h/${encodeURIComponent(bno)}.webp`:'',started_at:''};
}
async function mapLimit(items,limit,worker){
  const out=new Array(items.length);let i=0;
  const runners=Array.from({length:Math.min(limit,items.length)},async()=>{while(true){const n=i++;if(n>=items.length)return;out[n]=await worker(items[n])}});
  await Promise.all(runners);return out;
}
async function writeCache(secret,ids,values){
  const rows=ids.map((id,i)=>{const v=values[i]||{live:false};return {soop_user_id:id,is_live:!!v.live,broad_no:v.bno||null,title:v.title||null,thumbnail:v.thumbnail||null,checked_at:new Date().toISOString()}});
  try{
    await fetch(`${SUPABASE_URL}/rest/v1/star_live_cache?on_conflict=soop_user_id`,{
      method:'POST',
      headers:{'apikey':secret,'Authorization':`Bearer ${secret}`,'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify(rows)
    });
  }catch(_){}
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const ids=[...new Set((req.body?.ids||[]).map(v=>String(v||'').trim()).filter(Boolean))].slice(0,80);
  if(!ids.length)return res.status(200).json({status:{}});
  const values=await mapLimit(ids,50,one),status={};
  ids.forEach((id,i)=>status[id]=values[i]||{live:false,bno:'',title:'',thumbnail:'',started_at:''});
  const secret=process.env.SUPABASE_SECRET_KEY;if(secret)await writeCache(secret,ids,values);
  res.setHeader('Cache-Control','no-store');return res.status(200).json({status});
}.