function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}

function cleanImplementationLabels(){
  const replacements=[
    [/Supabase Auth/gi,'LinuxAid Account'],
    [/Supabase data/gi,'live data'],
    [/Supabase row-level security/gi,'member access controls'],
    [/Synced with Supabase/gi,'Synced securely'],
    [/Supabase profile/gi,'LinuxAid profile']
  ];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    let next=node.nodeValue;
    replacements.forEach(([pattern,value])=>{next=next.replace(pattern,value)});
    if(next!==node.nodeValue)node.nodeValue=next;
  });
}

function improveExternalLinks(){
  document.querySelectorAll('a[target="_blank"]').forEach(link=>{
    const rel=new Set(String(link.rel||'').split(/\s+/).filter(Boolean));
    rel.add('noopener');rel.add('noreferrer');
    link.rel=[...rel].join(' ');
  });
}

ready(()=>{
  cleanImplementationLabels();
  improveExternalLinks();
  document.documentElement.style.setProperty('--app-height',`${innerHeight}px`);
  addEventListener('resize',()=>document.documentElement.style.setProperty('--app-height',`${innerHeight}px`),{passive:true});
});
