const CACHE_NAME = 'linuxaid-v7';
const APP_SHELL = [
  './','./index.html','./dashboard.html','./linux.html','./labs.html','./tools.html','./rankings.html','./profile.html','./auth.html','./community.html','./offline.html','./404.html',
  './styles.css','./product.css','./hero-motion.css','./experience-v3.css','./deployment-v4.css','./mobile-v5.css',
  './config.js','./backend.js','./gemini.js','./favicon.svg','./manifest.webmanifest',
  './js/siteEnhancements.js','./js/pageBasics.js','./js/navExtras.js','./js/heroMotion.js','./js/terminalDock.js','./js/terminalEngine.js','./js/commandCatalog.js','./js/security.js','./js/progress.js','./js/ranks.js','./js/authV5.js','./js/communityPage.js','./js/profilePage.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>Promise.allSettled(APP_SHELL.map(url=>cache.add(url)))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

function isHostOrSubdomain(host,domain){return host===domain||host.endsWith(`.${domain}`);}
function shouldBypass(url){
  const host=url.hostname.toLowerCase();
  return url.pathname.startsWith('/api/') ||
    isHostOrSubdomain(host,'googleapis.com') ||
    isHostOrSubdomain(host,'firebaseio.com') ||
    isHostOrSubdomain(host,'firebaseapp.com') ||
    isHostOrSubdomain(host,'supabase.co') ||
    isHostOrSubdomain(host,'posthog.com') ||
    isHostOrSubdomain(host,'cloudflare.com');
}

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(shouldBypass(url))return;
  const freshFirst=request.mode==='navigate'||(url.origin===self.location.origin&&/\.(?:js|css|html|webmanifest)$/.test(url.pathname));
  if(freshFirst){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
      return response;
    }).catch(async()=> (await caches.match(request)) || (request.mode==='navigate' ? caches.match('./offline.html') : Response.error())));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok&&url.origin===self.location.origin){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
    return response;
  })));
});
