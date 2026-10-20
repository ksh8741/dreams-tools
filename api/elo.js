'use strict';
const PAGE_SIZE=15,SOURCE='https://eloboard.com/api/matches';
function normalize(rows){
 if(!Array.isArray(rows)||rows.length>PAGE_SIZE)throw Error('응답 형식 오류');
 return rows.map(r=>{const me=r.participants?.find(p=>p.player_id===326),op=r.participants?.filter(p=>p.player_id!==326)||[];
 if(!Number.isSafeInteger(r.id)||!me||!op.length||!['win','loss'].includes(me.result)||!/^\d{4}-\d{2}-\d{2}$/.test(r.played_on))throw Error('경기 검증 실패');
 return{id:r.id,date:r.played_on,opponent:op.map(p=>p.name).join(' · '),opponentId:op.length===1?op[0].player_id:null,race:op.every(p=>p.race===op[0].race)?op[0].race:'M',win:me.result==='win',map:r.map_name||r.map_raw||'미등록',category:r.category||'other',event:r.event_name||'',format:r.format_raw||'',delta:Number.isFinite(r.elo_delta)?(me.result==='win'?1:-1)*Math.abs(r.elo_delta):null}});
}
async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET 요청만 지원합니다.'});
 const raw=req.query?.offset??'0';if(typeof raw!=='string'||!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)))return res.status(400).json({error:'올바른 offset이 필요합니다.'});
 const offset=Number(raw);try{const url=new URL(SOURCE);url.search=new URLSearchParams({player_id:'326',limit:String(PAGE_SIZE),offset:String(offset)}).toString();const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('upstream '+response.status);const text=await response.text();if(text.length>1500000)throw Error('응답 크기 오류');const matches=normalize(JSON.parse(text));
 res.setHeader('Cache-Control',offset===0?'public, s-maxage=30':'public, s-maxage=60');return res.status(200).json({offset,pageSize:PAGE_SIZE,matches,fetchedAt:new Date().toISOString()});
 }catch(e){console.error('ELO page fetch failed',offset,e.message);res.setHeader('Cache-Control','no-store');return res.status(502).json({error:'ELO 경기 조회에 실패했습니다. 마지막 완전한 기록을 유지합니다.'})}
}
module.exports=handler;module.exports.normalize=normalize;
