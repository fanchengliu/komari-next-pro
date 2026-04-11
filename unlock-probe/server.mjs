import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 19116);
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5 * 24 * 60 * 60 * 1000);
const COOLDOWN_MS = Number(process.env.COOLDOWN_MS || 5 * 60 * 1000);
const KOMARI_BASE = process.env.KOMARI_BASE || 'http://127.0.0.1:25774';
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const THEME_PRO_CONFIG_FILE = path.join(DATA_DIR, 'theme-pro-config.json');
const LOG_FILE = path.join(DATA_DIR, 'logs.jsonl');
const VERSION = '0.2.0';

const cache = new Map();
const inFlight = new Map();
const DEFAULT_CONFIG = { enabledAll: true, disabledNodeUuids: [], autoRunDays: 5, showIPv6: true };
const DEFAULT_THEME_PRO_CONFIG = { nodeCardVisibilityByUuid: {} };
function readThemeProConfig(){ return { ...DEFAULT_THEME_PRO_CONFIG, ...readJsonFile(THEME_PRO_CONFIG_FILE,{}) }; }
function writeThemeProConfig(config){ const clean={ nodeCardVisibilityByUuid: (config && typeof config.nodeCardVisibilityByUuid==='object' && !Array.isArray(config.nodeCardVisibilityByUuid)) ? config.nodeCardVisibilityByUuid : {} }; writeJsonFile(THEME_PRO_CONFIG_FILE, clean); return clean; }

function ensureDataDir(){ fs.mkdirSync(DATA_DIR,{recursive:true}); }
function readJsonFile(file, fallback){ try{ ensureDataDir(); if(!fs.existsSync(file)) return fallback; return JSON.parse(fs.readFileSync(file,'utf8')); }catch{ return fallback; } }
function writeJsonFile(file, data){ ensureDataDir(); fs.writeFileSync(file, JSON.stringify(data,null,2)); }
function readConfig(){ return { ...DEFAULT_CONFIG, ...readJsonFile(CONFIG_FILE, {}) }; }
function writeConfig(config){ const clean={ enabledAll: config.enabledAll !== false, disabledNodeUuids: Array.isArray(config.disabledNodeUuids)?config.disabledNodeUuids.map(String):[], autoRunDays: Number(config.autoRunDays)||5, showIPv6: config.showIPv6 !== false }; writeJsonFile(CONFIG_FILE, clean); return clean; }
function loadResults(){ const obj=readJsonFile(RESULTS_FILE,{}); for(const [k,v] of Object.entries(obj)) cache.set(k,v); }
function saveResults(){ const obj={}; for(const [k,v] of cache.entries()) obj[k]=v; writeJsonFile(RESULTS_FILE,obj); }
function appendLog(entry){ ensureDataDir(); const row={time:new Date().toISOString(),...entry}; fs.appendFileSync(LOG_FILE, JSON.stringify(row)+'\n'); }
function readLogs(limit=100){ try{ ensureDataDir(); if(!fs.existsSync(LOG_FILE)) return []; const lines=fs.readFileSync(LOG_FILE,'utf8').trim().split(/\n+/).filter(Boolean); return lines.slice(-limit).map(l=>{try{return JSON.parse(l)}catch{return {raw:l}}}); }catch{return []} }
function maskResults(results=[]){ return results.map(r => ({ key:r.key, name:r.name, status:'pending', statusText:'***', region:'***', type:'masked', typeText:'***', detail:'***' })); }
loadResults();

function json(res, code, data) { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}); res.end(JSON.stringify(data)); }
function collectBody(req) { return new Promise((resolve,reject)=>{ let raw=''; req.on('data',c=>{raw+=c;if(raw.length>1024*1024)req.destroy()}); req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch(e){reject(e)}}); req.on('error',reject); }); }
function getCookie(req){ return req.headers.cookie || ''; }
async function isLoggedIn(req){ const cookie=getCookie(req); if(!cookie.includes('session_token=')) return false; try{ const res=await fetch(`${KOMARI_BASE}/api/me`,{headers:{Cookie:cookie}}); if(!res.ok) return false; const me=await res.json(); return !!me?.logged_in; }catch{return false} }
async function getNodeList(req){ const res=await fetch(`${KOMARI_BASE}/api/admin/client/list`,{headers:{Cookie:getCookie(req)}}); if(!res.ok) throw new Error(`komari client list failed: ${res.status}`); return await res.json(); }
async function getNodeCapability(req, uuid){ const list=await getNodeList(req); const nodes=Array.isArray(list)?list:(list?.data||[]); const node=nodes.find(n=>n.uuid===uuid); if(!node) return {uuid,found:false,hasIPv4:false,hasIPv6:false}; return {uuid,found:true,name:node.name||'',hasIPv4:!!String(node.ipv4||'').trim(),hasIPv6:!!String(node.ipv6||'').trim(),ipv4:node.ipv4||'',ipv6:node.ipv6||''}; }

