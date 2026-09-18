function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}

ready(()=>{
  const back=document.getElementById('backToTop');
  back?.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));
  addEventListener('scroll',()=>back?.classList.toggle('show',scrollY>320),{passive:true});

  // Hide inherited mock admin content until a real role-protected admin product exists.
  document.querySelectorAll('.admin-shell').forEach(section=>{
    section.hidden=true;
    section.setAttribute('aria-hidden','true');
  });
});
