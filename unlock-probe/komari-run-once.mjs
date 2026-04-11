import fs from 'node:fs';
const BASE=process.env.KOMARI_BASE||'http://127.0.0.1:25774';
const WS=BASE.replace(/^http/,'ws');
const username=process.env.KOMARI_USER||'lfc';
const password=process.env.KOMARI_PASS||'change-me';
const uuid=process.argv[2];
const family=process.argv[3] || '4';
if(!uuid) throw new Error('usage: node komari-run-once.mjs <uuid> [4|6]');
const marker='OCM_'+Date.now()+'_'+Math.random().toString(36).slice(2);
const probePath=new URL('./probe-lite.sh', import.meta.url);
let script=fs.readFileSync(probePath,'utf8').replaceAll('MARKER',marker);
script = 'set -- '+JSON.stringify(family)+'\n' + script;
const b64=Buffer.from(script).toString('base64');
const command=`printf ${JSON.stringify(b64)} | base64 -d | bash`;
async function login(){const res=await fetch(`${BASE}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const text=await res.text();if(!res.ok)throw new Error(text);const m=(res.headers.get('set-cookie')||'').match(/session_token=([^;]+)/);if(!m)throw new Error('no cookie');return m[1];}
async function toText(d){if(typeof d==='string')return d;if(d instanceof Blob)return new TextDecoder().decode(await d.arrayBuffer());return Buffer.from(d).toString('utf8')}
function strip(s){return s.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g,'').replace(/\r/g,'')}
async function run(token){return new Promise((resolve,reject)=>{const ws=new WebSocket(`${WS}/api/admin/client/${uuid}/terminal`,{headers:{Cookie:`session_token=${token}`,Origin:BASE}});let clean='',cap='',sent=false,completed=false;const timer=setTimeout(()=>{try{ws.close()}catch{};reject(new Error('timeout '+clean.slice(-1500)))},150000);ws.addEventListener('message',async ev=>{const txt=await toText(ev.data);const c=strip(txt);clean+=c;if(!sent&&(/root@[^#]+#\s*$/.test(clean)||clean.includes('/opt/komari#'))){sent=true;setTimeout(()=>ws.send(new TextEncoder().encode(command+'\r')),300);return}if(sent){cap+=c;const b=cap.indexOf(`${marker}_BEGIN`), e=cap.indexOf(`${marker}_END`, b>=0?b:0);if(b>=0&&e>=0){completed=true;clearTimeout(timer);try{ws.close()}catch{};resolve(cap.slice(b+`${marker}_BEGIN`.length,e).trim())}}});ws.addEventListener('error',ev=>{clearTimeout(timer);reject(new Error('ws error '+(ev.message||ev.error||ev)))});ws.addEventListener('close',ev=>{if(!completed){clearTimeout(timer);reject(new Error(`closed ${ev.code} ${ev.reason} `+clean.slice(-1500)))}})})}
const token=await login();
const out=await run(token);
const results=[];
for(const line of out.split(/\n+/).map(s=>s.trim()).filter(Boolean)) { try { results.push(JSON.parse(line)); } catch { results.push({key:'parse_error',status:'error',detail:line}); } }
console.log(JSON.stringify({ok:true,uuid,family,results}, null, 2));
