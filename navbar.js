(()=>{
  const nav=document.getElementById("global-navbar");
  if(!nav)return;
  const file=(location.pathname.split("/").pop()||"index.html").toLowerCase();
  if(file==="pubg.html"){
    nav.querySelector('[data-page="pubg"]')?.classList.add("active");
  }
})();