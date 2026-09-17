// LinuxAid public runtime configuration. Browser-safe identifiers only.
(() => {
  if (!document.querySelector('link[data-linuxaid-v6]')) {
    const link=document.createElement('link');link.rel='stylesheet';link.href='app-v6.css';link.dataset.linuxaidV6='1';document.head.appendChild(link);
  }
})();

window.LINUXAID_CONFIG={
  backendProvider:'supabase',
  backend:{provider:'supabase',supabase:{url:'https://qkpamdanjnxniwdinodi.supabase.co',publishableKey:'sb_publishable_wTI5I06u46jE2DcCpelhYw_n6VYNps6',anonKey:''},firebase:null},
  auth:{emailEnabled:true,googleEnabled:true,magicLinkEnabled:true,requireEmailVerification:true,providerLabel:'Supabase Auth'},
  security:{turnstileSiteKey:'0x4AAAAAAE6PU0UdSo50KwA_',authTimeoutMs:15000,requestTimeoutMs:18000,maxAuthAttemptsPerWindow:6,authAttemptWindowMs:10*60*1000},
  ai:{proxyUrl:'',edgeFunction:'linuxaid-ai',provider:'server',allowInsecureBrowserAI:false,requestTimeoutMs:25000},
  social:{feedPageSize:30,messagePageSize:80,realtime:true,maxPostLength:8000,maxMessageLength:4000},
  analytics:{provider:'posthog',posthogKey:'phc_kWsQD4Tvvy4ubUm8KiQ73wG6TTKnNpHAa5AJ4AKNFrki',posthogHost:'https://us.i.posthog.com',sessionReplay:false,respectDoNotTrack:true},
  product:{name:'LinuxAid',repository:'https://github.com/MartechMods2/linuxaid',website:'https://martechmods2.github.io/linuxaid/'}
};
window.LINUXAID_CONFIG.firebase=null;

Promise.all([
  import('./js/pageBasics.js'),
  import('./js/siteEnhancementsV6.js'),
  import('./js/analytics.js'),
  import('./js/sync.js'),
  import('./js/consent.js'),
  import('./js/terminalDock.js'),
  import('./js/brand.js')
]).then(modules=>{
  modules[6]?.applyLinuxAidBranding?.();
  document.querySelectorAll('[data-rank-panel]').forEach(async node=>{
    const[{renderRankPanel},{getProgressSummary}]=await Promise.all([import('./js/ranks.js'),import('./js/progress.js')]);renderRankPanel(node,getProgressSummary());
  });
  document.querySelectorAll('[data-open-terminal],#openTerminalPrimary').forEach(button=>button.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('linuxaid:open-terminal'))));
}).catch(error=>console.warn('LinuxAid shared runtime could not be loaded:',error));
