const BOARD='https://www.sooplive.com/station/tjgpdus97/board/41833817';
const HOSTS=['https://chapi.sooplive.com','https://chapi.sooplive.co.kr'];
function normalize(payload){
 const raw=Array.isArray(payload.data)?payload.data:Array.isArray(payload.data?.data)?payload.data.data:null;
 if(!raw)throw new Error('Unexpected SOOP response');
 return raw.map(row=>{
  const id=String(row.title_no??row.id??'');
  if(!/^\d+$/.test(id))return null;
  const title=String(row.title??row.subject??'').trim();
  if(!title)return null;
  return {id,title,date:String(row.reg_date??row.created_at??row.write_dt??''),author:String(row.user_nick??row.writer_nick??''),url:'https://www.sooplive.com/station/tjgpdus97/post/'+id};
 }).filter(Boolean).sort((a,b)=>Number(b.id)-Number(a.id));
}
async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 const page=Number(req.query?.page??1);
 if(!Number.isInteger(page)||page<1||page>100)return res.status(400).json({error:'Invalid page'});
 for(const host of HOSTS){
  try{
   const response=await fetch(host+'/api/tjgpdus97/board/41833817?page='+page+'&per_page=50',{
    headers:{Accept:'application/json','User-Agent':'YoningNoticeReader/1.0',Referer:BOARD},
    signal:AbortSignal.timeout(7000),redirect:'error'
   });
   if(!response.ok)throw new Error('SOOP '+response.status);
   const payload=await response.json(),posts=normalize(payload);
   res.setHeader('Cache-Control','public, max-age=0, s-maxage=20, stale-while-revalidate=30');
   return res.status(200).json({posts,page,hasMore:!!payload.links?.next||!!payload.next_page_url||(Number(payload.last_page)>page),boardUrl:BOARD});
  }catch(error){console.error('[notices]',host,error.message)}
 }
 res.setHeader('Cache-Control','no-store');
 return res.status(502).json({error:'공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',boardUrl:BOARD});
}
module.exports=handler;
module.exports.normalize=normalize;
