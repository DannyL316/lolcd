'use strict';
const SimCore = (()=>{
 const roles=['top','jungle','mid','bot','support'];
 const spellData={Flash:{base:300,icon:'SummonerFlash'},Teleport:{base:300,icon:'SummonerTeleport'},'Unleashed Teleport':{base:240,icon:'UnleashedTeleport'},Barrier:{base:180,icon:'SummonerBarrier'},Heal:{base:240,icon:'SummonerHeal'},Ignite:{base:180,icon:'SummonerDot'},Ghost:{base:240,icon:'SummonerHaste'},Smite:{base:90,icon:'SummonerSmite',lockout:15},Exhaust:{base:240,icon:'SummonerExhaust'},Cleanse:{base:240,icon:'SummonerBoost'}};
 const aliases={flash:['flash','f'],teleport:['teleport','tp','unleashedteleport'],barrier:['barrier','barr','bar'],heal:['heal','h'],ignite:['ignite','ign'],ghost:['ghost','gho'],smite:['smite','sm'],exhaust:['exhaust','exh'],cleanse:['cleanse','cl','c']};
 const roleAliases={top:['top'],jungle:['jungle','jg','jgl'],mid:['mid','middle'],bot:['bot','bottom','adc','ad'],support:['support','sup','supp']};
 const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
 const pick=(a,r)=>a[Math.floor(r()*a.length)];
 const format=s=>Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
 function cooldown(name,haste){const s=spellData[name];return Math.round(s.base/(1+(s.fixed?0:haste)/100))}
 function secondarySpell(role,tp,r=Math.random){const x=r();if(role==='top')return x<.45?tp:x<.90?'Ignite':x<.97?'Ghost':'Exhaust';if(role==='mid')return x<.47?tp:x<.94?'Ignite':'Ghost';if(role==='bot')return x<.70?'Barrier':'Cleanse';return pick(role==='jungle'?['Smite']:['Ignite','Heal','Exhaust'],()=>x)}
 function trinket(role,level,r=Math.random){return role==='jungle'||role==='support'?3364:pick(level>=9?[3340,3363,3364]:[3340,3364],r)}
 function draft(roster,config={},r=Math.random){const used=new Set();const start=360+Math.floor(r()*1440);let teams=[[],[]];for(let side=0;side<2;side++)for(const role of roles){const pool=roster.filter(c=>c.roles.includes(role)&&!used.has(c.id));if(!pool.length)throw new Error('No champion available for '+role);const c=pick(pool,r);used.add(c.id);const tp=start>=600?'Unleashed Teleport':'Teleport';const second={top:[tp,'Ignite','Ghost','Exhaust'],jungle:['Smite'],mid:[tp,'Ignite','Ghost'],bot:['Barrier','Cleanse'],support:['Ignite','Exhaust','Heal']}[role];const haste=0;const level=Math.min(18,Math.max(4,Math.floor(start/105)+Math.floor(r()*3)));teams[side].push({...c,role,haste,spells:['Flash',secondarySpell(role,tp,r)],ward:trinket(role,level,r),level,kills:Math.floor(r()*8),deaths:Math.floor(r()*5),assists:Math.floor(r()*11),cs:role==='support'?Math.floor(15+r()*30):Math.floor(start/60*(4+r()*3))})}
 const enemy=pick(teams[1],r);
 if(config.haste&&r()<0.5)enemy.haste=pick(enemy.role==='mid'?[10,18,20,28,38]:[10,18,28],r);
 enemy.boots=[20,38].includes(enemy.haste)?'crimson':[10,28].includes(enemy.haste)?'ionian':null;
 const selected=config.flashOnly?'Flash':pick(enemy.spells.filter(s=>s!=='Smite'),r);
 const pingIndex=3+Math.floor(r()*6),events=[];let at=0;
 for(let index=2;index<=pingIndex;index++){at+=2+Math.floor(r()*4);if(index===pingIndex&&isTeleport(selected))at=safeTeleportTime(start+at)-start;events.push({at,ping:index===pingIndex})}
 const pingAfter=at,pingTime=start+at,spell=isTeleport(selected)?teleportAt(pingTime):selected;
 return {teams,start,enemy,spell,pingAfter,pingTime,pingIndex,events,eventCursor:0,nextAmbient:at+5,cooldown:cooldown(spell,enemy.haste),sender:pick(teams[0],r),pingSent:false,elapsed:0,logs:[],status:'playing'};
 }
 function isTeleport(name){return name==='Teleport'||name==='Unleashed Teleport'}
 function teleportAt(time){return time>=600?'Unleashed Teleport':'Teleport'}
 function safeTeleportTime(time){return time>=600&&time<602?602:time}
 function upgradeTeleports(round,time){let changed=false;for(const c of round.teams.flat()){c.spells=c.spells.map(name=>{if(isTeleport(name)&&name!==teleportAt(time)){changed=true;return teleportAt(time)}return name})}return changed}
 function inspectCooldown(round,champ,name){if(round.pingSent&&champ===round.enemy&&isTeleport(name)&&isTeleport(round.spell))return round.cooldown;return cooldown(name,champ.haste)}
 function parse(text){const m=text.trim().match(/^(\d{1,3}:\d{2}|\d{3,5})\s+(.+?)\s+(\S+)\s*$/);if(!m)return {error:'Use time, champion or role, then spell. Example: 2839 top f'};const digits=m[1].replace(':','');const sec=Number(digits.slice(-2));if(sec>59)return {error:'Seconds must be between 00 and 59.'};let spell=Object.keys(aliases).find(k=>aliases[k].includes(norm(m[3])));if(!spell)return {error:'Unknown spell. Use flash/f, tp, barrier/barr/bar, heal/h, ignite/ign, ghost/gho, smite/sm, exhaust/exh, or cleanse/cl/c.'};return {time:Number(digits.slice(0,-2))*60+sec,target:norm(m[2]),spell}}
 function evaluate(text,round){const p=parse(text);if(p.error)return p;const canonical=round.spell==='Unleashed Teleport'?'teleport':round.spell.toLowerCase();const extra={MonkeyKing:['wukong'],Nunu:['nunu','nunuwillump'],Renata:['renata','renataglasc'],DrMundo:['mundo','drmundo']}[round.enemy.id]||[];const identity=[norm(round.enemy.name),norm(round.enemy.id),...extra,...roleAliases[round.enemy.role]].includes(p.target);return {correct:p.time===round.pingTime+round.cooldown&&identity&&p.spell===canonical,expected:round.pingTime+round.cooldown,parsed:p}}
 return {roles,spellData,aliases,roleAliases,norm,pick,format,cooldown,secondarySpell,trinket,draft,isTeleport,teleportAt,safeTeleportTime,upgradeTeleports,inspectCooldown,parse,evaluate};
})();
