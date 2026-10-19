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
 Object.assign(box.style,{position:'fixed',right:'20px',bottom:'24px',width:'300px',maxWidth:'calc(100vw - 32px)',background:'#fffaff',color:'#594166',border:'1px solid #e3cfee',borderRadius:'12px',padding:'18px',zIndex:'2147483646',fontFamily:'Arial,"Noto Sans KR",sans-serif',boxShadow:'0 7px 26px #9976b026'});
 const top=document.createElement('div');Object.assign(top.style,{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'});
 const label=document.createElement('strong');label.textContent=p.count>1?'새 공지 '+p.count+'개':'새 공지가 등록되었습니다';label.style.fontSize='12px';
 const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','공지 알림 닫기');Object.assign(close.style,{border:'0',background:'transparent',color:'#aa87bf',fontSize:'24px',cursor:'pointer',lineHeight:'1',padding:'0 0 0 10px'});close.onclick=closeToast;top.append(label,close);
 const link=document.createElement('a');link.href=p.url;link.onclick=event=>{event.preventDefault();openNotice(p)};link.textContent=p.title;Object.assign(link.style,{display:'block',fontSize:'15px',fontWeight:'700',lineHeight:'1.5',color:'#594166',overflowWrap:'anywhere'});
 box.append(top,link);document.body.appendChild(box);
}
function isNoticeImage(value){
 try{const u=new URL(value);return u.protocol==='https:'&&['sooplive.com','sooplive.co.kr','afreecatv.com'].some(host=>u.hostname===host||u.hostname.endsWith('.'+host))}catch(_){return false}
}
function openNotice(post){
 let dialog=document.getElementById('noticeDetail');
 if(!dialog){
  const style=document.createElement('style');style.textContent=`
#noticeDetail{box-sizing:border-box;width:min(700px,calc(100vw - 28px));max-height:86vh;padding:0;border:1px solid #e5dbf4;border-radius:25px;background:#fffdfb;color:#40334e;box-shadow:0 18px 70px #69518a30;font-family:"Nanum Square Round","Noto Sans KR",Arial,sans-serif;overflow:auto}
#noticeDetail::backdrop{background:rgba(62,43,80,.3);backdrop-filter:blur(4px)}
#noticeDetail .detailTop{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;background:#f2eaff;padding:15px 23px;border-bottom:1px solid #e8dcf6;z-index:1}
#noticeDetail .detailLabel{font-size:12px;font-weight:800}
#noticeDetail .detailClose{border:1px solid #ded0ed;border-radius:50%;width:30px;height:30px;background:#fff;color:#80669d;font-size:22px;cursor:pointer;display:grid;place-items:center;line-height:1}
#noticeDetail .detailContent{padding:26px 28px 32px}
#noticeDetail h2{font-size:22px;line-height:1.5;margin:0 0 12px;overflow-wrap:anywhere}
#noticeDetail .detailMeta{font-size:11px;margin-bottom:26px;color:#93839f}
#noticeDetail .detailBody{font-size:15px;line-height:1.9;overflow-wrap:anywhere}
#noticeDetail .detailBody p{margin:0 0 12px}
#noticeDetail .detailBody img{display:block;max-width:100%;height:auto;margin:18px auto;border-radius:12px}
#noticeDetail .detailBody a{color:#8664ae;text-decoration:underline}
#noticeDetail .detailBody blockquote{margin:12px 0;padding-left:16px;border-left:2px solid #d4b9ed}
@media(max-width:500px){#noticeDetail .detailContent{padding:22px 20px}#noticeDetail h2{font-size:19px}}
`;document.head.appendChild(style);
  dialog=document.createElement('dialog');dialog.id='noticeDetail';dialog.setAttribute('aria-labelledby','noticeDetailTitle');
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
  document.body.appendChild(dialog);
 }
 dialog.replaceChildren();
 const top=document.createElement('div');top.className='detailTop';
 const label=document.createElement('span');label.className='detailLabel';label.textContent=post.author||'';
 const close=document.createElement('button');close.type='button';close.className='detailClose';close.textContent='×';close.setAttribute('aria-label','공지 닫기');close.onclick=()=>dialog.close();top.append(label,close);
 const content=document.createElement('article');content.className='detailContent';
 const title=document.createElement('h2');title.id='noticeDetailTitle';title.textContent=post.title;
 const meta=document.createElement('div');meta.className='detailMeta';meta.textContent=post.date||'';
 const body=document.createElement('div');body.className='detailBody';
 // Rebuild approved nodes rather than injecting third-party HTML.
 const source=new DOMParser().parseFromString(String(post.body||''),'text/html');
 const seen=new Set(),allowed=new Set(['P','BR','STRONG','B','EM','I','U','S','UL','OL','LI','BLOCKQUOTE','H2','H3']);
 function copy(node,parent){
  if(node.nodeType===3){parent.appendChild(document.createTextNode(node.textContent));return}
  if(node.nodeType!==1||['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','FORM','INPUT','BUTTON','SVG','MATH'].includes(node.tagName))return;
  if(node.tagName==='IMG'){
   const src=node.getAttribute('src');if(!isNoticeImage(src))return;
   const image=document.createElement('img');image.src=src;image.alt=node.getAttribute('alt')||'';image.loading='lazy';image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();seen.add(new URL(src).href);parent.appendChild(image);return;
  }
  let target=parent;
  if(allowed.has(node.tagName)){target=document.createElement(node.tagName.toLowerCase());parent.appendChild(target)}
  else if(node.tagName==='A'){
   try{const u=new URL(node.getAttribute('href'));if(['https:','http:'].includes(u.protocol)){target=document.createElement('a');target.href=u.href;target.target='_blank';target.rel='noopener noreferrer';parent.appendChild(target)}}catch(_){}
  }
  for(const child of node.childNodes)copy(child,target);
 }
 for(const child of source.body.childNodes)copy(child,body);
 if(!body.textContent.trim()&&!body.querySelector('img'))body.textContent=post.summary||'본문 내용이 없습니다.';
 for(const src of Array.isArray(post.photos)?post.photos:[]){
  if(!isNoticeImage(src)||seen.has(new URL(src).href))continue;
  const image=document.createElement('img');image.src=src;image.alt='공지 사진';image.loading='lazy';image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();body.appendChild(image);
 }
 content.append(title,meta,body);dialog.append(top,content);dialog.scrollTop=0;
 if(!dialog.open)dialog.showModal();
}
function render(){
 if(!list)return;list.replaceChildren();
 for(const p of posts){
  const li=document.createElement('li'),a=document.createElement('a'),body=document.createElement('div'),title=document.createElement('h2'),meta=document.createElement('div');
  a.href='#notice-'+p.id;a.onclick=event=>{event.preventDefault();openNotice(p)};a.className='noticeCard';
  if(p.thumbnail){
   try{
    const url=new URL(p.thumbnail);
    if(url.protocol==='https:'&&['sooplive.com','sooplive.co.kr','afreecatv.com'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host))){
     const wrap=document.createElement('div'),img=document.createElement('img');wrap.className='noticePhoto';img.src=url.href;img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>wrap.remove();wrap.appendChild(img);a.appendChild(wrap);
    }
   }catch(_){}
  }
  body.className='noticeBody';
  const badge=document.createElement('span');badge.className='noticeBadge';badge.textContent=p.author||'';
  title.className='title';title.textContent=p.title;
  body.append(badge,title);
  if(p.summary){const preview=document.createElement('p');preview.className='preview';preview.textContent=p.summary;body.appendChild(preview)}
  meta.className='meta';
  const date=document.createElement('time');date.textContent=String(p.date||'').slice(0,10).replaceAll('-','.');
  const arrow=document.createElement('span');arrow.className='cardArrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
  meta.append(date,arrow);body.appendChild(meta);a.appendChild(body);li.appendChild(a);list.appendChild(li);
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
  if(data.channelNickname){
   const detailLabel=document.querySelector('#noticeDetail .detailLabel');
   if(detailLabel)detailLabel.textContent=data.channelNickname;
  }
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
  render();if(status){status.textContent=posts.length?'':'아직 등록된 공지가 없어요.';status.hidden=posts.length>0}
 }catch(_){if(status){status.hidden=false;status.textContent='공지를 불러오지 못했어요. 잠시 후 다시 확인할게요.'}}
 finally{busy=false;if(refreshButton)refreshButton.disabled=false;if(moreButton)moreButton.disabled=false}
}
document.getElementById('noticeRefresh')?.addEventListener('click',()=>refresh());
moreButton?.addEventListener('click',()=>refresh(true));
window.addEventListener('storage',event=>{if(event.key!==KEY)return;try{state=JSON.parse(event.newValue)||{latest:0,pending:null};toast()}catch(_){}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
toast();refresh();setInterval(()=>{if(!document.hidden)refresh()},30000);
})();
