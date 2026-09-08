const LIVE_ENDPOINTS=[
  'https://live.sooplive.com/afreeca/player_live_api.php',
  'https://live.sooplive.co.kr/afreeca/player_live_api.php',
  'https://live.afreecatv.com/afreeca/player_live_api.php'
];

function formFor(id){
  const p=new URLSearchParams();
  p.set('bid',id);
  p.set('type','live');
  p.set('pwd','');
  p.set('player_type','html5');
  p.set('stream_type','common');
  p.set('mode','landing');
  p.set('from_api','0');
  p.set('is_revive','false');
  return p.toString();
}

async function one(id){
  for(const base of LIVE_ENDPOINTS){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),5500);
    try{
      const r=await fetch(`${base}?bjid=${encodeURIComponent(id)}`,{
        method:'POST',
        headers:{
          'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent':'Mozilla/5.0',
          'Referer':'https://www.sooplive.co.kr/'
        },
        body:formFor(id),
        signal:ctrl.signal
      });
      clearTimeout(timer);
      if(!r.ok)continue;

      const j=await r.json().catch(()=>null);
      const ch=j?.CHANNEL||{};
      const result=Number(ch.RESULT);
      const bno=String(ch.BNO||'').trim();
      const live=result===1 && !!bno;
      const title=typeof ch.TITLE==='string'?ch.TITLE.trim():'';

      return {
        live,
        bno:live?bno:'',
        title:live?title:'',
        thumbnail:live?`https://liveimg.sooplive.co.kr/h/${encodeURIComponent(bno)}.webp`:''
      };
    }catch(_){
      clearTimeout(timer);
    }
  }
  return {live:false,bno:'',title:'',thumbnail:''};
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

  const values=await mapLimit(ids,12,one);
  const status={};
  ids.forEach((id,i)=>status[id]=values[i]||{live:false,bno:'',title:'',thumbnail:''});

  res.setHeader('Cache-Control','s-maxage=20, stale-while-revalidate=20');
  return res.status(200).json({status});
}
