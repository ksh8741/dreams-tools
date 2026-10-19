const BOARD='https://www.sooplive.com/station/tjgpdus97/board/41833817';
const HOSTS=['https://api-channel.sooplive.com'];
function safeImage(value){
 try{const u=new URL(value);return u.protocol==='https:' && ['sooplive.com','sooplive.co.kr','afreecatv.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host))?u.href:null}catch(_){return null}
}
function normalize(payload,channelNickname){
 const raw=Array.isArray(payload.contents)?[...payload.contents,...(Array.isArray(payload.noticeData)?payload.noticeData:[])]:null;
 if(!raw)throw new Error('Unexpected SOOP response');
 return [...new Map(raw.filter(row=>Number(row.bbsNo)===41833817 && Number(row.authNo)===101).map(row=>[String(row.titleNo),row])).values()].map(row=>{
  const id=String(row.titleNo??'');
  if(!/^\d+$/.test(id))return null;
  const title=String(row.titleName??'').trim();
  if(!title)return null;
  const summary=String(row.content?.textContent??row.content?.summary??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,280);
  const thumbnail=(Array.isArray(row.photos)?row.photos:[]).map(photo=>safeImage(photo.url)).find(Boolean)||null;
  const body=String(row.content?.content??'');
  const photos=(Array.isArray(row.photos)?row.photos:[]).map(photo=>safeImage(photo.url)).filter(Boolean);
  return {id,title,summary,thumbnail,body,photos,avatar:safeImage(row.profileImage),authorId:String(row.userId||''),date:String(row.regDate??''),author:String(row.userId==='tjgpdus97'&&channelNickname?channelNickname:row.userNick??''),url:'https://www.sooplive.com/station/tjgpdus97/post/'+id};
 }).filter(Boolean).sort((a,b)=>b.date.localeCompare(a.date)||Number(b.id)-Number(a.id));
}
async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 const page=Number(req.query?.page??1);
 if(!Number.isInteger(page)||page<1||page>10000)return res.status(400).json({error:'Invalid page'});
 for(const host of HOSTS){
  try{
   const nicknameRequest=page===1?fetch(host+'/v1.1/channel/tjgpdus97/station',{headers:{Accept:'application/json','User-Agent':'Mozilla/5.0',Referer:BOARD},signal:AbortSignal.timeout(12000),redirect:'error'})
    .then(async response=>{if(!response.ok)return '';const profile=await response.json();return String(profile.station?.userNick||'')}).catch(()=>''):Promise.resolve('');
   const response=await fetch(host+'/v1.1/channel/tjgpdus97/board?bbsNo=41833817&perPage=20&page='+page+'&field=title,contents,user_nick,user_id,hashtags',{
    headers:{Accept:'application/json','User-Agent':'Mozilla/5.0',Referer:BOARD},
    signal:AbortSignal.timeout(7000),redirect:'error'
   });
   if(!response.ok)throw new Error('SOOP '+response.status);
   const payload=await response.json(),channelNickname=await nicknameRequest,posts=normalize(payload,channelNickname);
   res.setHeader('Cache-Control',page===1?'public, max-age=0, s-maxage=20, stale-while-revalidate=30':'public, max-age=0, s-maxage=300, stale-while-revalidate=30');
   return res.status(200).json({posts,channelNickname,page,hasMore:Number(payload.meta?.totalPages)>page,totalPages:Number(payload.meta?.totalPages)||1,totalItems:Number(payload.meta?.totalItems)||posts.length,regularIds:payload.contents.map(row=>String(row.titleNo)),boardUrl:BOARD});
  }catch(error){console.error('[notices]',host,error.message)}
 }
 res.setHeader('Cache-Control','no-store');
 return res.status(502).json({error:'공지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',boardUrl:BOARD});
}
module.exports=handler;
module.exports.normalize=normalize;
