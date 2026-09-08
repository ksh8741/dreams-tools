const SUPABASE_URL='https://llqikrcqavwfbuajykig.supabase.co';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const secret=process.env.SUPABASE_SECRET_KEY;if(!secret)return res.status(500).json({error:'SUPABASE_SECRET_KEY 미설정'});
 const r=await fetch(`${SUPABASE_URL}/rest/v1/star_players?select=*&enabled=eq.true&order=sort_order.asc`,{headers:{'apikey':secret,'Authorization':`Bearer ${secret}`}});
 const txt=await r.text();if(!r.ok)return res.status(r.status).json({error:txt});let players=[];try{players=JSON.parse(txt)}catch{}
 res.setHeader('Cache-Control','no-store');
 return res.status(200).json({players});
}