'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {collect,signature,summarize}=require('../elo-data.js');
const PAGE_SIZE=15;
function normalize(rows){
 if(!Array.isArray(rows)||rows.length>PAGE_SIZE)throw Error('응답 형식 오류');
 return rows.map(r=>{const me=r.participants?.find(p=>p.player_id===326),op=r.participants?.filter(p=>p.player_id!==326)||[];
 if(!Number.isSafeInteger(r.id)||!me||!op.length||!['win','loss'].includes(me.result)||!/^\d{4}-\d{2}-\d{2}$/.test(r.played_on))throw Error('경기 검증 실패');
 return{id:r.id,date:r.played_on,opponent:op.map(p=>p.name).join(' · '),opponentId:op.length===1?op[0].player_id:null,race:op.every(p=>p.race===op[0].race)?op[0].race:'M',win:me.result==='win',map:r.map_name||r.map_raw||'미등록',category:r.category||'other',event:r.event_name||'',format:r.format_raw||'',delta:Number.isFinite(r.elo_delta)?(me.result==='win'?1:-1)*Math.abs(r.elo_delta):null}});
}
async function upstream(offset){const url=new URL('https://eloboard.com/api/matches');url.search=new URLSearchParams({player_id:'326',limit:'15',offset:String(offset)});const r=await fetch(url,{headers:{Accept:'application/json','Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('ELO 응답 오류 '+r.status);return normalize(await r.json())}
async function update(old,fetchPage=upstream,{full=false}={}){
 if(!old?.complete||!Array.isArray(old.matches)||!old.matches.length||full){const next=await collect(fetchPage);if(!next.matches.length)throw Error('전체 수집 결과가 비어 있습니다.');return{...next,checkedAt:new Date().toISOString(),lastFullAt:new Date().toISOString(),syncMode:'full'}}
 const index=new Map(old.matches.map((r,i)=>[r.id,i]));let prefix=[],offset=0,boundary=-1;
 for(;;){const page=await fetchPage(offset);if(!page.length){boundary=old.matches.length-1;break}if(page.length>PAGE_SIZE)throw Error('페이지 크기 오류');prefix.push(...page);offset+=PAGE_SIZE;
 // At least 60 recent records are re-read, then stop at an existing boundary.
 if(prefix.length>=60&&index.has(page.at(-1).id)){boundary=index.get(page.at(-1).id);break}
 }
 if(!prefix.length)throw Error('최신 기록이 비어 있어 이전 데이터를 유지합니다.');
 if(new Set(prefix.map(r=>r.id)).size!==prefix.length)throw Error('수집 중 중복 기록');
 const head=await fetchPage(0);if(signature(prefix.slice(0,15))!==signature(head))throw Error('수집 중 최신 기록이 변경되었습니다.');
 const freshIds=new Set(prefix.map(r=>r.id));const matches=[...prefix,...old.matches.slice(boundary+1).filter(r=>!freshIds.has(r.id))];
 for(let i=1;i<matches.length;i++)if(matches[i].date>matches[i-1].date)throw Error('전적 정렬 오류');
 const changed=signature(matches)!==signature(old.matches),now=new Date().toISOString();
 return{...old,matches,summary:summarize(matches),complete:true,fetchedAt:changed?now:old.fetchedAt,checkedAt:now,lastFullAt:old.lastFullAt||old.fetchedAt,syncMode:'incremental'};
}
async function main(){let old=null;try{old=JSON.parse(await fs.readFile(process.env.ELO_PREVIOUS_FILE||'data/elo.json','utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
 const full=process.env.ELO_FULL_SYNC==='true'||(old?.lastFullAt&&Date.now()-new Date(old.lastFullAt).getTime()>7*86400000);
 const next=await update(old,upstream,{full});const output=process.env.ELO_OUTPUT_FILE||'data/elo.json';await fs.mkdir(path.dirname(output),{recursive:true});const temporary=output+'.tmp';await fs.writeFile(temporary,JSON.stringify(next));await fs.rename(temporary,output);console.log(next.syncMode+': '+next.matches.length+'경기, 검증 완료.');}
module.exports={update,normalize};if(require.main===module)main().catch(e=>{console.error('전적 갱신 실패:',e.message);process.exitCode=1});
