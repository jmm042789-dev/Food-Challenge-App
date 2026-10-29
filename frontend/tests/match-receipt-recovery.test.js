const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs");
const path=require("node:path");
const {createRequire}=require("node:module");
const ts=require("typescript");
// Reuse the real API/route harness without registering another file's tests.
const fixture=path.join(__dirname,"match-recovery.test.js");
const text=fs.readFileSync(fixture,"utf8");
const parsed=ts.createSourceFile(fixture,text,ts.ScriptTarget.Latest,true);
const declarations=parsed.statements.filter(n=>ts.isVariableStatement(n)||ts.isFunctionDeclaration(n)).map(n=>n.getText(parsed)).join("\n");
const {harness,payload,official,reply,screen,flush,ids,KEY}=new Function("require","__dirname",declarations+";return {harness,payload,official,reply,screen,flush,ids,KEY};")(createRequire(fixture),__dirname);
const {DIAGNOSTIC_PREFIX}=require("../src/game/pendingResult");
function receipt(status="TERMINAL_NO_REWARD",outcome="expired",id=ids[0],match="match-a"){
 const identity={schema_version:1,player_id:"guest_a",match_id:match,contest_id:id};
 return {...identity,status,...(status==="UNRESOLVED"?{}:{receipt:{...identity,outcome,rewards_granted:status==="SETTLED",settlement_final:true}}),...(status==="SETTLED"?{result:{...official,verified:true,match_id:match}}:{})};
}
async function setup(response=receipt(),id=ids[0]){
 const h=harness();const store=h.load("src/game/pendingResult.js").createPendingResultStore(h.storage);await store.save("guest_a",payload(id));
 h.handle((route,opts)=>{if(route==="/match/receipt"){assert.deepEqual(JSON.parse(opts.body),{match_id:"match-a",contest_id:id});assert.equal(opts.headers.Authorization,"Bearer token-a");return reply(response);}});
 return {h,store};
}
for(const id of ids)for(const outcome of ["expired","rejected"])test("terminal receipt diagnostic and safe entry: "+id+" "+outcome,async()=>{
 const {h}=await setup(receipt("TERMINAL_NO_REWARD",outcome,id),id);
 const r=await h.api.recoverPendingResult();assert.equal(r.receipt.outcome,outcome);assert.equal(h.values.has(KEY),false);
 const key=[...h.values.keys()].find(k=>k.startsWith(DIAGNOSTIC_PREFIX));const diagnostic=JSON.parse(h.values.get(key));assert.equal(diagnostic.schema_version,1);assert.deepEqual(diagnostic.pending.payload,payload(id));assert.equal(diagnostic.receipt.receipt.rewards_granted,false);
 h.handle(route=>route==="/match/start"?reply({match_id:"new"}):undefined);await h.api.startMatch(id);assert.ok(!h.calls.some(c=>c.route==="/match/result"));
});
test("settled receipt displays stored settlement without resubmission",async()=>{
 const {h}=await setup(receipt("SETTLED","settled"));const r=await h.api.recoverPendingResult();assert.equal(r.result.coin_reward,official.coin_reward);assert.equal(h.values.has(KEY),false);assert.ok(!h.calls.some(c=>c.route==="/match/result"));
});
test("unresolved retains exact payload and blocks new match",async()=>{
 const {h}=await setup(receipt("UNRESOLVED"));const raw=h.values.get(KEY);assert.equal((await h.api.recoverPendingResult()).status,"UNRESOLVED");assert.equal(h.values.get(KEY),raw);await assert.rejects(h.api.startMatch(ids[0]));
});
for(const status of [404,405,500,401])test("HTTP "+status+" never clears",async()=>{
 const {h}=await setup();const raw=h.values.get(KEY);h.handle(route=>route==="/match/receipt"?reply({},status):undefined);await assert.rejects(h.api.recoverPendingResult());assert.equal(h.values.get(KEY),raw);
});
test("timeout preserves pending evidence",async()=>{
 const {h}=await setup();h.handle(route=>{if(route==="/match/receipt")throw Error("timeout");});await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));
});
for(const target of ["envelope","receipt"])for(const field of ["player_id","match_id","contest_id","schema_version"])test("reject wrong "+target+" "+field,async()=>{
 const value=receipt();(target==="envelope"?value:value.receipt)[field]=field==="schema_version"?2:"wrong";const {h}=await setup(value);await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));
});
for(const value of [null,{},receipt("bogus"),{...receipt(),receipt:{...receipt().receipt,rewards_granted:true}},{...receipt("UNRESOLVED"),receipt:{}},{...receipt("SETTLED","settled"),result:{}}])test("malformed receipt fails closed "+JSON.stringify(value),async()=>{
 const {h}=await setup(value);await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));
});
for(const mode of ["false","reject","readback"])test("diagnostic failure "+mode+" preserves pending then retries",async()=>{
 const {h}=await setup();const original=h.storage.setItem;h.storage.setItem=async(k,v)=>{if(k.startsWith(DIAGNOSTIC_PREFIX)){if(mode==="reject")throw Error("write");if(mode==="false")return false;return;}return original(k,v);};
 await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));h.storage.setItem=original;await h.api.recoverPendingResult();assert.equal(h.values.has(KEY),false);
});
test("pending clear failure keeps diagnostic and permits idempotent retry",async()=>{
 const {h}=await setup();const remove=h.storage.removeItem;h.storage.removeItem=async()=>{throw Error("remove");};await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));const key=[...h.values.keys()].find(k=>k.startsWith(DIAGNOSTIC_PREFIX));const saved=h.values.get(key);h.storage.removeItem=remove;await h.api.recoverPendingResult();assert.equal(h.values.get(key),saved);assert.equal(h.values.has(KEY),false);
});
test("conflicting diagnostic is never overwritten",async()=>{
 const {h}=await setup();const key=DIAGNOSTIC_PREFIX+"guest_a:match-a";h.values.set(key,"unrelated");await assert.rejects(h.api.recoverPendingResult(),/does not match/);assert.equal(h.values.get(key),"unrelated");assert.ok(h.values.has(KEY));
});
test("different-match diagnostics coexist",async()=>{
 const {h,store}=await setup();await h.api.recoverPendingResult();const key=DIAGNOSTIC_PREFIX+"guest_a:match-a";const saved=h.values.get(key);await store.save("guest_a",payload(ids[1],"match-b"));h.handle(route=>route==="/match/receipt"?reply(receipt("TERMINAL_NO_REWARD","rejected",ids[1],"match-b")):undefined);await h.api.recoverPendingResult();assert.equal(h.values.get(key),saved);assert.ok(h.values.has(DIAGNOSTIC_PREFIX+"guest_a:match-b"));
});
test("stale receipt callback cannot clear a newer pending result",async()=>{
 const {h,store}=await setup();let finish;h.handle(route=>route==="/match/receipt"?new Promise(r=>{finish=()=>r(reply(receipt()));}):undefined);
 const running=h.api.recoverPendingResult();const rejected=assert.rejects(running);await flush();const old=await store.read("guest_a");await store.clearSettled(old);await store.save("guest_a",payload(ids[1],"newer"));finish();await rejected;assert.equal((await store.read("guest_a")).match_id,"newer");
});
test("lost accepted submission response is recovered by receipt without second submission",async()=>{
 const h=harness();h.handle(route=>{if(route==="/match/result")throw Error("lost response");});await assert.rejects(h.api.submitDurableResult(payload(),"guest_a"));h.handle(route=>route==="/match/receipt"?reply(receipt("SETTLED","settled")):undefined);await h.api.recoverPendingResult();assert.equal(h.calls.filter(c=>c.route==="/match/result").length,1);
});
test("duplicate concurrent receipts do not grant rewards",async()=>{
 const {h}=await setup(receipt("SETTLED","settled"));await Promise.all([h.api.recoverPendingResult(),h.api.recoverPendingResult()]);assert.equal(h.values.has(KEY),false);assert.ok(!h.calls.some(c=>c.route==="/match/result"));
});
test("restart after terminal resolution retains diagnostic without blocking",async()=>{
 const {h}=await setup();await h.api.recoverPendingResult();const restarted=harness(h.values);assert.equal(await restarted.api.pendingResult(),null);assert.ok([...h.values.keys()].some(k=>k.startsWith(DIAGNOSTIC_PREFIX)));
});
test("recovery screen shows terminal result and enables return to contests",async()=>{
 const {h}=await setup();const view=screen(h,"app/match-recovery.tsx");await flush();view.render();assert.match(view.text(),/Match expired without rewards/);assert.equal(view.find("RETRY VERIFICATION"),null);view.find("RETURN TO ARENA").onPress();assert.deepEqual(view.routes,["/(tabs)/contests"]);view.unmount();
});
test("screen does not publish stale receipt after unmount",async()=>{
 const {h}=await setup();let finish;h.handle(route=>route==="/match/receipt"?new Promise(r=>{finish=()=>r(reply(receipt()));}):undefined);const view=screen(h,"app/match-recovery.tsx");await flush();view.unmount();finish();await flush();assert.ok(h.values.has(KEY));assert.deepEqual(view.routes,[]);
});
test("read failure and malformed legacy pending data never reaches receipt endpoint",async()=>{
 const {h}=await setup();h.readFails(true);await assert.rejects(h.api.recoverPendingResult());h.readFails(false);h.values.set(KEY,JSON.stringify({finalized:true}));await assert.rejects(h.api.recoverPendingResult());assert.ok(!h.calls.some(c=>c.route==="/match/receipt"));
});

