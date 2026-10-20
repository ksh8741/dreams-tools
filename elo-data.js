(function(root){'use strict';
const SIZE=15;
function signature(rows){return JSON.stringify(rows)}
function summarize(matches){const wins=matches.filter(m=>m.win).length;return{total:matches.length,wins,losses:matches.length-wins,rate:matches.length?Number((wins/matches.length*100).toFixed(1)):0}}
async function collect(fetchPage,onProgress=()=>{}){
 const first=await fetchPage(0);if(!Array.isArray(first)||first.length>SIZE)throw Error('첫 페이지 형식 오류');
 let all=[...first],seen=new Set(first.map(m=>m.id)),offset=SIZE,done=first.length===0;if(seen.size!==first.length)throw Error('중복 경기 응답');onProgress(all.length);
 while(!done){const offsets=Array.from({length:4},(_,i)=>offset+i*SIZE),pages=await Promise.all(offsets.map(fetchPage));
 for(const rows of pages){if(!Array.isArray(rows)||rows.length>SIZE)throw Error('페이지 형식 오류');if(!rows.length){done=true;break}for(const r of rows){if(seen.has(r.id))throw Error('중복 경기 또는 조회 중 순서 변경');seen.add(r.id)}all.push(...rows);onProgress(all.length)}offset+=SIZE*4;
 }
 if(new Set(all.map(m=>m.id)).size!==all.length)throw Error('조회 중 기록 순서가 바뀌었습니다. 다시 확인해주세요.');
 const check=await fetchPage(0,true);if(signature(first)!==signature(check))throw Error('조회 중 새 경기 또는 수정이 발생했습니다. 다시 확인해주세요.');
 for(let i=1;i<all.length;i++)if(all[i].date>all[i-1].date)throw Error('경기 정렬 검증에 실패했습니다.');
 return{summary:summarize(all),matches:all,complete:true,source:'https://eloboard.com/players/326?tab=matches',fetchedAt:new Date().toISOString()};
}
const api={collect,signature,summarize};if(typeof module!=='undefined')module.exports=api;else root.EloData=api;
})(typeof window!=='undefined'?window:this);
