const VERSION='twcheer-static-v37';
const STATIC_CACHE=`${VERSION}-assets`;
const RUNTIME_CACHE=`${VERSION}-runtime`;
const APP_SHELL=['./','./index.html','./css/app.css','./css/desktop.css','./css/mobile.css','./js/app.js','./js/data.js','./js/router.js','./js/ui.js','./js/utils.js','./js/storage.js','./js/girls.js','./js/events.js','./js/news.js','./js/schedules.js','./js/matches.js','./js/gacha.js','./js/vote.js','./js/pwa.js','./src/app/games.js','./src/assets/recognition/cheerleader-overlay.webp','./manifest.json','./app-icon.svg'];

self.addEventListener('install',(event)=>{ event.waitUntil(caches.open(STATIC_CACHE).then((cache)=>Promise.all(APP_SHELL.map((asset)=>cache.add(asset).catch(()=>null))))); });
self.addEventListener('activate',(event)=>{ event.waitUntil(caches.keys().then((keys)=>Promise.all(keys.filter((key)=>!key.startsWith(VERSION)).map((key)=>caches.delete(key)))).then(()=>self.clients.claim())); });
self.addEventListener('message',(event)=>{ if(event.data?.type==='SKIP_WAITING') self.skipWaiting(); });

function isDataRequest(url){ return url.hostname.includes('docs.google.com') || url.pathname.endsWith('.json') || url.hostname.includes('script.google.com') || url.hostname.includes('api.ipify.org'); }
function isStaticRequest(request,url){ return request.destination==='script'||request.destination==='style'||request.destination==='font'||request.destination==='image'||url.pathname.endsWith('.svg')||url.pathname.endsWith('.png')||url.pathname.endsWith('.jpg'); }
async function networkFirst(request){ try { const response=await fetch(request,{cache:'no-store'}); if(response.ok){ const cache=await caches.open(RUNTIME_CACHE); cache.put(request,response.clone()); } return response; } catch (_) { return caches.match(request).then((response)=>response||caches.match('./index.html')); } }
async function cacheFirst(request){ const cached=await caches.match(request); if(cached)return cached; const response=await fetch(request); if(response.ok){ const cache=await caches.open(STATIC_CACHE); cache.put(request,response.clone()); } return response; }
self.addEventListener('fetch',(event)=>{ const request=event.request; if(request.method!=='GET') return; const url=new URL(request.url); if(isDataRequest(url)||request.destination==='document') event.respondWith(networkFirst(request)); else if(url.origin===self.location.origin&&isStaticRequest(request,url)) event.respondWith(cacheFirst(request)); });

