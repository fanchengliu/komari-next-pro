(function(){
"use strict";

/* ===== CSS ===== */
var css=document.createElement("style");
css.textContent="\
.ds-hdr2-left{display:grid!important;grid-template-columns:auto 1fr;grid-template-rows:auto auto;align-items:center;column-gap:6px;row-gap:1px}\
.ds-hdr2-left .ds-hdr-flag{grid-row:1/3;align-self:center}\
.ds-hdr2-left .ds-hdr-name{grid-column:2;grid-row:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.komari-mood-row{grid-column:2;grid-row:2;display:flex;align-items:center;gap:4px;font-size:12px;line-height:1;min-height:16px;opacity:0;transition:opacity .3s ease}\
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

/* ===== Settings ===== */
var LS_GLOBAL="komari-mood-global";
var LS_PER="komari-mood-per-server";

// Global settings (from backend theme_settings, overridable in backend)
var globalSettings={showMoodSystem:true,showLevelSystem:true};
// Per-server overrides: {uuid: {showMood:bool, showLevel:bool}}
var perServer={};

function loadPerServer(){
  try{var s=localStorage.getItem(LS_PER);if(s)perServer=JSON.parse(s);}catch(e){}
}
function savePerServer(){
  try{localStorage.setItem(LS_PER,JSON.stringify(perServer));}catch(e){}
}
function getServerSettings(uuid){
  if(!globalSettings.showMoodSystem&&!globalSettings.showLevelSystem) return{showMood:false,showLevel:false};
  var ps=perServer[uuid];
  if(!ps) return{showMood:globalSettings.showMoodSystem,showLevel:globalSettings.showLevelSystem};
  return{
    showMood:globalSettings.showMoodSystem&&ps.showMood!==false,
    showLevel:globalSettings.showLevelSystem&&ps.showLevel!==false
  };
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

/* ===== Mood logic ===== */
var moodCache={};

function getMood(cpu,mem,isOnline){
  if(!isOnline)return{emoji:"\u{1F480}",tip:"\u72B6\u6001: \u79BB\u7EBF"};
  if(cpu>90||mem>95)return{emoji:"\u{1F630}",tip:"\u72B6\u6001: \u5371\u9669 (CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  if(cpu>80||mem>85)return{emoji:"\u{1F630}",tip:"\u72B6\u6001: \u7D27\u5F20 (CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  if(cpu>50||mem>70)return{emoji:"\u{1F624}",tip:"\u72B6\u6001: \u5FD9\u788C (CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  if(cpu>15||mem>40)return{emoji:"\u{1F60A}",tip:"\u72B6\u6001: \u6B63\u5E38 (CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  if(cpu>3||mem>20)return{emoji:"\u{1F60C}",tip:"\u72B6\u6001: \u60A0\u95F2 (CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  return{emoji:"\u{1F634}",tip:"\u72B6\u6001: \u7761\u89C9 (CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
}

var LEVELS=[
  {min:0,emoji:"\u{1F952}",name:"Lv1",title:"\u65B0\u751F",cls:"komari-lv-1"},
  {min:7,emoji:"\u{1F331}",name:"Lv2",title:"\u5E7C\u82D7",cls:"komari-lv-2"},
  {min:30,emoji:"\u{1F33F}",name:"Lv3",title:"\u6210\u957F",cls:"komari-lv-3"},
  {min:90,emoji:"\u{1F333}",name:"Lv4",title:"\u8301\u58EE",cls:"komari-lv-4"},
  {min:180,emoji:"\u{1F3D4}\uFE0F",name:"Lv5",title:"\u8001\u5C06",cls:"komari-lv-5"},
  {min:365,emoji:"\u2B50",name:"Lv6",title:"\u4F20\u8BF4",cls:"komari-lv-6"}
];

function getLevel(days){
  var lv=LEVELS[0];
  for(var i=LEVELS.length-1;i>=0;i--){if(days>=LEVELS[i].min){lv=LEVELS[i];break;}}
  var idx=LEVELS.indexOf(lv);var next=LEVELS[idx+1];
  var pct=next?Math.min(100,((days-lv.min)/(next.min-lv.min))*100):100;
  var tip=lv.name+" "+lv.title+" | \u8FD0\u884C "+days+" \u5929";
  if(next) tip+=" | \u4E0B\u4E00\u7EA7: "+next.title+"("+next.min+"\u5929)";
  else tip+=" | \u5DF2\u6EE1\u7EA7!";
  return{emoji:lv.emoji,name:lv.name,pct:pct,days:days,tip:tip,cls:lv.cls};
}

function parseUptime(card){
  var items=card.querySelectorAll(".ds-fi");
  for(var i=0;i<items.length;i++){
    var label=items[i].querySelector(".ds-fi-label");
    var val=items[i].querySelector(".ds-fi-val");
    if(label&&val){
      var lt=(label.textContent||"").trim();
      if(lt==="\u8FD0\u884C\u65F6\u95F4"||lt.toLowerCase()==="uptime"){
        var t=(val.textContent||"").trim();
        var dm=t.match(/(\d+)\s*[dD\u5929\u65E5]/);
        if(dm) return parseInt(dm[1]);
      }
    }
  }
  return 0;
}

function getCardUuid(card){
  var link=card.querySelector(".ds-hdr-name");
  if(link){var href=link.getAttribute("href")||"";var m=href.match(/instance\/(.+)/);if(m)return m[1];}
  return null;
}

function fetchMoodData(){
  var cards=document.querySelectorAll(".ds-card2");
  cards.forEach(function(card){
    var uuid=getCardUuid(card);
    if(!uuid)return;
    if(card.classList.contains("ds-card2-off")){
      moodCache[uuid]={cpu:0,mem:0,online:false,ready:true};
      return;
    }
    fetch("/api/recent/"+uuid).then(function(r){return r.json()}).then(function(data){
      var records=data.data||[];
      if(records.length===0){moodCache[uuid]={cpu:0,mem:0,online:true,ready:false};return;}
      var cpuSum=0,memPctSum=0,count=0;
      records.forEach(function(r){
        if(r.cpu&&r.ram){
          cpuSum+=r.cpu.usage||0;
          var memPct=r.ram.total>0?((r.ram.used||0)/r.ram.total*100):0;
          memPctSum+=memPct;
          count++;
        }
      });
      if(count>0){moodCache[uuid]={cpu:cpuSum/count,mem:memPctSum/count,online:true,ready:true};}
    }).catch(function(){});
  });
}

/* ===== Render moods on cards ===== */
function renderMoods(){
  var cards=document.querySelectorAll(".ds-card2");
  cards.forEach(function(card){
    var uuid=getCardUuid(card);
    if(!uuid)return;
    var cached=moodCache[uuid];
    var ss=getServerSettings(uuid);

    var hdrLeft=card.querySelector(".ds-hdr2-left");
    if(!hdrLeft)return;

    var existingRow=hdrLeft.querySelector(".komari-mood-row");

    // Always keep the row for two-line layout (min-height placeholder)
    if(!existingRow){
      var row=document.createElement("div");
      row.className="komari-mood-row";
      row.dataset.uuid=uuid;
      hdrLeft.appendChild(row);
      setTimeout(function(){row.classList.add("komari-visible");},50);
      existingRow=row;
    }

    // If no data yet or both disabled, show empty placeholder (keeps 2-row layout)
    if(!cached||!cached.ready||(!ss.showMood&&!ss.showLevel)){
      existingRow.innerHTML="";
      existingRow.classList.add("komari-visible");
      return;
    }

    var days=parseUptime(card);
    var mood=getMood(cached.cpu,cached.mem,cached.online);
    var nurture=getLevel(days);

    var html="";
    if(ss.showMood) html+="<span class=\"komari-mood-emoji\" title=\""+mood.tip+"\">"+mood.emoji+"</span>";
    if(ss.showLevel) html+="<span class=\"komari-lv "+nurture.cls+"\" title=\""+nurture.tip+"\">"+nurture.name+"</span><span class=\"komari-xp-mini\" title=\""+nurture.tip+"\"><span class=\"komari-xp-mini-fill\" style=\"width:"+nurture.pct+"%\"></span></span>";

    existingRow.innerHTML=html;
  });
}

/* ===== Gear panel injection (per-server controls) ===== */
var INJECT_MARKER="komari-mood-injected";

function injectSettingsPanel(panel){
  if(panel.querySelector("."+INJECT_MARKER)) return;

  // Find which card this panel belongs to
  var card=panel.closest(".ds-card2");
  if(!card) return;
  var uuid=getCardUuid(card);
  if(!uuid) return;

  var grid=panel.querySelector(".ds-card-settings-grid");
  if(!grid) return;

  var ss=getServerSettings(uuid);

  // Divider
  var divider=document.createElement("hr");
  divider.className="komari-inject-divider "+INJECT_MARKER;
  grid.appendChild(divider);

  // Title
  var title=document.createElement("div");
  title.className="komari-inject-title";
  title.textContent="\u5FC3\u60C5\u4E0E\u517B\u6210";
  grid.appendChild(title);

  // Mood toggle (per this server)
  var moodLabel=document.createElement("label");
  moodLabel.className="ds-card-settings-option";
  var moodCb=document.createElement("input");
  moodCb.type="checkbox";
  moodCb.checked=ss.showMood;
  moodCb.disabled=!globalSettings.showMoodSystem;
  moodCb.addEventListener("change",function(){
    if(!perServer[uuid]) perServer[uuid]={showMood:true,showLevel:true};
    perServer[uuid].showMood=moodCb.checked;
    savePerServer();
    renderMoods();
  });
  var moodSpan=document.createElement("span");
  moodSpan.textContent="\u5FC3\u60C5\u8868\u60C5";
  if(!globalSettings.showMoodSystem) moodSpan.textContent+="\uFF08\u5DF2\u5168\u5C40\u5173\u95ED\uFF09";
  moodLabel.appendChild(moodCb);
  moodLabel.appendChild(moodSpan);
  grid.appendChild(moodLabel);

  // Level toggle (per this server)
  var lvLabel=document.createElement("label");
  lvLabel.className="ds-card-settings-option";
  var lvCb=document.createElement("input");
  lvCb.type="checkbox";
  lvCb.checked=ss.showLevel;
  lvCb.disabled=!globalSettings.showLevelSystem;
  lvCb.addEventListener("change",function(){
    if(!perServer[uuid]) perServer[uuid]={showMood:true,showLevel:true};
    perServer[uuid].showLevel=lvCb.checked;
    savePerServer();
    renderMoods();
  });
  var lvSpan=document.createElement("span");
  lvSpan.textContent="\u7B49\u7EA7\u5FBD\u7AE0";
  if(!globalSettings.showLevelSystem) lvSpan.textContent+="\uFF08\u5DF2\u5168\u5C40\u5173\u95ED\uFF09";
  lvLabel.appendChild(lvCb);
  lvLabel.appendChild(lvSpan);
  grid.appendChild(lvLabel);
}

function watchSettingsPanels(){
  var observer=new MutationObserver(function(){
    document.querySelectorAll(".ds-card-settings-panel").forEach(function(p){injectSettingsPanel(p);});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
}

/* ===== Init ===== */
function init(){
  loadPerServer();
  loadGlobalSettings();
  fetchMoodData();
  setTimeout(renderMoods,2500);
  setTimeout(renderMoods,5000);
  setInterval(function(){loadGlobalSettings();fetchMoodData();setTimeout(renderMoods,3000);},3600000);
  watchSettingsPanels();
  new MutationObserver(function(){setTimeout(renderMoods,300);}).observe(document.documentElement,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,2000);});
else setTimeout(init,2000);
window.addEventListener("load",function(){setTimeout(init,3000);});
})();
