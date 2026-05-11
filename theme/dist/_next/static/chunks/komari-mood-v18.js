(function(){
"use strict";
var css=document.createElement("style");
css.textContent="\
.ds-hdr2-left.komari-two-row{display:grid!important;grid-template-columns:auto 1fr;grid-template-rows:auto auto;align-items:center;column-gap:6px;row-gap:1px}\
.ds-hdr2-left.komari-two-row .ds-hdr-flag{grid-row:1/3;align-self:center}\
.ds-hdr2-left.komari-two-row .ds-hdr-name{grid-column:2;grid-row:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.komari-mood-row{grid-column:2;grid-row:2;display:flex;align-items:center;gap:4px;font-size:12px;line-height:1;opacity:0;transition:opacity .3s ease}\
.komari-mood-row.komari-visible{opacity:1}\
.komari-mood-row .komari-lv{font-size:9px;color:#fff;padding:1px 4px;border-radius:3px;font-weight:600;line-height:1.3;cursor:default}\
.komari-lv-1{background:#94a3b8}\
.komari-lv-2{background:linear-gradient(135deg,#4ade80,#22c55e)}\
.komari-lv-3{background:linear-gradient(135deg,#38bdf8,#0ea5e9)}\
.komari-lv-4{background:linear-gradient(135deg,#818cf8,#6366f1)}\
.komari-lv-5{background:linear-gradient(135deg,#a78bfa,#7c3aed)}\
.komari-lv-6{background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1e293b}\
.komari-xp-mini{display:inline-block;width:28px;height:2.5px;background:rgba(148,163,184,.25);border-radius:2px;overflow:hidden;vertical-align:middle;margin-left:2px}\
.komari-xp-mini-fill{display:block;height:100%;border-radius:2px;background:linear-gradient(90deg,#22c55e,#3b82f6)}\
.komari-mood-emoji{cursor:default;font-size:13px}\
.komari-inject-divider{border:none;border-top:1px dashed rgba(148,163,184,.3);margin:8px 0 6px;grid-column:1/-1}\
.komari-inject-title{font-size:11px;font-weight:600;color:var(--foreground,#333);opacity:.7;grid-column:1/-1;margin-bottom:2px}\
";
document.head.appendChild(css);

var LS_PER="komari-mood-per-server";
var globalSettings={showMoodSystem:true,showLevelSystem:true};
var perServer={};
function loadPerServer(){try{var s=localStorage.getItem(LS_PER);if(s)perServer=JSON.parse(s);}catch(e){}}
function savePerServer(){try{localStorage.setItem(LS_PER,JSON.stringify(perServer));}catch(e){}}
function getServerSettings(uuid){
  if(!globalSettings.showMoodSystem&&!globalSettings.showLevelSystem) return{showMood:false,showLevel:false};
  var ps=perServer[uuid];
  if(!ps) return{showMood:globalSettings.showMoodSystem,showLevel:globalSettings.showLevelSystem};
  return{showMood:globalSettings.showMoodSystem&&ps.showMood!==false,showLevel:globalSettings.showLevelSystem&&ps.showLevel!==false};
}
function loadGlobalSettings(){
  fetch("/api/public").then(function(r){return r.json()}).then(function(data){
    var ts=data&&data.data&&data.data.theme_settings||{};
    if(typeof ts.showMoodSystem==="boolean") globalSettings.showMoodSystem=ts.showMoodSystem;
    else if(ts.showMoodSystem==="false") globalSettings.showMoodSystem=false;
    if(typeof ts.showLevelSystem==="boolean") globalSettings.showLevelSystem=ts.showLevelSystem;
    else if(ts.showLevelSystem==="false") globalSettings.showLevelSystem=false;
  }).catch(function(){});
}

var moodCache={};
function getMood(cpu,mem,isOnline){
  if(!isOnline)return{emoji:"\u{1F480}",tip:"\u79BB\u7EBF"};
  if(cpu>90||mem>95)return{emoji:"\u{1F630}",tip:"CPU "+cpu.toFixed(1)+"% / Mem "+mem.toFixed(1)+"%"};
  if(cpu>80||mem>85)return{emoji:"\u{1F630}",tip:"CPU "+cpu.toFixed(1)+"% / Mem "+mem.toFixed(1)+"%"};
  if(cpu>50||mem>70)return{emoji:"\u{1F624}",tip:"CPU "+cpu.toFixed(1)+"% / Mem "+mem.toFixed(1)+"%"};
  if(cpu>15||mem>40)return{emoji:"\u{1F60A}",tip:"CPU "+cpu.toFixed(1)+"% / Mem "+mem.toFixed(1)+"%"};
  if(cpu>3||mem>20)return{emoji:"\u{1F60C}",tip:"CPU "+cpu.toFixed(1)+"% / Mem "+mem.toFixed(1)+"%"};
  return{emoji:"\u{1F634}",tip:"CPU "+cpu.toFixed(1)+"% / Mem "+mem.toFixed(1)+"%"};
}
var LEVELS=[
  {min:0,name:"Lv1",title:"\u65B0\u751F",cls:"komari-lv-1"},
  {min:7,name:"Lv2",title:"\u5E7C\u82D7",cls:"komari-lv-2"},
  {min:30,name:"Lv3",title:"\u6210\u957F",cls:"komari-lv-3"},
  {min:90,name:"Lv4",title:"\u8301\u58EE",cls:"komari-lv-4"},
  {min:180,name:"Lv5",title:"\u8001\u5C06",cls:"komari-lv-5"},
  {min:365,name:"Lv6",title:"\u4F20\u8BF4",cls:"komari-lv-6"}
];
function getLevel(days){
  var lv=LEVELS[0];for(var i=LEVELS.length-1;i>=0;i--){if(days>=LEVELS[i].min){lv=LEVELS[i];break;}}
  var idx=LEVELS.indexOf(lv);var next=LEVELS[idx+1];
  var pct=next?Math.min(100,((days-lv.min)/(next.min-lv.min))*100):100;
  var tip=lv.name+" "+lv.title+" | "+days+"\u5929";
  if(next) tip+=" | \u4E0B\u4E00\u7EA7:"+next.title+"("+next.min+"\u5929)";
  return{name:lv.name,pct:pct,tip:tip,cls:lv.cls};
}
function parseUptime(card){
  var items=card.querySelectorAll(".ds-fi");
  for(var i=0;i<items.length;i++){
    var label=items[i].querySelector(".ds-fi-label");
    var val=items[i].querySelector(".ds-fi-val");
    if(label&&val){
      var lt=(label.textContent||"").trim();
      if(lt==="\u8FD0\u884C\u65F6\u95F4"||lt.toLowerCase()==="uptime"){
        var dm=(val.textContent||"").match(/(\d+)\s*[dD\u5929\u65E5]/);
        if(dm) return parseInt(dm[1]);
      }
    }
  }
  return 0;
}
function getCardUuid(card){
  var link=card.querySelector(".ds-hdr-name");
  if(link){var m=(link.getAttribute("href")||"").match(/instance\/(.+)/);if(m)return m[1];}
  return null;
}
function fetchMoodData(){
  var cards=document.querySelectorAll(".ds-card2");
  cards.forEach(function(card){
    var uuid=getCardUuid(card);if(!uuid)return;
    if(card.classList.contains("ds-card2-off")){moodCache[uuid]={cpu:0,mem:0,online:false,ready:true};return;}
    fetch("/api/recent/"+uuid).then(function(r){return r.json()}).then(function(data){
      var records=data.data||[];
      if(!records.length){moodCache[uuid]={cpu:0,mem:0,online:true,ready:false};return;}
      var cpuSum=0,memSum=0,count=0;
      records.forEach(function(r){if(r.cpu&&r.ram){cpuSum+=r.cpu.usage||0;memSum+=r.ram.total>0?((r.ram.used||0)/r.ram.total*100):0;count++;}});
      if(count>0) moodCache[uuid]={cpu:cpuSum/count,mem:memSum/count,online:true,ready:true};
    }).catch(function(){});
  });
}
function renderMoods(){
  var cards=document.querySelectorAll(".ds-card2");
  cards.forEach(function(card){
    var uuid=getCardUuid(card);if(!uuid)return;
    var cached=moodCache[uuid];var ss=getServerSettings(uuid);
    var hdrLeft=card.querySelector(".ds-hdr2-left");if(!hdrLeft)return;
    var hasContent=ss.showMood||ss.showLevel;
    var row=hdrLeft.querySelector(".komari-mood-row");
    if(!hasContent){if(row)row.remove();hdrLeft.classList.remove("komari-two-row");return;}
    hdrLeft.classList.add("komari-two-row");
    if(!row){row=document.createElement("div");row.className="komari-mood-row";hdrLeft.appendChild(row);setTimeout(function(){row.classList.add("komari-visible");},50);}
    if(!cached||!cached.ready){row.innerHTML="";return;}
    var days=parseUptime(card);var mood=getMood(cached.cpu,cached.mem,cached.online);var lv=getLevel(days);
    var html="";
    if(ss.showMood) html+="<span class=\"komari-mood-emoji\" title=\""+mood.tip+"\">"+mood.emoji+"</span>";
    if(ss.showLevel) html+="<span class=\"komari-lv "+lv.cls+"\" title=\""+lv.tip+"\">"+lv.name+"</span><span class=\"komari-xp-mini\"><span class=\"komari-xp-mini-fill\" style=\"width:"+lv.pct+"%\"></span></span>";
    if(row.innerHTML!==html) row.innerHTML=html;
  });
}

/* ===== Gear panel ===== */
function injectGearPanel(){
  var panels=document.querySelectorAll(".ds-card-settings-panel");
  panels.forEach(function(panel){
    if(panel.querySelector(".komari-mood-injected")) return;
    var card=panel.closest(".ds-card2");if(!card) return;
    var uuid=getCardUuid(card);if(!uuid) return;
    var grid=panel.querySelector(".ds-card-settings-grid");if(!grid) return;
    var ss=getServerSettings(uuid);
    var d=document.createElement("hr");d.className="komari-inject-divider komari-mood-injected";grid.appendChild(d);
    var t=document.createElement("div");t.className="komari-inject-title";t.textContent="\u5FC3\u60C5\u4E0E\u517B\u6210";grid.appendChild(t);
    var ml=document.createElement("label");ml.className="ds-card-settings-option";
    var mc=document.createElement("input");mc.type="checkbox";mc.checked=ss.showMood;mc.disabled=!globalSettings.showMoodSystem;
    mc.onchange=function(){if(!perServer[uuid])perServer[uuid]={showMood:true,showLevel:true};perServer[uuid].showMood=mc.checked;savePerServer();renderMoods();};
    var ms=document.createElement("span");ms.textContent="\u5FC3\u60C5\u8868\u60C5"+(globalSettings.showMoodSystem?"":"\uFF08\u5168\u5C40\u5DF2\u5173\uFF09");
    ml.appendChild(mc);ml.appendChild(ms);grid.appendChild(ml);
    var ll=document.createElement("label");ll.className="ds-card-settings-option";
    var lc=document.createElement("input");lc.type="checkbox";lc.checked=ss.showLevel;lc.disabled=!globalSettings.showLevelSystem;
    lc.onchange=function(){if(!perServer[uuid])perServer[uuid]={showMood:true,showLevel:true};perServer[uuid].showLevel=lc.checked;savePerServer();renderMoods();};
    var ls=document.createElement("span");ls.textContent="\u7B49\u7EA7\u5FBD\u7AE0"+(globalSettings.showLevelSystem?"":"\uFF08\u5168\u5C40\u5DF2\u5173\uFF09");
    ll.appendChild(lc);ll.appendChild(ls);grid.appendChild(ll);
  });
}

/* ===== Asset Calculator - Unpriced box ===== */
var unpricedCache={count:0,names:[],ready:false};
function fetchUnpricedNodes(){
  fetch("/api/nodes").then(function(r){return r.json()}).then(function(data){
    var nodes=(data&&data.data)||[];if(!Array.isArray(nodes))return;
    var unpriced=[];
    nodes.forEach(function(n){
      var p=Number(n.price);
      if(p===-1) return; // free, intentional
      if(!Number.isFinite(p)||p<=0) unpriced.push(n.name||n.uuid||"?");
    });
    unpricedCache={count:unpriced.length,names:unpriced,ready:true};
  }).catch(function(){});
}

function tryInjectAssetCalcBox(){
  if(!unpricedCache.ready||unpricedCache.count===0) return false;
  // The asset calculator popover has a grid with class "grid grid-cols-2"
  // containing boxes with text like "服务器数量", "总价值", "月均支出", "剩余总价值"
  // We find it by looking for a grid-cols-2 container that has "服务器数量" text
  var grids=document.querySelectorAll('[class*="grid-cols-2"]');
  for(var i=0;i<grids.length;i++){
    var g=grids[i];
    if(g.querySelector(".komari-unpriced-box")) return true;
    var text=g.textContent||"";
    if(text.indexOf("\u670D\u52A1\u5668\u6570\u91CF")===-1) continue;
    if(text.indexOf("\u603B\u4EF7\u503C")===-1) continue;
    // Found the asset calculator stats grid
    // Add a 5th box for "未分类"
    var box=document.createElement("div");
    box.className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-700/40 px-3 py-3 text-center flex flex-col items-center justify-center min-h-[72px] komari-unpriced-box";
    box.title="\u672A\u8BBE\u7F6E\u4EF7\u683C\u7684\u8282\u70B9:\n"+unpricedCache.names.join("\n");
    box.innerHTML='<div class="text-[11px] text-amber-600 dark:text-amber-400 mb-1">\u672A\u5206\u7C7B</div><div class="text-lg font-semibold text-amber-700 dark:text-amber-300">'+unpricedCache.count+'</div>';
    g.appendChild(box);
    return true;
  }
  return false;
}

/* ===== Click handler ===== */
var assetPollId=null;
function handleClick(){
  setTimeout(injectGearPanel,150);
  setTimeout(injectGearPanel,400);
  // Poll for asset calculator popover
  if(assetPollId) clearInterval(assetPollId);
  var attempts=0;
  assetPollId=setInterval(function(){
    attempts++;
    if(tryInjectAssetCalcBox()||attempts>15){clearInterval(assetPollId);assetPollId=null;}
  },300);
}

/* ===== Init ===== */
function init(){
  loadPerServer();
  loadGlobalSettings();
  fetchMoodData();
  fetchUnpricedNodes();
  setTimeout(renderMoods,3000);
  setTimeout(renderMoods,6000);
  setInterval(renderMoods,10000);
  setInterval(function(){loadGlobalSettings();fetchMoodData();fetchUnpricedNodes();},3600000);
  document.addEventListener("click",handleClick,true);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,2000);});
else setTimeout(init,2000);
window.addEventListener("load",function(){setTimeout(init,3000);});
})();
