const SUPABASE_URL = 'https://llqikrcqavwfbuajykig.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const {password,id,data} = req.body || {};
  if (String(password) !== String(process.env.STAR_ADMIN_PASSWORD || '')) {
    return res.status(401).json({error:'관리자 비밀번호가 틀렸습니다.'});
  }
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return res.status(500).json({error:'SUPABASE_SECRET_KEY가 설정되지 않았습니다.'});
  const allowed = ['tier','soop_user_id','soop_nickname','soop_profile_image','display_name','enabled','sort_order'];
  const clean = {};
  for (const k of allowed) if (Object.prototype.hasOwnProperty.call(data||{},k)) clean[k]=data[k];
  clean.updated_at = new Date().toISOString();
  if (!id || Object.keys(clean).length===1) return res.status(400).json({error:'수정할 값이 없습니다.'});
  const endpoint = `${SUPABASE_URL}/rest/v1/star_players?id=eq.${encodeURIComponent(id)}`;
  const r = await fetch(endpoint,{
    method:'PATCH',
    headers:{
      'apikey':secret,
      'Authorization':`Bearer ${secret}`,
      'Content-Type':'application/json',
      'Prefer':'return=representation'
    },
    body:JSON.stringify(clean)
  });
  const text = await r.text();
  if(!r.ok) return res.status(r.status).json({error:`Supabase PATCH 실패: ${text}`});

  // Read back from DB with the secret key and verify the requested values really persisted.
  const vr = await fetch(endpoint+'&select=*',{headers:{
    'apikey':secret,
    'Authorization':`Bearer ${secret}`
  }});
  const vtext = await vr.text();
  if(!vr.ok) return res.status(vr.status).json({error:`저장 후 검증 조회 실패: ${vtext}`});
  let rows=[];
  try { rows = vtext ? JSON.parse(vtext) : []; } catch {}
  if(!Array.isArray(rows) || !rows[0]) {
    return res.status(404).json({error:`저장 후 id=${id} 행을 다시 찾지 못했습니다.`});
  }
  const row=rows[0];
  for(const [k,v] of Object.entries(clean)){
    if(k==='updated_at') continue;
    if(String(row[k]??'')!==String(v??'')){
      return res.status(500).json({error:`저장 검증 실패: ${k} 값이 DB에 반영되지 않았습니다.`});
    }
  }
  return res.status(200).json({ok:true,row});
}
