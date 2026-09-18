const CACHE_NAME='linuxaid-v8.1';
const APP_SHELL=['./','./index.html','./dashboard.html','./linux.html','./install.html','./labs.html','./tools.html','./profile.html','./auth.html','./community.html','./people.html','./messages.html','./rankings.html','./support.html','./offline.html','./404.html','./styles.css','./product.css','./product-v8.css','./ui-v8.1.css','./hero-motion.css','./mobile-v5.css','./visual-v5.css','./social-v7.css','./app.js','./config.js','./gemini.js','./backend.js','./favicon.svg','./manifest.webmanifest','./js/siteEnhancements.js','./js/v8Enhancements.js','./js/uiV81.js','./js/pageBasics.js','./js/navExtras.js','./js/heroMotion.js','./js/terminalEngine.js','./js/terminalEngineV8.js','./js/terminalDock.js','./js/commandCatalog.js','./js/security.js','./js/progress.js','./js/learningData.js','./js/linuxTools.js','./js/toolsPage.js','./js/profilePage.js','./js/profileSocialV7.js','./js/authPage.js','./js/authClientV5.js','./js/socialApi.js','./js/communityV7.js','./js/peoplePageV7.js','./js/messagesPageV7.js','./js/ranks.js','./js/rankingsPageV7.js'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME)
    .then(cache=>Promise.allSettled(APP_SHELL.map(url=>cache.add(url))))
    .then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});

async function networkFirst(request){
  try{
    const response=await fetch(request);
    if(response.ok){
      const cache=await caches.open(CACHE_NAME);
      cache.put(request,response.clone());
    }
    return response;
  }catch{
    return (await caches.match(request)) || (request.mode==='navigate' ? caches.match('./offline.html') : Response.error());
  }
}

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.pathname.includes('/api/')||url.hostname.includes('googleapis.com')||url.hostname.includes('firebase')||url.hostname.includes('supabase.co')||url.hostname.includes('posthog'))return;

  const sameOrigin=url.origin===self.location.origin;
  const freshAsset=sameOrigin && /\.(?:css|js|html)$/.test(url.pathname);
  if(request.mode==='navigate'||freshAsset){
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(caches.match(request).then(cached=>{
    const network=fetch(request).then(async response=>{
      if(response.ok&&sameOrigin){
        const cache=await caches.open(CACHE_NAME);
        cache.put(request,response.clone());
      }
      return response;
    }).catch(()=>cached);
    return cached||network;
  }));
});