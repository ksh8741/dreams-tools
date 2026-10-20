'use strict';
// One public snapshot for every visitor. Never crawls ELO during a page request.
const SNAPSHOT='https://raw.githubusercontent.com/ksh8741/dreams-tools/elo-data/data/elo.json';
module.exports=async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'GET 요청만 지원합니다.'});
 try{const r=await fetch(SNAPSHOT,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('공용 기록 응답 '+r.status);const text=await r.text();if(text.length>4000000)throw Error('공용 기록 크기 초과');const d=JSON.parse(text);
 if(!d.complete||!Array.isArray(d.matches)||!d.matches.length||d.summary?.total!==d.matches.length)throw Error('공용 기록 검증 실패');
 res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=300');return res.status(200).json(d);
 }catch(e){console.error('Shared ELO snapshot:',e.message);res.setHeader('Cache-Control','no-store');return res.status(503).json({error:'공용 전적이 아직 준비되지 않았거나 조회에 실패했습니다. GitHub Actions 수집 상태를 확인해주세요.'})}
};
