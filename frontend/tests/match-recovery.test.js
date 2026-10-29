const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const root = path.resolve(__dirname,"..");
const {KEY,createPendingResultStore} = require("../src/game/pendingResult");
const {createResultSubmissionCoordinator} = require("../src/game/resultSubmission");
const ids=["nathans-hotdogs","wing-bowl","pizza-hut-stuffed","katz-pastrami","ben-jerry-icecream","in-n-out-burgers"];
const credentials="firefeast_guest_credentials_v1";
const official={coin_reward:10,xp_reward:15,new_xp:15,new_coins:10,new_tums:3,accepted_score:0,authoritative_opponent_score:50,won:false,authoritative_outcome:"loss"};
const payload=(id=ids[0],match="match-a")=>({match_id:match,contest_id:id,opponent_id:"opponent-a",score:0,opponent_score:50,duration_sec:30,accepted_taps:0,completed_progress:0,maximum_combo:0,tums_used:0,completion_reason:"timer_completed",is_tournament:false,validation_version:3,input_events:[]});
const reply=(data,status=200)=>({ok:status<400,status,headers:{get:()=>null},text:async()=>JSON.stringify(data),json:async()=>data});
const flush=async()=>{for(let i=0;i<200;i++)await Promise.resolve();};
function harness(values=new Map()) {
  if(!values.has(credentials))values.set(credentials,JSON.stringify({version:1,player_id:"guest_a",auth_token:"token-a"}));
  const calls=[], writes=[]; let handler,failRead=false,failWrite=false,settled=false;
  const storage={
    getItem:async k=>{if(k===KEY&&failRead)throw Error("read failed");return values.get(k)??null;},
    setItem:async(k,v)=>{writes.push(k);if(k===KEY&&failWrite){if(failWrite==="reject")throw Error("write failed");return false;}values.set(k,v);},
    removeItem:async k=>{values.delete(k);},
    multiGet:async keys=>keys.map(k=>[k,values.get(k)??null]),
    multiRemove:async keys=>keys.forEach(k=>values.delete(k)),
  };
  const modules=new Map();
  const context=vm.createContext({__DEV__:false,console:{log(){},warn(){},error(){},info(){}},process:{env:{EXPO_PUBLIC_BACKEND_URL:"https://test.invalid"}},URL,AbortController,Error,TypeError,setTimeout,clearTimeout,
    fetch:async(url,opts)=>{
      const route=new URL(url).pathname.replace(/^\/api/,"");calls.push({route,opts});
      if(handler){const result=await handler(route,opts);if(result){if(route==="/match/result"&&result.ok)settled=true;return result;}}
      if(route==="/auth/session")return reply({player_id:JSON.parse(values.get(credentials)).player_id});
      if(route.startsWith("/player/"))return reply({player_id:"guest_a",coins:0,tutorial_done:true,welcome_reward_claimed:true});
      if(route==="/match/active")return reply({status:"absent"});
      if(route==="/match/receipt") {
        const record=JSON.parse(values.get(KEY));const identity={schema_version:1,player_id:record.player_id,match_id:record.match_id,contest_id:record.contest_id};
        return reply(settled?{...identity,status:"SETTLED",receipt:{...identity,outcome:"settled",rewards_granted:true,settlement_final:true},result:{...official,verified:true,match_id:record.match_id}}:{...identity,status:"UNRESOLVED"});
      }
      if(route==="/match/result"){settled=true;return reply(official);}
      throw Error("Unexpected request "+route);
    }});
  function load(file, mocks={}) {
    file=path.resolve(root,file);if(modules.has(file))return modules.get(file).exports;
    const m={exports:{}};modules.set(file,m);
    const code=ts.transpileModule(fs.readFileSync(file,"utf8"),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const requireLocal=name=>{
      if(Object.hasOwn(mocks,name))return mocks[name];
      if(name==="@react-native-async-storage/async-storage")return {default:storage};
      if(name==="expo-constants")return {default:{}};
      if(name==="expo-modules-core")return {uuid:{v4:()=>require("node:crypto").randomUUID()}};
      if(name==="./utils/storage")return {storage:{secureRead:async k=>({status:"available",value:values.get(k)??null}),secureSet:async(k,v)=>{values.set(k,v);return true;},secureRemove:async k=>{values.delete(k);return true;}}};
      if(name==="./playerBalance")return {applyPlayerBalanceResponse(){},clearPlayerBalance(){}};
      if(name.startsWith(".")) {const base=path.resolve(path.dirname(file),name);return load([base,base+".ts",base+".js",base+".tsx"].find(f=>fs.existsSync(f)&&fs.statSync(f).isFile()));}
      throw Error("Unexpected dependency "+name);
    };
    vm.runInContext(`(function(require,module,exports){${code}\n})`,context)(requireLocal,m,m.exports);return m.exports;
  }
  const exports=load("src/api.ts");
  return {...exports,values,storage,calls,writes,load,handle:f=>{handler=f;},readFails:v=>{failRead=v;},writeFails:v=>{failWrite=v;}};
}
function resumeResponse(id=ids[0]){
 return {status:"resumable",match_id:"match-a",contest_id:id,server_time:"2026-10-12T12:00:10Z",start:{match_id:"match-a",contest:{id,duration_sec:30},opponent:{id:"opponent-a"},opponent_config:{seed:1,final_score:50,pace_per_sec:2,duration_sec:30},server_started_at:"2026-10-12T12:00:00Z",server_time:"2026-10-12T12:00:00Z",expires_at:"2026-10-12T12:02:30Z",authoritative_duration_sec:30,player_tums:3,equipped_gear:null,perk_modifiers:{tap_power:1,combo_window_ms:700,score_multiplier:1,heat_generation_multiplier:1}}};
}
for(const id of ids)test("production entry resumes paid zero-balance match without creation: "+id,async()=>{
 const h=harness();const configuration=resumeResponse(id);
 h.handle((route,opts)=>{
  if(route==="/match/active")return reply({status:"resumable",match_id:"match-a",contest_id:id});
  if(route==="/match/resume"){assert.deepEqual(JSON.parse(opts.body),{match_id:"match-a",contest_id:id});assert.equal(opts.headers.Authorization,"Bearer token-a");return reply(configuration);}
 });
 const {resolveMatchEntry}=h.load("src/game/safeMatchEntry.ts");
 const result=await resolveMatchEntry({api:h.api,playerId:"guest_a",contestId:id,coins:0,entryFee:50});
 assert.equal(result.resumed,true);assert.equal(result.serverTime,configuration.server_time);assert.equal(JSON.stringify(result.match),JSON.stringify(configuration.start));assert.ok(!h.calls.some(c=>c.route==="/match/start"));
});
for(const [status,code] of [[409,"MATCH_NOT_RESUMABLE"],[410,"MATCH_EXPIRED"],[404,""],[405,""],[503,""]])test("resume HTTP "+status+" never falls back to creation",async()=>{
 const h=harness();h.handle(route=>route==="/match/active"?reply({status:"resumable",match_id:"match-a",contest_id:ids[0]}):route==="/match/resume"?reply({detail:{code}},status):undefined);
 await assert.rejects(h.load("src/game/safeMatchEntry.ts").resolveMatchEntry({api:h.api,playerId:"guest_a",contestId:ids[0],coins:500,entryFee:50}));assert.ok(!h.calls.some(c=>c.route==="/match/start"));
});
test("resume transport timeout is uncertain and cannot create a match",async()=>{
 const h=harness();h.handle(route=>{if(route==="/match/active")return reply({status:"resumable",match_id:"match-a",contest_id:ids[0]});if(route==="/match/resume"){const e=Error("timed out");e.name="RequestTimeoutError";throw e;}});
 await assert.rejects(h.load("src/game/safeMatchEntry.ts").resolveMatchEntry({api:h.api,playerId:"guest_a",contestId:ids[0],coins:500,entryFee:50}));assert.ok(!h.calls.some(c=>c.route==="/match/start"));
});
test("wrong player/contest and invalid configuration are rejected",async()=>{
 const h=harness();await assert.rejects(h.api.resumeMatch("match-a",ids[0],"wrong"));assert.ok(!h.calls.some(c=>c.route==="/match/resume"));
 h.handle(route=>route==="/match/resume"?reply(resumeResponse(ids[1])):undefined);
 await assert.rejects(h.api.resumeMatch("match-a",ids[0],"guest_a"));
});
test("new-match affordability remains required",async()=>{
 const h=harness();const {resolveMatchEntry}=h.load("src/game/safeMatchEntry.ts");
 await assert.rejects(resolveMatchEntry({api:h.api,playerId:"guest_a",contestId:ids[0],coins:0,entryFee:50}),/Not enough coins/);
 h.handle(route=>route==="/match/start"?reply({match_id:"new"}):undefined);
 assert.equal((await resolveMatchEntry({api:h.api,playerId:"guest_a",contestId:ids[0],coins:50,entryFee:50})).resumed,false);
 assert.equal(h.calls.filter(c=>c.route==="/match/start").length,1);
});
test("complete immutable result is durably saved before first real API submission",async()=>{
 const h=harness();const p=payload();h.handle((route,opts)=>{if(route==="/match/result"){assert.equal(JSON.stringify(JSON.parse(h.values.get(KEY)).payload),JSON.stringify(payload()));assert.deepEqual(JSON.parse(opts.body),{device_id:"guest_a",...payload()});return reply(official);}});
 const coordinator=createResultSubmissionCoordinator((p,s)=>h.api.submitDurableResult(p,"guest_a",s));const frozen=coordinator.preserve(p);p.score=900;assert.equal(frozen.score,0);assert.ok(Object.isFrozen(frozen.input_events));await coordinator.submit();assert.equal(h.values.has(KEY),false);
});
test("restart before first request retries original complete payload",async()=>{
 const values=new Map();const first=harness(values);const store=first.load("src/game/pendingResult.js").createPendingResultStore(first.storage);await store.save("guest_a",payload());
 const restarted=harness(values);await restarted.api.getPlayer();await restarted.api.retryPendingResult();
 assert.deepEqual(JSON.parse(restarted.calls.find(c=>c.route==="/match/result").opts.body),{device_id:"guest_a",...payload()});assert.equal(values.has(KEY),false);
});
test("lost accepted response across restart retrieves duplicate settlement without new match",async()=>{
 const h=harness();let original;
 h.handle((route,opts)=>{if(route==="/match/result"){original=opts.body;throw TypeError("Network response lost after acceptance");}});
 await assert.rejects(h.api.submitDurableResult(payload(),"guest_a"));assert.ok(h.values.has(KEY));
 const restarted=harness(h.values);restarted.handle((route,opts)=>{if(route==="/match/result"){assert.equal(opts.body,original);return reply({...official,already_finalized:true});}});
 await restarted.api.retryPendingResult();assert.equal(restarted.values.has(KEY),false);assert.ok(!restarted.calls.some(c=>c.route==="/match/start"));
});
for(const mode of [true,"reject"])test("failed persistence "+mode+" prevents submission and permits exact retry",async()=>{
 const h=harness();h.writeFails(mode);await assert.rejects(h.api.submitDurableResult(payload(),"guest_a"));assert.ok(!h.calls.some(c=>c.route==="/match/result"));await assert.rejects(h.api.startMatch(ids[0]));h.writeFails(false);await h.api.submitDurableResult(payload(),"guest_a");
});
test("read failure blocks mutation without deleting evidence",async()=>{
 const h=harness();h.readFails(true);await assert.rejects(h.api.pendingResult());await assert.rejects(h.api.startMatch(ids[0]));await assert.rejects(h.api.submitDurableResult(payload(),"guest_a"));assert.ok(!h.calls.some(c=>c.route==="/match/result"||c.route==="/match/start"));
});
for(const raw of ["{bad",JSON.stringify({schema_version:1,finalized:true,input_events:[]}),JSON.stringify({schema_version:99,payload:payload()})])test("malformed or legacy pending record is preserved: "+raw.slice(0,24),async()=>{
 const h=harness();h.values.set(KEY,raw);await assert.rejects(h.api.pendingResult());await assert.rejects(h.api.startMatch(ids[0]));assert.equal(h.values.get(KEY),raw);
});
for(const [status,code] of [[400,"MATCH_RESULT_REJECTED"],[409,"MATCH_EXPIRED"],[409,"MATCH_NOT_ACTIVE"],[500,""]])test("terminal or uncertain error retains evidence: "+code,async()=>{
 const h=harness();h.handle(route=>route==="/match/result"?reply({detail:{code}},status):undefined);await assert.rejects(h.api.submitDurableResult(payload(),"guest_a"));assert.ok(h.values.has(KEY));await assert.rejects(h.api.startMatch(ids[0]));await assert.rejects(h.api.abandonMatch());
});
test("concurrent/stale clearing cannot remove a different newer record",async()=>{
 const values=new Map();const storage={getItem:async k=>values.get(k)??null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k)};const s=createPendingResultStore(storage);
 const a=await s.save("guest_a",payload());await assert.rejects(s.save("guest_a",payload(ids[1],"match-b")));await s.clearSettled(a);const b=await s.save("guest_a",payload(ids[1],"match-b"));await assert.rejects(s.clearSettled(a));assert.equal((await s.read("guest_a")).match_id,b.match_id);
});
test("wrong-player restart cannot submit or erase saved evidence",async()=>{
 const h=harness();await h.load("src/game/pendingResult.js").createPendingResultStore(h.storage).save("guest_a",payload());h.values.set(credentials,JSON.stringify({version:1,player_id:"guest_b",auth_token:"token-b"}));const other=harness(h.values);await assert.rejects(other.api.retryPendingResult());assert.ok(other.values.has(KEY));assert.ok(!other.calls.some(c=>c.route==="/match/result"));
});
test("production play/startup route wiring prioritizes pending results and uses safe entry",()=>{
 const play=fs.readFileSync(path.join(root,"app/play/[contestId].tsx"),"utf8");const startup=fs.readFileSync(path.join(root,"app/index.tsx"),"utf8");
 assert.match(play,/resolveMatchEntry\(\{/);assert.doesNotMatch(play,/api\.startMatch\(/);assert.match(play,/api\.submitDurableResult\(payload, serverPlayerId.current/);assert.ok(play.indexOf("await api.pendingResult()")<play.indexOf("await resolveMatchEntry"));assert.ok(startup.indexOf("await api.pendingResult()")<startup.indexOf("api.startupActiveMatch()"));
});

for(const restoredId of ["guest_a","guest_changed"])test("401 session restoration preserves result player binding: "+restoredId,async()=>{
 const h=harness();let count=0;
 h.handle(route=>{
  if(route==="/auth/session")return reply({player_id:restoredId});
  if(route==="/match/result")return ++count===1?reply({},401):reply(official);
 });
 if(restoredId==="guest_a"){await h.api.submitDurableResult(payload(),"guest_a");assert.equal(count,2);}
 else {await assert.rejects(h.api.submitDurableResult(payload(),"guest_a"));assert.equal(count,1);assert.ok(h.values.has(KEY));}
});
test("expected resume identity blocks expired/settled/replaced matches before any creation",async()=>{
 for(const active of [{status:"expired"},{status:"settled"},{status:"absent"},{status:"resumable",match_id:"replacement",contest_id:ids[0]}]){
  const h=harness();h.handle(route=>route==="/match/active"?reply(active):undefined);
  await assert.rejects(h.load("src/game/safeMatchEntry.ts").resolveMatchEntry({api:h.api,playerId:"guest_a",contestId:ids[0],expectedMatchId:"match-a",coins:500,entryFee:50}));
  assert.ok(!h.calls.some(c=>c.route==="/match/start"||c.route==="/match/resume"));
 }
});
test("incompatible official response cannot discard the pending record",async()=>{
 const h=harness();h.handle(route=>route==="/match/result"?reply({coin_reward:10}):undefined);
 await assert.rejects(h.api.submitDurableResult(payload(),"guest_a"));assert.ok(h.values.has(KEY));
});
function screen(h,file){
 let cursor=0,tree;const slots=[],effects=[],routes=[];const same=(a,b)=>a&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={useState(initial){const i=cursor++;slots[i]??={value:initial};return[slots[i].value,v=>{slots[i].value=typeof v==="function"?v(slots[i].value):v;}];},useRef(v){const i=cursor++;slots[i]??={current:v};return slots[i];},useCallback(fn){cursor++;return fn;},useEffect(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))effects.push(()=>{slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()};});}};
 const jsx=(type,props)=>({type,props});const router={replace:r=>routes.push(r)};
 const native={StyleSheet:{create:x=>x},Text:"Text",View:"View",Alert:{alert(){}}};
 const startup=h.load("src/startupReliability.ts");
 const component=h.load(file,{react,"react/jsx-runtime":{jsx,jsxs:jsx},"react-native":native,"expo-router":{useRouter:()=>router},"expo-constants":{default:{}},"../src/components/fire/FireButton":{default:"FireButton"},"../src/components/fire/FireEmptyState":{default:"FireEmptyState"},"../src/components/fire/FireLoading":{default:"FireLoading"},"../src/game/ui/ArcadeBackground":{default:"Background"},"../src/startupReliability":{...startup,withTransientStartupRetry:fn=>fn()}}).default;
 const render=()=>{cursor=0;tree=component();effects.splice(0).forEach(fn=>fn());};
 const find=(title,node=tree)=>{if(!node||typeof node!=="object")return null;if(node.props?.title===title)return node.props;for(const c of [node.props?.children ?? []].flat()){const x=find(title,c);if(x)return x;}return null;};
 render();return{render,find,routes,text:()=>JSON.stringify(tree),unmount:()=>slots.forEach(s=>s?.cleanup?.())};
}
test("actual startup route restores auth then redirects pending results before active-match recovery",async()=>{
 const h=harness();await h.load("src/game/pendingResult.js").createPendingResultStore(h.storage).save("guest_a",payload());
 const view=screen(h,"app/index.tsx");await flush();assert.deepEqual(view.routes,["/match-recovery"]);assert.ok(!h.calls.some(c=>c.route==="/match/active"));view.unmount();
});
test("actual recovery screen reads then explicitly retries exact saved result without starting a match",async()=>{
 const h=harness();await h.load("src/game/pendingResult.js").createPendingResultStore(h.storage).save("guest_a",payload());
 const view=screen(h,"app/match-recovery.tsx");await flush();view.render();assert.match(view.text(),/Result still unresolved/);assert.ok(!h.calls.some(c=>c.route==="/match/result"));
 view.find("RETRY SAVED SUBMISSION").onPress();await flush();view.render();assert.match(view.text(),/Official result confirmed/);assert.equal(h.values.has(KEY),false);assert.ok(!h.calls.some(c=>c.route==="/match/start"));view.unmount();
});
test("actual recovery screen ignores late UI callbacks after unmount",async()=>{
 const h=harness();await h.load("src/game/pendingResult.js").createPendingResultStore(h.storage).save("guest_a",payload());let finish;
 h.handle(route=>route==="/match/result"?new Promise(resolve=>{finish=()=>resolve(reply(official));}):undefined);
 const view=screen(h,"app/match-recovery.tsx");await flush();view.render();view.find("RETRY SAVED SUBMISSION").onPress();await flush();view.unmount();finish();await flush();assert.deepEqual(view.routes,[]);
});

test("failed in-memory save can be retried from recovery screen without claiming durability",async()=>{
 const h=harness();h.writeFails(true);await assert.rejects(h.api.submitDurableResult(payload(),"guest_a"));
 const view=screen(h,"app/match-recovery.tsx");await flush();view.render();assert.match(view.text(),/could not be saved/);
 h.writeFails(false);view.find("RETRY SAVED SUBMISSION").onPress();await flush();view.render();assert.match(view.text(),/Official result confirmed/);view.unmount();
});
test("late successful API callback cannot clear a newer different record",async()=>{
 const h=harness();let finish;h.handle(route=>route==="/match/result"?new Promise(r=>{finish=()=>r(reply(official));}):undefined);
 const old=h.api.submitDurableResult(payload(),"guest_a");const rejected=assert.rejects(old);await flush();
 const store=h.load("src/game/pendingResult.js").createPendingResultStore(h.storage);
 const first=await store.read("guest_a");await store.clearSettled(first);const newer=await store.save("guest_a",payload(ids[1],"match-b"));
 finish();await rejected;assert.equal((await store.read("guest_a")).match_id,newer.match_id);
});
test("valid original evidence is frozen and restored without coordinate changes",async()=>{
 const h=harness();const p=payload();p.input_events=[{seq:1,t_ms:25,type:"BITE",source:"CONTROL",x:0.5,y:0.5}];p.accepted_taps=1;
 const store=h.load("src/game/pendingResult.js").createPendingResultStore(h.storage);const saved=await store.save("guest_a",p);p.input_events[0].x=0;
 assert.equal(saved.payload.input_events[0].x,0.5);assert.ok(Object.isFrozen(saved.payload.input_events[0]));
 const restarted=harness(h.values);assert.equal(JSON.stringify((await restarted.api.pendingResult()).payload),JSON.stringify(saved.payload));
});
test("new invalid evidence or extra credential fields never enter durable storage",async()=>{
 const h=harness();for(const p of [{...payload(),auth_token:"forbidden"},{...payload(),input_events:[{seq:2,t_ms:1,type:"BITE",source:"CONTROL",x:0.5,y:0.5}]},{...payload(),score:NaN}])await assert.rejects(h.api.submitDurableResult(p,"guest_a"));
 assert.equal(h.values.has(KEY),false);assert.ok(!h.calls.some(c=>c.route==="/match/result"));
});