for(const field of ["verified","match_id"])test("settlement result validates "+field,async()=>{
 const value=receipt("SETTLED","settled");value.result[field]=field==="verified"?false:"wrong";const {h}=await setup(value);await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));
});
test("nonfinal terminal receipt never clears",async()=>{
 const value=receipt();value.receipt.settlement_final=false;const {h}=await setup(value);await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));
});
test("diagnostic persistence must complete before pending removal",async()=>{
 const {h}=await setup();const write=h.storage.setItem;let finish;
 h.storage.setItem=(k,v)=>k.startsWith(DIAGNOSTIC_PREFIX)?new Promise(resolve=>{finish=async()=>{await write(k,v);resolve();};}):write(k,v);
 const pending=h.api.recoverPendingResult();await flush();assert.ok(h.values.has(KEY));assert.equal(typeof finish,"function");await finish();await pending;assert.equal(h.values.has(KEY),false);
});
test("false pending remove preserves record and reports failure",async()=>{
 const {h}=await setup();h.storage.removeItem=async()=>false;await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));
});
test("diagnostic read failure never removes pending",async()=>{
 const {h}=await setup();const read=h.storage.getItem;h.storage.getItem=async k=>{if(k.startsWith(DIAGNOSTIC_PREFIX))throw Error("unreadable diagnostic");return read(k);};await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));
});
test("restart after diagnostic save and failed clear finishes idempotently",async()=>{
 const {h}=await setup();h.storage.removeItem=async()=>false;await assert.rejects(h.api.recoverPendingResult());
 const saved=[...h.values.entries()].find(([k])=>k.startsWith(DIAGNOSTIC_PREFIX));const restarted=harness(h.values);restarted.handle(route=>route==="/match/receipt"?reply(receipt()):undefined);await restarted.api.recoverPendingResult();assert.equal(h.values.get(saved[0]),saved[1]);assert.equal(h.values.has(KEY),false);
});
test("authentication recovery cannot switch receipt ownership",async()=>{
 const {h}=await setup();h.handle(route=>route==="/match/receipt"?reply({},401):route==="/auth/session"?reply({player_id:"guest_changed"}):undefined);
 await assert.rejects(h.api.recoverPendingResult());assert.ok(h.values.has(KEY));assert.equal(h.calls.filter(c=>c.route==="/match/receipt").length,1);
});
test("unresolved explicit retry preserves body and requires final receipt",async()=>{
 const {h}=await setup();const original=h.values.get(KEY);let submissions=0;
 h.handle((route,opts)=>{if(route==="/match/receipt")return reply(receipt("UNRESOLVED"));if(route==="/match/result"){submissions++;assert.deepEqual(JSON.parse(opts.body),{device_id:"guest_a",...payload()});return reply(official);}});
 assert.equal((await h.api.recoverPendingResult(undefined,true)).status,"UNRESOLVED");assert.equal(h.values.get(KEY),original);assert.equal(submissions,1);await assert.rejects(h.api.startMatch(ids[0]));
});
