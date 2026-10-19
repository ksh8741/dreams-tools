(()=>{
'use strict';
const feed=document.getElementById('clipFeed'),status=document.getElementById('clipStatus'),counter=document.getElementById('clipCounter');
const prev=document.getElementById('clipPrev'),next=document.getElementById('clipNext'),ORIGIN='https://vod.sooplive.com';
let clips=[],page=0,hasMore=true,loading=false,active=-1,frame=null,ready=false,currentTime=0,raf=0;
function say(text){status.textContent=text;status.hidden=!text}
function valid(c){return c&&/^\d+$/.test(c.id)&&typeof c.title==='string'}
function command(data){if(frame?.contentWindow)frame.contentWindow.postMessage(data,ORIGIN)}
function configure(){
 const clip=clips[active];if(!ready||!clip)return;
 command({cmd:'Pload',id:clip.id,no:null,mutePlay:true,showChat:false,autoPlay:!document.hidden,isAdShow:true,isAdPause:false,isViewCnt:true,isRecommendShow:false,isEndRecommendShow:false,showQualityBox:true,startVideoSeconds:currentTime,endVideoSeconds:0,fromApi:1,apiKey:''});
}
function updateProgress(){
 const bar=feed.children[active]?.querySelector('.clipProgress');
 if(!bar)return;
 const duration=Number(clips[active]?.duration)||0;
 const ratio=duration>0?Math.max(0,Math.min(1,currentTime/duration)):0;
 bar.querySelector('.clipProgressFill').style.transform='scaleX('+ratio+')';
 bar.setAttribute('aria-valuenow',String(Math.round(ratio*100)));
}
function activate(index){
 if(index<0||index>=clips.length||index===active&&frame)return;
 // Removing the old iframe tears down its player and stops all audio.
 if(frame){frame.remove();frame=null}
 active=index;ready=false;currentTime=0;updateProgress();
 const slide=feed.children[index],clip=clips[index];
 frame=document.createElement('iframe');frame.className='clipPlayer';frame.title=clip.title;frame.allow='autoplay; fullscreen; encrypted-media; picture-in-picture';frame.allowFullscreen=true;
 frame.src=ORIGIN+'/player/'+clip.id+'/embed?fromApi=1';slide.querySelector('.clipStage').appendChild(frame);
 prev.disabled=index===0;next.disabled=index===clips.length-1&&!hasMore;counter.textContent=(index+1)+' / '+clips.length+(hasMore?' +':'');
 if(index>=clips.length-4)loadMore();
}
async function move(direction){
 let index=active+direction;
 if(index>=clips.length&&hasMore){await loadMore();index=active+direction}
 if(index<0||index>=clips.length)return;
 feed.children[index].scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
}
function renderNew(items){
 for(const clip of items){
  const section=document.createElement('section');section.className='clipSlide';section.setAttribute('aria-label',clip.title);
  const card=document.createElement('article');card.className='clipCard';
  const stage=document.createElement('div');stage.className='clipStage';
  if(clip.thumbnail){const poster=document.createElement('img');poster.className='clipPoster';poster.alt='';poster.loading='lazy';poster.src=clip.thumbnail;stage.appendChild(poster)}
  const progress=document.createElement('div');progress.className='clipProgress';
  progress.setAttribute('role','progressbar');progress.setAttribute('aria-label','영상 재생 진행률');progress.setAttribute('aria-valuemin','0');progress.setAttribute('aria-valuemax','100');progress.setAttribute('aria-valuenow','0');
  const fill=document.createElement('div');fill.className='clipProgressFill';progress.appendChild(fill);
  const meta=document.createElement('div');meta.className='clipMeta';const info=document.createElement('div');info.className='clipInfo';
  const title=document.createElement('h2');title.textContent=clip.title;const detail=document.createElement('p');detail.textContent=[clip.author,clip.date.slice(0,10),Number(clip.views).toLocaleString('ko-KR')+'회'].filter(Boolean).join(' · ');info.append(title,detail);
  meta.appendChild(info);card.append(stage,progress,meta);section.appendChild(card);feed.appendChild(section);
 }
}
async function loadMore(){
 if(loading||!hasMore)return;loading=true;
 try{
  const response=await fetch('/api/clips?page='+(page+1),{signal:AbortSignal.timeout(18000)});
  if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();
  if(!Array.isArray(data.clips)||!data.clips.every(valid))throw Error('Invalid clip response');
  const ids=new Set(clips.map(c=>c.id)),added=data.clips.filter(c=>{if(ids.has(c.id))return false;ids.add(c.id);return true});clips.push(...added);page=data.page;hasMore=!!data.hasMore;
  renderNew(added);say(clips.length?'':'등록된 클립이 없습니다.');
  if(active<0&&clips.length)activate(0);
  if(active>=0){next.disabled=active===clips.length-1&&!hasMore;counter.textContent=(active+1)+' / '+clips.length+(hasMore?' +':'')}
 }catch(_){say('클립을 불러오지 못했습니다. 눌러서 다시 시도해주세요.');status.onclick=()=>{say('클립을 불러오는 중입니다.');loadMore()}}
 finally{loading=false}
}
feed.addEventListener('scroll',()=>{
 if(raf)return;raf=requestAnimationFrame(()=>{raf=0;if(feed.clientHeight)activate(Math.max(0,Math.min(clips.length-1,Math.round(feed.scrollTop/feed.clientHeight))))});
},{passive:true});
prev.onclick=()=>move(-1);next.onclick=()=>move(1);
window.addEventListener('keydown',event=>{
 if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)||event.altKey||event.ctrlKey||event.metaKey)return;
 if(['ArrowDown','PageDown','ArrowUp','PageUp'].includes(event.key)){event.preventDefault();move(['ArrowDown','PageDown'].includes(event.key)?1:-1)}
});
window.addEventListener('message',event=>{
 if(event.origin!==ORIGIN||event.source!==frame?.contentWindow||!event.data||typeof event.data!=='object')return;
 const data=event.data;
 if(data.cmd==='PonReady'&&!ready){ready=true;configure()}
 if(data.cmd==='PupdateMediaEvent'){
  const media=data.event||{};
  if(media.type==='timeUpdate'&&Number.isFinite(media.currentTime)){currentTime=media.currentTime;updateProgress()}
  if(media.type==='end'){currentTime=Number(clips[active]?.duration)||0;updateProgress()}
 }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){command({cmd:'Ppause'})}});
window.addEventListener('pagehide',()=>{if(frame){frame.remove();frame=null}});
loadMore();
})();
