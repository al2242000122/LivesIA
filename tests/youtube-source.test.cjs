const test=require('node:test'),assert=require('node:assert/strict');
const Events=require('../integrations/events.js'), Config=require('../games/block-wars/config.js');
const {createEngine}=require('../games/block-wars/engine.js'),{createRules}=require('../games/block-wars/rules.js'),{createExperience}=require('../games/block-wars/experience.js');
const wire=(text='TNT')=>({type:'comment',source:'youtube',id:'yt:'+'a'.repeat(32),receivedAt:1,actor:{displayName:'Ana',stableHash:'b'.repeat(32)},data:{text}});
test('strict YouTube adapter preserves opaque identity and rejects extra fields or fake rewards',()=>{const a=Events.createAdapter();assert.deepEqual(a.normalizeYouTube(wire()),wire());assert.equal(a.normalizeYouTube(wire()),null);for(const patch of [{type:'like'},{paid:true},{actor:{displayName:'Ana',stableHash:'x'}}])assert.equal(a.normalizeYouTube({...wire(),...patch}),null);assert.equal(a.normalize(wire(),'youtube'),null);});
test('all fourteen YouTube commands retain activation/engine provenance and suppress narration',()=>{for(const kind of Config.SELECTED_EVENTS){const engine=createEngine({layout:'endless',seed:1}),rules=createRules(engine),sounds=[],experience=createExperience(engine,rules,{notify:e=>sounds.push(e)});assert.equal(experience.handleEvent(wire(kind)),true,kind);const active=experience.state.lastActivation;assert.equal(active.source,'youtube',kind);assert.equal(active.actorName,'Ana',kind);assert.equal(sounds[0].narrate,false,kind);assert.equal(engine.state.lastEvent.source,'youtube',kind);assert.equal(engine.state.lastEvent.actionId,active.id,kind);}});
const fs=require('node:fs'),vm=require('node:vm');
test('operator markup requires explicit own-video selection and uses local status/select/stop only',async()=>{
 const html=fs.readFileSync(require.resolve('../games/block-wars/control.html'),'utf8'),ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])),nodes=new Map(),requests=[],listeners={};
 function node(id){assert.ok(ids.has(id),'actual HTML id '+id);if(!nodes.has(id))nodes.set(id,{value:id==='efficiency'?'0':'',checked:true,dataset:{},children:[],addEventListener(type,fn){this[type]=fn;},append(child){this.children.push(child);},replaceChildren(){this.children=[];}});return nodes.get(id);}
 const make=()=>({children:[],dataset:{},style:{},append(child){this.children.push(child);}});
 const sandbox={BlockWarsConfig:Config,URLSearchParams,location:{search:'?platform=youtube'},document:{getElementById:node,querySelector:()=>({}),addEventListener(){},createElement:make},addEventListener(type,fn){listeners[type]=fn;},setTimeout:()=>1,clearTimeout(){},fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>url.endsWith('broadcasts')?{broadcasts:[{id:'abcdefghijk',title:'Mi transmisión'}]}:url.endsWith('/status')&&url.includes('youtube')?{state:'idle'}:{enabled:false,keyConfigured:false,available:false}};}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../games/block-wars/control.js'),'utf8'),sandbox);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.some(r=>r.url.endsWith('broadcasts')),false);
 await node('youtube-refresh').click();assert.equal(node('youtube-video').value,'');assert.equal(node('youtube-video').children.length,2);
 await node('youtube-select-form').submit({preventDefault(){}});assert.equal(requests.some(r=>r.url.endsWith('/select')),false);
 node('youtube-video').value='abcdefghijk';await node('youtube-select-form').submit({preventDefault(){}});
 assert.equal(requests.find(r=>r.url.endsWith('/select')).options.body,JSON.stringify({videoId:'abcdefghijk'}));
 await node('youtube-stop').click();assert.equal(requests.find(r=>r.url.endsWith('/stop')).options.body,'{}');listeners.pagehide();
});
test('YouTube delayed weather/entity impacts preserve source, author and local action ID',()=>{
 for(const kind of ['tnt','rain','thunder','storm','creeper','meteor','fire','tsunami','mega','nuke','arrow']){
 const engine=createEngine({layout:'endless',seed:1,eventInterval:180}),rules=createRules(engine),experience=createExperience(engine,rules,{notify(){},impact(){}});assert.equal(experience.handleEvent(wire(kind)),true,kind);const id=experience.state.lastActivation.id;let impacts=0;
 for(let step=0;step<200;step++){experience.update(.05);for(const entry of [...engine.state.entities,...engine.state.effects,...engine.state.queue,...(engine.state.weather?[engine.state.weather]:[])]){if(entry.actionId===id){assert.equal(entry.source,'youtube',kind);assert.equal(entry.actor,'Ana',kind);if(entry.stage==='impact')impacts++;}}}
 assert.ok(impacts>0,kind+' produces attributed impact');
 }
});

test('YouTube printable author names remain consistent in activation and engine',()=>{const engine=createEngine({layout:'endless',seed:1}),rules=createRules(engine),experience=createExperience(engine,rules,{notify(){}}),event=wire();event.actor.displayName="Ana 🌻 / López!";assert.equal(experience.handleEvent(event),true);assert.equal(experience.state.lastActivation.actorName,event.actor.displayName);assert.equal(engine.state.lastEvent.actor,event.actor.displayName);});
