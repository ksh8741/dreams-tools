const SUPABASE_URL='https://llqikrcqavwfbuajykig.supabase.co';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!secret)return res.status(500).json({error:'SUPABASE_SECRET_KEY 미설정'});
  const H={'apikey':secret,'Authorization':`Bearer ${secret}`};
  const [pr,ur,lr]=await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/star_players?select=*&enabled=eq.true&order=sort_order.asc`,{headers:H}),
    fetch(`${SUPABASE_URL}/rest/v1/star_universities?select=*&enabled=eq.true&order=sort_order.asc,name.asc`,{headers:H}),
    fetch(`${SUPABASE_URL}/rest/v1/star_live_cache?select=*`,{headers:H})
  ]);
  const [ptxt,utxt,ltxt]=await Promise.all([pr.text(),ur.text(),lr.text()]);
  if(!pr.ok)return res.status(pr.status).json({error:ptxt});
  if(!ur.ok)return res.status(ur.status).json({error:utxt});
  if(!lr.ok)return res.status(lr.status).json({error:ltxt});
  let players=[],universities=[],cache=[];
  try{players=JSON.parse(ptxt)}catch{}
  try{universities=JSON.parse(utxt)}catch{}
  try{cache=JSON.parse(ltxt)}catch{}
  const umap=new Map(universities.map(u=>[String(u.id),u]));
  const lmap=new Map(cache.map(x=>[String(x.soop_user_id),x]));
  players=players.map(p=>{
    const u=p.university_id==null?null:umap.get(String(p.university_id))||null;
    const l=p.soop_user_id?lmap.get(String(p.soop_user_id))||null:null;
    return {...p,
      university_name:u?.name||'',university_logo:u?.logo_url||'',
      live_cache_live:!!l?.is_live,live_cache_bno:l?.broad_no||'',
      live_cache_title:l?.title||'',live_cache_thumbnail:l?.thumbnail||'',
      live_cache_started_at:l?.started_at||'',live_cache_checked_at:l?.checked_at||''
    };
  });
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({players,universities});
}