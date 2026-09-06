/** Targeted regression tests against the submitted modules. These are NOT full-site E2E tests.
 * Navigation DOM/history/legacy setter are minimal simulations of baseline behavior.
 * Sources are loaded unchanged, with test-only exports for navigation entrypoints.
 * Run from repo: node --experimental-vm-modules --test tests/review/pwa-foundation-regressions.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=process.env.CHEER_REVIEW_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read=p=>fs.readFile(path.join(root,p),'utf8');
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};};
const {fetchWithLastSuccess}=await import(path.join(root,'src/services/resilient-cache.js'));
class MockEvent { constructor(type,options={}){this.type=type;this.bubbles=!!options.bubbles;} }
async function navigationFixture(initial='events') {
  const elements=new Map();
  const body={dataset:{},classList:{toggle(){}},append(node){elements.set(node.id,node);}};
  function element(tag='div') {
    const node={tagName:tag.toUpperCase(),style:{},children:[],hidden:false,attrs:{},
      setAttribute(k,v){this.attrs[k]=v;},toggleAttribute(){},addEventListener(){},dispatchEvent(){return true;},closest(){return null;},
      append(child){this.children.push(child);elements.set(child.id,child);},
      prepend(child){this.children.unshift(child);elements.set(child.id,child);}};
    return node;
  }
  const main=element('main');elements.set('main-content',main);
  const search=element('input'); search.value=''; search.id='searchInput'; elements.set('searchInput',search);
  const ids={girls:'grid-container',events:'event-container',news:'news-container',passport:'passport-container',games:'games-container',schedule:'schedule-container',matches:'matches-container'};
  for(const id of Object.values(ids)){const n=element();n.id=id;main.append(n);}
  const document={body,createElement:element,
    querySelector:sel=>elements.get(sel.slice(1)),
    querySelectorAll:sel=>sel.startsWith('#main-content > div')?main.children.filter(n=>n.tagName==='DIV'&&n.id!=='schedule-section-switcher'):[]};
  const location={href:'https://example.invalid/TWCcheerleader/?mode='+initial};
  const events={}; const sessionStorage=memory();
  const history={replaceState(state,title,url){location.href=new URL(url,location.href).href;},pushState(state,title,url){location.href=new URL(url,location.href).href;}};
  const state={mode:initial,data:[],rendered:null,calls:0,schedule:null};
  function legacySetMode(mode) {
    state.mode=mode;state.calls++;
    sessionStorage.setItem('cheer_current_tab',mode);
    const parsed=new URL(location.href);
    history.replaceState({},'',parsed.origin+parsed.pathname+'?mode='+mode);
    search.value='';
    if (mode==='schedule') state.schedule=null;
    for(const id of Object.values(ids))elements.get(id).style.display='none';
    if(ids[mode])elements.get(ids[mode]).style.display='block';
    state.rendered=state.data.length;
  }
  function selectScheduleTeam(team,sport){state.schedule={team,sport};}
  function backToScheduleSelection(){state.schedule=null;}
  const window={setMode:legacySetMode,selectScheduleTeam,backToScheduleSelection,history,addEventListener:(event,fn)=>events[event]=fn};
  const context=vm.createContext({window,document,location,sessionStorage,URL,Map,Set,Object,console,Event:MockEvent,scrollY:0,
    requestAnimationFrame:fn=>fn(),scrollTo:()=>{}});
  const config=new vm.SourceTextModule(await read('src/app/navigation-config.js'),{context});
  const nav=new vm.SourceTextModule((await read('src/app/navigation.js'))+'\nexport {navigate,applyMode};',{context});
  await nav.link(specifier=>{assert.equal(specifier,'./navigation-config.js');return config;});
  await nav.evaluate(); events.DOMContentLoaded();
  return {nav:nav.namespace,state,elements,body,location,sessionStorage,search,window};
}
test('NAV-01: data-ready initialization must re-render the active route',async()=>{
  const f=await navigationFixture();
  f.state.data=[{id:1}];
  f.window.setMode('events');
  assert.equal(f.state.rendered,1,'model has 1 record but current UI remains at 0');
});
test('NAV-02: My UI, URL and persisted destination must agree',async()=>{
  const f=await navigationFixture();f.nav.navigate('my');
  assert.equal(new URL(f.location.href).searchParams.get('mode'),'my');
  assert.equal(f.sessionStorage.getItem('cheer_current_tab'),'my');
});
test('NAV-03: hub must be hidden when leaving My for Girls',async()=>{
  const f=await navigationFixture();f.nav.navigate('my');f.nav.navigate('girls');
  const hub=f.elements.get('navigation-hub');
  assert.ok(hub.hidden||hub.style.display==='none','hub remains display:block on Girls');
});
test('NAV-04: search must survive switching main sections',async()=>{
  const f=await navigationFixture('girls');f.search.value='saved-filter';f.nav.navigate('events');f.nav.navigate('girls');
  assert.equal(f.search.value,'saved-filter');
});
test('NAV-05: More UI and URL must agree',async()=>{
  const f=await navigationFixture();f.nav.navigate('more');
  assert.equal(new URL(f.location.href).searchParams.get('mode'),'more');
});
test('NAV-06: schedule selection must survive switching primary sections',async()=>{
  const f=await navigationFixture('schedule');
  f.window.selectScheduleTeam('Team A','棒球');
  f.nav.navigate('events');
  f.nav.navigate('schedule');
  assert.deepEqual(f.state.schedule,{team:'Team A',sport:'棒球'});
});
test('DATA-01: quota error must not discard freshly fetched valid data',async()=>{
  const storage={getItem:()=>null,setItem(){throw new Error('QuotaExceededError');}};
  const result=await fetchWithLastSuccess('feed',async()=>[1,2],storage);
  assert.deepEqual(result.data,[1,2]);
});
test('STORAGE-01: inaccessible localStorage getter must not crash readArray',async()=>{
  const window={};Object.defineProperty(window,'localStorage',{get(){throw new Error('SecurityError');}});
  vm.runInNewContext(await read('src/storage/legacy-storage.js'),{window});
  assert.doesNotThrow(()=>window.CheerStorage.readArray('cheer_favorites'));
});
test('PWA-01: first install controllerchange should not force an unrequested reload',async()=>{
  const handlers={};let reloads=0;
  const serviceWorker={controller:null,addEventListener:(event,fn)=>handlers[event]=fn};
  const navigator={serviceWorker};
  const window={navigator,addEventListener(){},matchMedia:()=>({matches:false})};
  vm.runInNewContext(await read('pwa.js'),{window,navigator,document:{},location:{reload(){reloads++;}},console});
  handlers.controllerchange();
  assert.equal(reloads,0);
});
test('SW-01: clone cache response before async cache opening/body consumption',async()=>{
  const listeners={};let resolveOpen;
  const opened=new Promise(resolve=>resolveOpen=resolve);
  const response=new Response('network data');
  const self={location:{origin:'https://example.invalid'},addEventListener:(type,fn)=>listeners[type]=fn};
  const caches={open:()=>opened,match:async()=>undefined};
  vm.runInNewContext(await read('sw.js'),{self,caches,URL,Response,fetch:async()=>response});
  const waits=[];let task;
  listeners.fetch({request:{method:'GET',url:'https://example.invalid/TWCcheerleader/',cache:'default',mode:'navigate'},
    respondWith(promise){task=promise;},waitUntil(promise){waits.push(promise.catch(error=>({error:error.message})));}});
  const result=await task;await result.text();
  resolveOpen({put:async()=>undefined});
  const outcomes=await Promise.all(waits);
  assert.ok(outcomes.every(item=>!item?.error),JSON.stringify(outcomes));
});
