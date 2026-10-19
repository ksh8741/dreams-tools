const BOARD='https://www.sooplive.com/station/tjgpdus97/board/41833817';
const HOSTS=['https://api-channel.sooplive.com'];
function normalize(payload){
 const raw=Array.isArray(payload.contents)?[...payload.contents,...(Array.isArray(payload.noticeData)?payload.noticeData:[])]:null;
 if(!raw)throw new Error('Unexpected SOOP response');
 return [...new Map(raw.filter(row=>Number(row.bbsNo)===41833817 && Number(row.authNo)===101).map(row=>[String(row.titleNo),row])).values()].map(row=>{
  const id=String(row.titleNo??'');
  if(!/^\d+$/.test(id))return null;
  const title=String(row.titleName??'').trim();
  if(!title)return null;
  return {id,title,date:String(row.regDate??''),author:String(row.userNick??''),url:'https://www.sooplive.com/station/tjgpdus97/post/'+id};
 }).filter(Boolean).sort((a,b)=>Number(b.id)-Number(a.id));
}
async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 const page=Number(req.query?.page??1);
 if(!Number.isInteger(page)||page<1||page>100)return res.status(400).json({error:'Invalid page'});
 for(const host of HOSTS){
  try{
   const response=await fetch(host+'/v1.1/channel/tjgpdus97/board?bbsNo=41833817&perPage=20&page='+page+'&field=title,contents,user_nick,user_id,hashtags',{
    headers:{Accept:'application/json','User-Agent':'Mozilla/5.0',Referer:BOARD},
    signal:AbortSignal.timeout(7000),redirect:'error'
   });
   if(!response.ok)throw new Error('SOOP '+response.status);
   const payload=await response.json(),posts=normalize(payload);
   res.setHeader('Cache-Control','public, max-age=0, s-maxage=20, stale-while-revalidate=30');
   return res.status(200).json({posts,page,hasMore:Number(payload.meta?.totalPages)>page,boardUrl:BOARD});
  }catch(error){console.error('[notices]',host,error.message)}
 }
 res.setHeader('Cache-Control','no-store');
 return res.status(502).json({error:'공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',boardUrl:BOARD});
}
module.exports=handler;
module.exports.normalize=normalize;
