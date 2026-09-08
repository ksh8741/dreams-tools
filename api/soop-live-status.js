const PRIMARY='https://live.sooplive.com/afreeca/player_live_api.php';
const FALLBACK='https://live.sooplive.co.kr/afreeca/player_live_api.php';
const STATION='https://st.sooplive.com/api/get_station_status.php';

function formFor(id){
  const p=new URLSearchParams();
  p.set('bid',id);
  p.set('type','live');
  p.set('pwd','');
  p.set('player_type','html5');
  p.set('stream_type','common');
  p.set('quality','HD');
  p.set('mode','landing');
  p.set('from_api','0');
  p.set('is_revive','false');
  return p.toString();
}

async function fetchJson(url,options={},timeout=2600){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),timeout);
  try{
    const r=await fetch(url,{...options,signal:ctrl.signal});
    if(!r.ok)return null;
    return await r.json().catch(()=>null);
  }catch(_){
    return null;
  }finally{
    clearTimeout(timer);
  }
}

function toIsoKst(v){
  const s=String(v||'').trim();
  if(!s)return '';
  // SOOP station status broad_start is Korea local time.
  if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)){
    return s.replace(' ','T')+'+09:00';
  }
  return s;
}

async function stationMeta(id){
  const j=await fetchJson(`${STATION}?szBjId=${encodeURIComponent(id)}`,{},2200);
  const obj=j?.data||j||{};
  return {
    started_at:toIsoKst(obj.broad_start||obj.BROAD_START||''),
    station_title:String(obj.station_title||obj.title||'').trim()
  };
}

async function channelRequest(id,base){
  return fetchJson(`${base}?bjid=${encodeURIComponent(id)}`,{
    method:'POST',
    headers:{
      'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
      'User-Agent':'Mozilla/5.0',
      'Referer':'https://www.sooplive.co.kr/'
    },
    body:formFor(id)
  },2600);
}

async function one(id){
  // Primary endpoint first. Only use one fallback if the request itself failed.
  let j=await channelRequest(id,PRIMARY);
  if(!j)j=await channelRequest(id,FALLBACK);

  const ch=j?.CHANNEL||{};
  const result=Number(ch.RESULT);
  const bno=String(ch.BNO||'').trim();
  const live=result===1 && !!bno;

  if(!live){
    return {live:false,bno:'',title:'',thumbnail:'',started_at:''};
  }

  // Only LIVE users need the extra station-status call for elapsed time.
  const meta=await stationMeta(id);
  const title=String(ch.TITLE||meta.station_title||'').trim();

  return {
    live:true,
    bno,
    title,
    thumbnail:`https://liveimg.sooplive.co.kr/h/${encodeURIComponent(bno)}.webp`,
    started_at:meta.started_at
  };
}

async function mapLimit(items,limit,worker){
  const out=new Array(items.length);
  let idx=0;
  const runners=Array.from({length:Math.min(limit,items.length)},async()=>{
    while(true){
      const i=idx++;
      if(i>=items.length)return;
      out[i]=await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return out;
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});

  const ids=[...new Set((req.body?.ids||[]).map(v=>String(v||'').trim()).filter(Boolean))].slice(0,80);
  if(!ids.length)return res.status(200).json({status:{}});

  // Old version used 12 concurrent checks + sequential client chunks.
  // 40 concurrent checks keeps each Vercel call short while avoiding 341 serial lookups.
  const values=await mapLimit(ids,40,one);
  const status={};
  ids.forEach((id,i)=>status[id]=values[i]||{live:false,bno:'',title:'',thumbnail:'',started_at:''});

  res.setHeader('Cache-Control','s-maxage=20, stale-while-revalidate=20');
  return res.status(200).json({status});
}