function parseThemeTokens(raw='') { return String(raw||'').split(/[\n,，;；、]+/).map(x=>x.trim().toLowerCase()).filter(Boolean); }
function nodeMatchesTokens(node, tokens) { const name=String(node.name||'').toLowerCase(); const uuid=String(node.uuid||'').toLowerCase(); return tokens.some(t=>name.includes(t)||uuid.includes(t)); }
async function getThemeStreamSettings(req) {
  const res = await fetch(`${KOMARI_BASE}/api/public`, { headers: { Cookie: getCookie(req) } });
  const pub = await res.json().catch(()=>({}));
  const ts = pub?.data?.theme_settings || {};
  return {
    enabled: ts['streamUnlock.enabled'] !== false,
    mode: ts['streamUnlock.mode'] || 'all',
    nodeMatchList: ts['streamUnlock.nodeMatchList'] || ts['streamUnlock.includeNodes'] || '',
    showIPv6: ts['streamUnlock.showIPv6'] !== false,
  };
}

async function getOnlineSet(req) {
  try {
    const res = await fetch(`${KOMARI_BASE}/api/rpc2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: getCookie(req) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'common:getNodesLatestStatus', params: {} }),
    });
    const data = await res.json();
    const result = data?.result || {};
    return new Set(Object.values(result).filter(v => v?.online).map(v => v.client));
  } catch { return null; }
}
function themeAllowsNode(node, settings) {
  const tokens=parseThemeTokens(settings.nodeMatchList);
  const matched=nodeMatchesTokens(node,tokens);
  if(settings.mode==='off') return false;
  if(settings.mode==='all') return true;
  if(settings.mode==='include') return matched;
  if(settings.mode==='exclude') return !matched;
  return true;
}
function isNodeOnline(node) {
  // Conservative backend fallback: Komari admin list does not include explicit online.
  // Treat recent reports within 10 minutes as online. Frontend still has stricter live state for manual button.
  const t = Date.parse(node.updated_at || node.updatedAt || '');
  return Number.isFinite(t) && (Date.now() - t) <= Number(process.env.ONLINE_THRESHOLD_MS || 10*60*1000);
}
function runProbe(uuid,family='4'){ return new Promise((resolve,reject)=>{ const child=spawn('/usr/local/bin/node',['/app/komari-run-once.mjs',uuid,family],{cwd:'/app',env:process.env,stdio:['ignore','pipe','pipe']}); let out='',err=''; const timer=setTimeout(()=>{child.kill('SIGTERM'); reject(new Error('probe timeout'))},180000); child.stdout.on('data',d=>out+=d.toString()); child.stderr.on('data',d=>err+=d.toString()); child.on('error',e=>{clearTimeout(timer); reject(e)}); child.on('close',code=>{clearTimeout(timer); if(code!==0) return reject(new Error(`probe exited ${code}: ${err||out}`)); try{resolve(JSON.parse(out))}catch(e){reject(new Error(`invalid probe json: ${e.message}; out=${out}; err=${err}`))}}); }); }

async function executeProbe({req, uuid, family='4', useCache=true, force=false}){
  const cap = await getNodeCapability(req, uuid);
  if(!cap.found) return {code:404, body:{ok:false,error:'node_not_found'}};
  const cfg=readConfig();
  if((cfg.disabledNodeUuids||[]).includes(uuid)) return {code:403, body:{ok:false,error:'stream_unlock_disabled_for_node'}};
  if(family==='6' && cfg.showIPv6===false) return {code:200, body:{ok:true,uuid,family,skipped:true,reason:'ipv6_disabled',results:[]}};
  if(family==='4' && !cap.hasIPv4) return {code:200, body:{ok:true,uuid,family,skipped:true,reason:'node_has_no_ipv4',results:[]}};
  if(family==='6' && !cap.hasIPv6) return {code:200, body:{ok:true,uuid,family,skipped:true,reason:'node_has_no_ipv6',results:[]}};
  const cacheKey=`${uuid}:${family}`;
  const cached=cache.get(cacheKey);
  const now=Date.now();
  if(useCache && cached && now-cached.ts<CACHE_TTL_MS) return {code:200, body:{ok:true,uuid,family,cached:true,updatedAt:new Date(cached.ts).toISOString(),results:cached.results}};
  if(!force && cached && now-cached.ts<COOLDOWN_MS) return {code:429, body:{ok:false,error:'cooldown',retryAfter:Math.ceil((COOLDOWN_MS-(now-cached.ts))/1000),updatedAt:new Date(cached.ts).toISOString(),results:cached.results}};
  if(!inFlight.has(cacheKey)) {
    appendLog({event:'probe_start',uuid,family,node:cap.name});
    inFlight.set(cacheKey, runProbe(uuid,family).finally(()=>inFlight.delete(cacheKey)));
  }
  const result=await inFlight.get(cacheKey);
  const item={ts:Date.now(),results:result.results||[],node:cap.name,family};
  cache.set(cacheKey,item); saveResults();
  appendLog({event:'probe_done',uuid,family,node:cap.name,count:item.results.length});
  return {code:200, body:{ok:true,uuid,family:result.family||family,cached:false,updatedAt:new Date(item.ts).toISOString(),results:item.results}};
}

const server=http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS') return json(res,200,{ok:true});
  const url=new URL(req.url,`http://${req.headers.host}`);
  if(url.pathname==='/healthz') return json(res,200,{ok:true,service:'komari-unlock-probe'});
  if(url.pathname==='/status') return json(res,200,{ok:true,version:VERSION,cacheItems:cache.size,runningTasks:inFlight.size,lastLogs:readLogs(5),komariBase:KOMARI_BASE});
  if(url.pathname==='/logs') { if(!(await isLoggedIn(req))) return json(res,401,{ok:false,error:'login_required'}); return json(res,200,{ok:true,logs:readLogs(Number(url.searchParams.get('limit')||100))}); }
  if(url.pathname==='/unlock/capability-public'&&req.method==='GET'){
    const uuid=url.searchParams.get('uuid');
    if(!uuid) return json(res,400,{ok:false,error:'missing uuid'});
    try{
      // Use internal Komari API through configured admin path when possible; this endpoint only exposes booleans.
      const cookie = getCookie(req);
      let cap;
      if(cookie && cookie.includes('session_token=')) cap = await getNodeCapability(req, uuid);
      else {
        // Fallback: read from public theme/node data is not available here; use cached results if present.
        // To avoid leaking IP, only infer from known cache keys.
        cap = { uuid, found:true, hasIPv4: cache.has(`${uuid}:4`), hasIPv6: cache.has(`${uuid}:6`) };
      }
      return json(res,200,{ok:true,uuid,found:!!cap.found,hasIPv4:!!cap.hasIPv4,hasIPv6:!!cap.hasIPv6});
    }catch(err){return json(res,500,{ok:false,error:err?.message||String(err)})}
  }

  if(url.pathname==='/unlock/capability'&&req.method==='GET'){ const uuid=url.searchParams.get('uuid'); if(!uuid) return json(res,400,{ok:false,error:'missing uuid'}); if(!(await isLoggedIn(req))) return json(res,401,{ok:false,error:'login_required'}); try{return json(res,200,{ok:true,...(await getNodeCapability(req,uuid))})}catch(err){return json(res,500,{ok:false,error:err?.message||String(err)})} }
  if(url.pathname==='/nodes'&&req.method==='GET'){ if(!(await isLoggedIn(req))) return json(res,401,{ok:false,error:'login_required'}); try{ const list=await getNodeList(req); const nodes=Array.isArray(list)?list:(list?.data||[]); return json(res,200,{ok:true,nodes:nodes.map(n=>({uuid:n.uuid,name:n.name,hasIPv4:!!String(n.ipv4||'').trim(),hasIPv6:!!String(n.ipv6||'').trim()}))}); }catch(err){return json(res,500,{ok:false,error:err?.message||String(err)})} }
  if(url.pathname==='/config'&&req.method==='GET'){ if(!(await isLoggedIn(req))) return json(res,401,{ok:false,error:'login_required'}); return json(res,200,{ok:true,config:readConfig()}); }
  if(url.pathname==='/config'&&req.method==='POST'){ if(!(await isLoggedIn(req))) return json(res,401,{ok:false,error:'login_required'}); try{const body=await collectBody(req); return json(res,200,{ok:true,config:writeConfig(body)});}catch(err){return json(res,500,{ok:false,error:err?.message||String(err)})} }

  if(url.pathname==='/run-all' && req.method==='POST'){
    try{
      if(!(await isLoggedIn(req))) return json(res,401,{ok:false,error:'login_required'});
      const cfg=readConfig();
      const themeSettings=await getThemeStreamSettings(req);
      if(themeSettings.enabled===false || themeSettings.mode==='off') return json(res,200,{ok:true,total:0,results:[],skipped:[{reason:'stream_unlock_off'}]});
      const list=await getNodeList(req);
      const nodes=Array.isArray(list)?list:(list?.data||[]);
      const onlineSet=await getOnlineSet(req);
      const summary=[]; const skipped=[];
      for(const node of nodes){
        const uuid=node.uuid; const name=node.name||uuid;
        if((cfg.disabledNodeUuids||[]).includes(uuid)){ skipped.push({uuid,name,reason:'disabled_in_probe_config'}); continue; }
        if(!themeAllowsNode(node, themeSettings)){ skipped.push({uuid,name,reason:'filtered_by_theme_settings'}); continue; }
        if(onlineSet && !onlineSet.has(uuid)){ skipped.push({uuid,name,reason:'node_offline'}); continue; }
        if(!onlineSet && !isNodeOnline(node)){ skipped.push({uuid,name,reason:'node_offline'}); continue; }
        const item={uuid,name,families:{}};
        if(String(node.ipv4||'').trim()){
          const r=await executeProbe({req,uuid,family:'4',useCache:true,force:false});
          item.families.ipv4={code:r.code, ok:r.body.ok, cached:r.body.cached||false, skipped:r.body.skipped||false, error:r.body.error||null, updatedAt:r.body.updatedAt||null};
        } else item.families.ipv4={skipped:true,reason:'node_has_no_ipv4'};
        if(themeSettings.showIPv6 && cfg.showIPv6!==false && String(node.ipv6||'').trim()){
          const r=await executeProbe({req,uuid,family:'6',useCache:true,force:false});
          item.families.ipv6={code:r.code, ok:r.body.ok, cached:r.body.cached||false, skipped:r.body.skipped||false, error:r.body.error||null, updatedAt:r.body.updatedAt||null};
        } else item.families.ipv6={skipped:true,reason: themeSettings.showIPv6 && cfg.showIPv6!==false ? 'node_has_no_ipv6':'ipv6_disabled'};
        summary.push(item);
      }
      appendLog({event:'run_all_done',total:nodes.length,processed:summary.length,skipped:skipped.length});
      return json(res,200,{ok:true,total:nodes.length,processed:summary.length,skipped,results:summary,concurrency:1});
    }catch(err){appendLog({event:'run_all_error',error:err?.message||String(err)}); return json(res,500,{ok:false,error:err?.message||String(err)});}
  }

  if(url.pathname==='/theme-config'&&req.method==='GET'){
    return json(res,200,{ok:true,config:readThemeProConfig()});
  }
  if(url.pathname==='/theme-config'&&req.method==='POST'){
    if(!(await isLoggedIn(req))) return json(res,401,{ok:false,error:'login_required'});
    try{const body=await collectBody(req); return json(res,200,{ok:true,config:writeThemeProConfig(body)});}catch(err){return json(res,500,{ok:false,error:err?.message||String(err)})}
  }

  if(url.pathname==='/unlock/latest'&&req.method==='GET'){ const uuid=url.searchParams.get('uuid'); const family=url.searchParams.get('family')||'4'; if(!uuid) return json(res,400,{ok:false,error:'missing uuid'}); const item=cache.get(`${uuid}:${family}`); if(!item) return json(res,200,{ok:true,uuid,family,cached:false,updatedAt:null,results:[]}); const logged=await isLoggedIn(req); return json(res,200,{ok:true,uuid,family,cached:true,updatedAt:new Date(item.ts).toISOString(),masked:!logged,results: logged ? item.results : maskResults(item.results)}); }
  if(url.pathname==='/unlock/run'&&req.method==='POST'){ try{ if(!(await isLoggedIn(req))) return json(res,401,{ok:false,error:'login_required'}); const body=await collectBody(req); const uuid=String(body.uuid||'').trim(); const family=String(body.family||'4'); if(!uuid) return json(res,400,{ok:false,error:'missing uuid'}); const out=await executeProbe({req,uuid,family,useCache:body.useCache!==false,force:body.force===true}); return json(res,out.code,out.body); }catch(err){appendLog({event:'probe_error',error:err?.message||String(err)}); return json(res,500,{ok:false,error:err?.message||String(err)})} }
  return json(res,404,{ok:false,error:'not_found'});
});
server.listen(PORT,HOST,()=>console.log(`komari-unlock-probe ${VERSION} listening on http://${HOST}:${PORT}`));
