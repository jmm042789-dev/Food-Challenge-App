const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
function load(p, deps) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(p), { fileName: p, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', code)(id => { assert.ok(id in deps, 'unexpected dependency: ' + id); return deps[id]; }, module, module.exports);
  return module.exports;
}
const clone = x => JSON.parse(JSON.stringify(x));
const fixture = () => ({ lastGeneratedDate: 'today', missions: ['a','b','c'].map(id => ({ id, category: 'PLAY_MATCHES', goal: 2, currentProgress: 2, completed: true, claimed: false, reward: { coins: 5, xp: 10 } })), claimedRewards: { coins: 7, xp: 11 } });
function missions(initial = fixture()) {
  let saved = clone(initial), mode = 'ok', gate = null, writes = 0, day = 'today', events = 0;
  const api = load('src/missions/MissionTracker.ts', {
    '../utils/storage': { storage: { getItem: async () => JSON.stringify(saved), setItem: async (key, value) => {
      assert.equal(key, 'fire_feast_daily_missions_v1'); writes++; if (gate) await gate;
      if (mode === 'reject') throw new Error('write failed'); if (mode === 'false') return false;
      saved = JSON.parse(value); return true;
    } } },
    './MissionGenerator': { getLocalDateKey: date => date?.testDay || day, generateDailyMissions: date => fixture().missions.map(m => ({ ...m, id: date + m.id, completed: false, currentProgress: 0 })) },
    '../achievements/AchievementTracker': { trackAchievementEvent: async () => { events++; } },
  });
  return { api, saved: () => clone(saved), mode: m => mode=m, day: d=>day=d, writes:()=>writes, events:()=>events, block:()=> { let release; gate = new Promise(r=>release=r); return ()=>{gate=null;release();}; } };
}
test('successful mission claim preserves legacy schema and totals', async () => {
  const h=missions(), r=await h.api.claimMission('a'); assert.equal(r.ok,true);
  assert.deepEqual(h.saved().claimedRewards,{ coins:12,xp:21 }); assert.deepEqual(Object.keys(h.saved()).sort(),Object.keys(fixture()).sort());
  assert.equal((await h.api.claimMission('a')).error,'ALREADY_CLAIMED'); assert.equal(h.writes(),1);
});
for(const mode of ['false','reject']) test('mission '+mode+' write preserves prior state and permits retry',async()=>{
  const h=missions(), before=h.saved();h.mode(mode);const r=await h.api.claimMission('a');
  assert.equal(r.error,'PERSISTENCE_FAILED');assert.deepEqual(r.state,before);assert.deepEqual(h.saved(),before);
  h.mode('ok');assert.equal((await h.api.claimMission('a')).ok,true);
});
test('same-ID concurrent claims write once',async()=>{
  const h=missions(), release=h.block();const a=h.api.claimMission('a'),b=h.api.claimMission('a');release();
  const [x,y]=await Promise.all([a,b]);assert.equal(x.ok,true);assert.equal(y.error,'CLAIM_IN_PROGRESS');assert.equal(h.writes(),1);
});
test('different-ID claims retain both updates',async()=>{
  const h=missions();assert.ok((await Promise.all([h.api.claimMission('a'),h.api.claimMission('b')])).every(r=>r.ok));
  assert.deepEqual(h.saved().claimedRewards,{coins:17,xp:31});assert.ok(h.saved().missions.slice(0,2).every(m=>m.claimed));
});
test('mission claim and progress writes serialize without losing progress',async()=>{
  const f=fixture();f.missions[1].completed=false;f.missions[1].currentProgress=0;
  const h=missions(f);await Promise.all([h.api.claimMission('a'),h.api.trackMissionEvent({won:false,coinsEarned:0,xpEarned:0,highestCombo:0})]);
  assert.equal(h.saved().missions[0].claimed,true);assert.equal(h.saved().missions[1].currentProgress,1);
});
test('rollover and claim serialize and preserve historical totals',async()=>{
  const h=missions();await Promise.all([h.api.claimMission('a'),h.api.loadDailyMissions({testDay:'tomorrow'})]);
  assert.equal(h.saved().lastGeneratedDate,'tomorrow');assert.deepEqual(h.saved().claimedRewards,{coins:12,xp:21});
  h.day('tomorrow');assert.equal((await h.api.claimMission('a')).error,'NOT_FOUND');
});
test('failed rollover and failed progress never replace prior records or emit completion',async()=>{
  const f=fixture();f.missions[0].completed=false;f.missions[0].currentProgress=1;
  const h=missions(f);h.mode('false');assert.deepEqual(await h.api.loadDailyMissions({testDay:'tomorrow'}),f);
  assert.deepEqual(await h.api.trackMissionEvent({}),f);assert.deepEqual(h.saved(),f);assert.equal(h.events(),0);
  assert.equal((await h.api.claimMission('a')).error,'NOT_COMPLETED');
});
function hook(p,name,tracker,method,extra={}) {
  const states=[], alerts=[];let result, reject=false;
  const api=load(p,{
    react:{useState:init=>[typeof init==='function'?init():init,value=>states.push(value)],useCallback:fn=>fn,useEffect:()=>{},useRef:value=>({current:value})},
    'react-native':{Alert:{alert:(...args)=>alerts.push(args)}},
    [tracker]:{[method]:async()=>{if(reject)throw Error('failed');return result;}},...extra,
  })[name]();
  return {api,states,alerts,set:r=>result=r,reject:()=>reject=true};
}
for(const [p,name,tracker,method,extra] of [
 ['src/missions/useDailyMissions.ts','useDailyMissions','./MissionTracker','claimMission',{}],
 ['src/achievements/useAchievements.ts','useAchievements','./AchievementTracker','claimAchievement',{'./AchievementStorage':{}}],
 ['src/tournaments/useTournamentProgress.ts','useTournamentProgress','./TournamentProgress','claimTournamentReward',{'./TournamentRotation':{getActiveTournament:()=>({occurrenceId:'x'})}}],
])test(name+' publishes only successful persisted claims',async()=>{
  const h=hook(p,name,tracker,method,extra);const previous={saved:true};
  h.set({ok:false,state:{unpersisted:true},error:'PERSISTENCE_FAILED'});
  assert.equal((await h.api.claim('a')).ok,false);assert.equal(h.states.length,0);assert.match(h.alerts[0].join(' '),/hasn't been recorded/);
  h.set({ok:false,state:previous,error:'CLAIM_IN_PROGRESS'});await h.api.claim('a');assert.equal(h.alerts.length,1);
  h.set({ok:false,state:previous,error:'ALREADY_CLAIMED'});await h.api.claim('a');assert.match(h.alerts[1].join(' '),/Already recorded/);
  h.set({ok:true,state:previous,reward:{}});assert.equal((await h.api.claim('a')).ok,true);assert.deepEqual(h.states,[previous]);
  h.reject();assert.equal(await h.api.claim('a'),null);assert.deepEqual(h.states,[previous]);
});
test('real achievement and tournament claim trackers reject failed writes',async()=>{
  const achievement=load('src/achievements/AchievementTracker.ts',{
    './AchievementCatalog':{ACHIEVEMENT_CATALOG:[],ACHIEVEMENT_BY_ID:new Map([['a',{reward:{coins:5,xp:10}}]])},
    './AchievementStorage':{loadAchievementState:async()=>({progress:[{achievementId:'a',completed:true,claimed:false}],claimedRewards:{coins:0,xp:0}}),saveAchievementState:async()=>false},
  });
  const ar=await achievement.claimAchievement('a');assert.equal(ar.error,'PERSISTENCE_FAILED');assert.equal(ar.state.progress[0].claimed,false);
  const original={version:1,tournaments:[{occurrenceId:'x',tournamentId:'t',matchesEntered:1,bestScore:5,claimedRewardIds:[],claimedCoins:0,claimedXp:0}]};
  const tournament=load('src/tournaments/TournamentProgress.ts',{
    '../utils/storage':{storage:{getItem:async()=>JSON.stringify(original),setItem:async()=>false}},
    './TournamentCatalog':{TOURNAMENT_BY_ID:new Map([['t',{rewardTable:[{id:'a',minimumScore:0,coins:5,xp:10}]}]])},
  });
  const tr=await tournament.claimTournamentReward('x','a');assert.equal(tr.error,'PERSISTENCE_FAILED');assert.deepEqual(tr.state,original);
});
test('no retroactive grants and success notices require explicit success',()=>{
  for(const p of ['src/missions/MissionTracker.ts','src/achievements/AchievementTracker.ts','src/tournaments/TournamentProgress.ts'])assert.doesNotMatch(read(p),/from ["'].*api|fetch\(|applyPlayerBalanceResponse/);
  for(const p of ['app/missions.tsx','app/achievements.tsx']){assert.match(read(p),/if \(result\?\.ok\) setNotice/);assert.match(read(p),/Milestone recorded on this device/);}
});
