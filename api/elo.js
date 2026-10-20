'use strict';
const SOURCE='https://eloboard.com/players/326?tab=matches';
let cached=null,pending=null;
function arrayAt(text,start){let depth=0,quote=false,escape=false;for(let i=start;i<text.length;i++){const c=text[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false}else if(c==='"')quote=true;else if(c==='[')depth++;else if(c===']'&&!--depth)return JSON.parse(text.slice(start,i+1))}throw Error('경기 데이터가 완전하지 않습니다.')}
function parse(html){
 let flight='';for(const m of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/gs)){try{const p=JSON.parse(m[1]);if(p[0]===1)flight+=p[1]}catch{}}
 const marker=/"playerId":326,"initial":\s*(\[)/.exec(flight);if(!marker)throw Error('ELO 경기 데이터 형식을 확인할 수 없습니다.');
 const rows=arrayAt(flight,marker.index+marker[0].lastIndexOf('['));
 const matches=rows.map(r=>{const me=r.participants?.find(p=>p.player_id===326),op=r.participants?.find(p=>p.player_id!==326);if(!me||!op||!['win','loss'].includes(me.result)||!/^\d{4}-\d{2}-\d{2}$/.test(r.played_on))throw Error('경기 데이터 검증에 실패했습니다.');return{id:r.id,date:r.played_on,opponent:op.name,race:op.race,win:me.result==='win',map:r.map_name||r.map_raw||'미등록',category:r.category,event:r.event_name||'',format:r.format_raw||'',delta:typeof r.elo_delta==='number'?(me.result==='win'?1:-1)*Math.abs(r.elo_delta):null}});
 if(new Set(matches.map(m=>m.id)).size!==matches.length)throw Error('중복 경기 데이터가 있습니다.');
 const plain=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<!--.*?-->/gs,'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ');
 const h=/현재 ELO\s*([\d,]+)(?:\s*±\s*(\d+))?\s*경기\s*([\d,]+)\s*승\s*·\s*패\s*([\d,]+)\s*·\s*([\d,]+)\s*승률\s*([\d.]+)/.exec(plain);
 if(!h)throw Error('전체 전적을 확인할 수 없습니다.');const n=v=>Number(v.replaceAll(',',''));
 const summary={elo:n(h[1]),uncertainty:h[2]?n(h[2]):null,total:n(h[3]),wins:n(h[4]),losses:n(h[5]),rate:Number(h[6])};if(summary.total!==summary.wins+summary.losses)throw Error('전체 전적 합계가 일치하지 않습니다.');
 return{summary,matches,source:SOURCE,fetchedAt:new Date().toISOString(),scope:'source_initial',complete:matches.length===summary.total};
}
async function load(){const r=await fetch(SOURCE,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('ELO 조회 응답 오류 ('+r.status+')');const html=await r.text();if(html.length>6000000)throw Error('ELO 응답이 너무 큽니다.');return parse(html)}
async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET 요청만 지원합니다.'});
 try{if(!cached||Date.now()-cached.time>60000){if(!pending)pending=load().then(data=>(cached={data,time:Date.now()},data)).finally(()=>pending=null);await pending}
 res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');return res.status(200).json({...cached.data,stale:false})
 }catch(e){res.setHeader('Cache-Control','no-store');if(cached)return res.status(200).json({...cached.data,stale:true,error:'갱신하지 못해 마지막 정상 기록을 표시합니다.'});return res.status(502).json({error:'ELO에서 최신 기록을 가져오지 못했습니다. 마지막 저장 기록을 유지합니다.'})}
}
module.exports=handler;module.exports.parse=parse;
