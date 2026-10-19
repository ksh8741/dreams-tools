(()=>{
'use strict';
if(window.__yoningNotices)return;window.__yoningNotices=true;
if(new URLSearchParams(location.search).has('overlay'))return;
const KEY='yoning_notices_v1',API=new URL('api/notices',document.currentScript.src).href;
let state={latest:0,pending:null},busy=false,page=1,posts=[],more=false,loaded=false;
try{Object.assign(state,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(_){}
const list=document.getElementById('noticeList'),status=document.getElementById('noticeStatus'),moreButton=document.getElementById('noticeMore');
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(_){}};
function validPost(p){return p&&/^\d+$/.test(String(p.id))&&typeof p.title==='string'&&p.url==='https://www.sooplive.com/station/tjgpdus97/post/'+p.id}
function closeToast(){state.pending=null;save();document.getElementById('yoningNoticeToast')?.remove()}
function toast(){
 document.getElementById('yoningNoticeToast')?.remove();
 const p=state.pending;if(!validPost(p))return;
 const box=document.createElement('aside');box.id='yoningNoticeToast';box.setAttribute('role','status');
 Object.assign(box.style,{position:'fixed',right:'20px',bottom:'24px',width:'300px',maxWidth:'calc(100vw - 32px)',background:'#fff',color:'#000',border:'2px solid #000',borderRadius:'12px',padding:'18px',zIndex:'2147483646',fontFamily:'Arial,"Noto Sans KR",sans-serif',boxShadow:'0 4px 12px #0001'});
 const top=document.createElement('div');Object.assign(top.style,{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'});
 const label=document.createElement('strong');label.textContent=p.count>1?'새 공지 '+p.count+'개':'새 공지가 등록되었습니다';label.style.fontSize='12px';
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','공지 알림 닫기');Object.assign(close.style,{border:'0',background:'#fff',color:'#000',fontSize:'24px',cursor:'pointer',lineHeight:'1',padding:'0 0 0 10px'});close.onclick=closeToast;top.append(label,close);
 const link=document.createElement('a');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=p.title;Object.assign(link.style,{display:'block',fontSize:'15px',fontWeight:'700',lineHeight:'1.5',color:'#000',overflowWrap:'anywhere'});
 box.append(top,link);document.body.appendChild(box);
}
function render(){
 if(!list)return;list.replaceChildren();
 for(const p of posts){
  const li=document.createElement('li'),a=document.createElement('a'),title=document.createElement('div'),meta=document.createElement('div');
  a.href=p.url;a.target='_blank';a.rel='noopener noreferrer';title.className='title';title.textContent=p.title;meta.className='meta';meta.textContent=[p.date,p.author].filter(Boolean).join(' · ');a.append(title,meta);li.appendChild(a);list.appendChild(li);
 }
 if(moreButton)moreButton.hidden=!more;
}
async function refresh(append=false){
 if(busy)return;busy=true;
 const refreshButton=document.getElementById('noticeRefresh');
 if(refreshButton)refreshButton.disabled=true;if(moreButton)moreButton.disabled=true;
 try{
  const requestedPage=append?page+1:1;
  const response=await fetch(API+'?page='+requestedPage,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();if(!Array.isArray(data.posts)||!data.posts.every(validPost))throw Error('Invalid notice response');
  const incoming=data.posts;
  if(!append){
   // First successful visit establishes the baseline; old posts never notify.
   const latest=incoming.reduce((m,p)=>Math.max(m,Number(p.id)),0);
   if(state.latest>0){
    const added=incoming.filter(p=>Number(p.id)>state.latest);
    if(added.length){state.pending={...added[0],count:added.length};toast()}
   }
   state.latest=Math.max(state.latest,latest);save();
   const byId=new Map((loaded?posts:[]).map(p=>[p.id,p]));
   // Refresh the loaded range too, so removed/edited top-page posts update.
   if(loaded){const floor=incoming.length?Math.min(...incoming.map(p=>Number(p.id))):Infinity;for(const id of byId.keys())if(Number(id)>=floor)byId.delete(id)}
   incoming.forEach(p=>byId.set(p.id,p));posts=[...byId.values()].sort((a,b)=>Number(b.id)-Number(a.id));
   if(!loaded){page=1;more=!!data.hasMore}loaded=true;
  }else{
   const byId=new Map(posts.map(p=>[p.id,p]));incoming.forEach(p=>byId.set(p.id,p));posts=[...byId.values()].sort((a,b)=>Number(b.id)-Number(a.id));page=requestedPage;more=!!data.hasMore;
  }
  render();if(status)status.textContent=posts.length?'최근 확인 '+new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' · 30초마다 자동 갱신':'등록된 공지가 없습니다.';
 }catch(_){if(status)status.textContent='공지를 불러오지 못했습니다. 잠시 후 다시 시도하거나 SOOP 원문을 확인해주세요.'}
 finally{busy=false;if(refreshButton)refreshButton.disabled=false;if(moreButton)moreButton.disabled=false}
}
document.getElementById('noticeRefresh')?.addEventListener('click',()=>refresh());
moreButton?.addEventListener('click',()=>refresh(true));
window.addEventListener('storage',event=>{if(event.key!==KEY)return;try{state=JSON.parse(event.newValue)||{latest:0,pending:null};toast()}catch(_){}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
toast();refresh();setInterval(()=>{if(!document.hidden)refresh()},30000);
})();
