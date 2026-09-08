const SUPABASE_URL='https://llqikrcqavwfbuajykig.supabase.co';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});

  const secret=process.env.SUPABASE_SECRET_KEY;
  if(!secret)return res.status(500).json({error:'SUPABASE_SECRET_KEY 미설정'});

  const H={'apikey':secret,'Authorization':`Bearer ${secret}`};

  const [pr,ur]=await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/star_players?select=*&enabled=eq.true&order=sort_order.asc`,{headers:H}),
    fetch(`${SUPABASE_URL}/rest/v1/star_universities?select=*&enabled=eq.true&order=sort_order.asc,name.asc`,{headers:H})
  ]);

  const [ptxt,utxt]=await Promise.all([pr.text(),ur.text()]);
  if(!pr.ok)return res.status(pr.status).json({error:ptxt});
  if(!ur.ok)return res.status(ur.status).json({error:utxt});

  let players=[],universities=[];
  try{players=JSON.parse(ptxt)}catch{}
  try{universities=JSON.parse(utxt)}catch{}

  const umap=new Map(universities.map(u=>[String(u.id),u]));
  players=players.map(p=>{
    const u=p.university_id==null?null:umap.get(String(p.university_id))||null;
    return {
      ...p,
      university_name:u?.name||'',
      university_logo:u?.logo_url||''
    };
  });

  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({players,universities});
}
