const SUPABASE_URL='https://llqikrcqavwfbuajykig.supabase.co';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const {password,action,id,data={}}=req.body||{};
 if(String(password)!==String(process.env.STAR_ADMIN_PASSWORD||''))return res.status(401).json({error:'관리자 비밀번호가 틀렸습니다.'});
 const secret=process.env.SUPABASE_SECRET_KEY;if(!secret)return res.status(500).json({error:'SUPABASE_SECRET_KEY 미설정'});
 const H={'apikey':secret,'Authorization':`Bearer ${secret}`,'Content-Type':'application/json'};
 const allowed=['tier','race','player_name','display_name','soop_user_id','soop_nickname','soop_profile_image','status_flags','enabled','sort_order'];
 const clean={};for(const k of allowed)if(Object.prototype.hasOwnProperty.call(data,k))clean[k]=data[k];

 if(action==='create'){
  const name=String(clean.player_name||'').trim(),tier=String(clean.tier||'').trim(),race=String(clean.race||'').trim();
  if(!name||!tier||!['T','Z','P'].includes(race))return res.status(400).json({error:'이름/티어/종족을 확인해.'});
  const sr=await fetch(`${SUPABASE_URL}/rest/v1/star_players?select=sort_order&order=sort_order.desc&limit=1`,{headers:H});
  let max=0;if(sr.ok){try{const a=await sr.json();max=Number(a?.[0]?.sort_order||0)}catch{}}
  const body={player_name:name,display_name:String(clean.display_name||name).trim()||name,tier,race,sort_order:max+1,status_flags:Array.isArray(clean.status_flags)?clean.status_flags:[],enabled:true};
  for(const k of ['soop_user_id','soop_nickname','soop_profile_image'])if(clean[k])body[k]=clean[k];
  const r=await fetch(`${SUPABASE_URL}/rest/v1/star_players`,{method:'POST',headers:{...H,'Prefer':'return=representation'},body:JSON.stringify(body)});
  const txt=await r.text();if(!r.ok)return res.status(r.status).json({error:`신규등록 실패: ${txt}`});let a=[];try{a=JSON.parse(txt)}catch{}
  return a?.[0]?res.status(200).json({ok:true,row:a[0]}):res.status(500).json({error:'신규등록 후 행을 받지 못했습니다.'});
 }
 if(!id)return res.status(400).json({error:'선수 id가 없습니다.'});
 if(action==='delete'){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/star_players?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...H,'Prefer':'return=representation'},body:JSON.stringify({enabled:false,updated_at:new Date().toISOString()})});
  const txt=await r.text();if(!r.ok)return res.status(r.status).json({error:`삭제 실패: ${txt}`});return res.status(200).json({ok:true});
 }
 if(action!=='update')return res.status(400).json({error:'알 수 없는 작업'});
 if(!Object.keys(clean).length)return res.status(400).json({error:'수정할 값이 없습니다.'});
 clean.updated_at=new Date().toISOString();
 const r=await fetch(`${SUPABASE_URL}/rest/v1/star_players?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{...H,'Prefer':'return=representation'},body:JSON.stringify(clean)});
 const txt=await r.text();if(!r.ok)return res.status(r.status).json({error:`수정 실패: ${txt}`});let a=[];try{a=JSON.parse(txt)}catch{}
 return a?.[0]?res.status(200).json({ok:true,row:a[0]}):res.status(404).json({error:'수정된 행이 없습니다.'});
}