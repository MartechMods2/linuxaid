const CACHE_NAME='linuxaid-v6';
const APP_SHELL=[
  './','./index.html','./dashboard.html','./linux.html','./labs.html','./tools.html','./profile.html','./auth.html',
  './community.html','./people.html','./messages.html','./notifications.html','./rankings.html','./offline.html','./404.html',
  './styles.css','./product.css','./hero-motion.css','./app-v6.css','./config.js','./backend.js','./gemini.js','./favicon.svg','./manifest.webmanifest',
  './js/siteEnhancementsV6.js','./js/pageBasics.js','./js/heroMotion.js','./js/terminalDock.js','./js/terminalEngine.js','./js/commandCatalog.js',
  './js/security.js','./js/progress.js','./js/learningData.js','./js/learningPages.js','./js/linuxTools.js','./js/toolsPage.js','./js/profilePage.js',
  './js/authPage.js','./js/communityPage.js','./js/peoplePage.js','./js/messagesPage.js','./js/notificationsPage.js','./js/ranks.js','./js/analytics.js','./js/consent.js','./js/sync.js','./js/brand.js'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>Promise.allSettled(APP_SHELL.map(url=>cache.add(url)))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

function isBackend(url){return url.pathname.includes('/api/')||url.hostname.includes('supabase.co')||url.hostname.includes('googleapis.com')||url.hostname.includes('posthog.com')||url.hostname.includes('i.posthog.com')||url.hostname.includes('challenges.cloudflare.com');}

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(isBackend(url))return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}return response;}).catch(async()=>await caches.match(request)||await caches.match('./offline.html')));return;
  }
  if(url.origin!==self.location.origin)return;
  event.respondWith(caches.match(request).then(cached=>{
    const network=fetch(request).then(response=>{if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put(request,response.clone()));return response;}).catch(()=>cached);
    return cached||network;
  }));
});
