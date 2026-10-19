'use strict';
function publicMedia(payload){
 const data=payload?.data;
 if(payload?.result!==1||!data||data.file_type!=='CLIP'||data.copyright?.user_id!=='tjgpdus97'||data.copyright?.del_flag==='Y'||Number(data.auth_no)!==101||Number(data.is_public)!==1||data.is_paid||data.is_ppv||Number(data.grade)!==0||Number(data.media_exception?.code)!==1)return null;
 const file=data.files?.find(f=>f.hide==='N'&&typeof f.file==='string');if(!file)return null;
 try{const url=new URL(file.file);if(url.protocol!=='https:'||!url.hostname.endsWith('.sooplive.com')||!url.pathname.endsWith('.m3u8'))return null;return {url:url.href}}catch(_){return null}
}
async function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 const id=String(req.query?.id??'');if(!/^\d{1,12}$/.test(id))return res.status(400).json({error:'Invalid clip'});
 try{
  const response=await fetch('https://api.m.sooplive.com/station/video/a/view',{method:'POST',body:new URLSearchParams({nTitleNo:id,nApiLevel:'11'}),headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0',Referer:'https://vod.sooplive.com/player/'+id},signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)throw Error('SOOP '+response.status);
  const media=publicMedia(await response.json());if(!media){res.setHeader('Cache-Control','no-store');return res.status(404).json({error:'공개 클립을 재생할 수 없습니다.'})}
  res.setHeader('Cache-Control','private, no-store');return res.status(200).json(media);
 }catch(error){console.error('[clip-media]',error.message);res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'영상 정보를 가져오지 못했습니다.'})}
}
module.exports=handler;module.exports.publicMedia=publicMedia;
