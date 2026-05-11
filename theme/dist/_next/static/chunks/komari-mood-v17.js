(function(){
"use strict";

/* ===== CSS ===== */
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

/* ===== Settings ===== */
var LS_PER="komari-mood-per-server";
var globalSettings={showMoodSystem:true,showLevelSystem:true};
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

/* ===== Render moods ===== */
function renderMoods(){
  var cards=document.querySelectorAll(".ds-card2");
  cards.forEach(function(card){
    var uuid=getCardUuid(card);
    if(!uuid)return;
    var cached=moodCache[uuid];
    var ss=getServerSettings(uuid);
    var hdrLeft=card.querySelector(".ds-hdr2-left");
    if(!hdrLeft)return;

    var hasContent=ss.showMood||ss.showLevel;
    var existingRow=hdrLeft.querySelector(".komari-mood-row");

    if(!hasContent){
      if(existingRow) existingRow.remove();
      hdrLeft.classList.remove("komari-two-row");
      return;
    }

    hdrLeft.classList.add("komari-two-row");

    if(!existingRow){
      existingRow=document.createElement("div");
      existingRow.className="komari-mood-row";
      existingRow.dataset.uuid=uuid;
      hdrLeft.appendChild(existingRow);
      setTimeout(function(){existingRow.classList.add("komari-visible");},50);
    }

    if(!cached||!cached.ready){
      existingRow.innerHTML="";
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

/* ===== Gear panel injection ===== */
var INJECT_MARKER="komari-mood-injected";

function injectSettingsPanel(panel){
  if(panel.querySelector("."+INJECT_MARKER)) return;
  var card=panel.closest(".ds-card2");
  if(!card) return;
  var uuid=getCardUuid(card);
  if(!uuid) return;
  var grid=panel.querySelector(".ds-card-settings-grid");
  if(!grid) return;

  var ss=getServerSettings(uuid);

  var divider=document.createElement("hr");
  divider.className="komari-inject-divider "+INJECT_MARKER;
  grid.appendChild(divider);

  var title=document.createElement("div");
  title.className="komari-inject-title";
  title.textContent="\u5FC3\u60C5\u4E0E\u517B\u6210";
  grid.appendChild(title);

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
  if(!globalSettings.showMoodSystem) moodSpan.textContent+="\uFF08\u5168\u5C40\u5DF2\u5173\uFF09";
  moodLabel.appendChild(moodCb);
  moodLabel.appendChild(moodSpan);
  grid.appendChild(moodLabel);

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
  if(!globalSettings.showLevelSystem) lvSpan.textContent+="\uFF08\u5168\u5C40\u5DF2\u5173\uFF09";
  lvLabel.appendChild(lvCb);
  lvLabel.appendChild(lvSpan);
  grid.appendChild(lvLabel);
}

/* ===== Mood init ===== */
function initMood(){
  loadPerServer();
  loadGlobalSettings();
  fetchMoodData();
  setTimeout(renderMoods,2500);
  setTimeout(renderMoods,5000);
  setInterval(function(){loadGlobalSettings();fetchMoodData();setTimeout(renderMoods,3000);},3600000);

  // Targeted observer for settings panels only
  var settingsObserver=new MutationObserver(function(mutations){
    for(var i=0;i<mutations.length;i++){
      var added=mutations[i].addedNodes;
      for(var j=0;j<added.length;j++){
        var node=added[j];
        if(node.nodeType!==1) continue;
        if(node.classList&&node.classList.contains("ds-card-settings-panel")){
          injectSettingsPanel(node);
        } else if(node.querySelector){
          var panels=node.querySelectorAll(".ds-card-settings-panel");
          for(var k=0;k<panels.length;k++) injectSettingsPanel(panels[k]);
        }
      }
    }
  });
  settingsObserver.observe(document.body||document.documentElement,{childList:true,subtree:true});

  // Mood render on card changes (debounced, non-blocking)
  var moodRenderTimer=null;
  new MutationObserver(function(){
    if(moodRenderTimer) return;
    moodRenderTimer=setTimeout(function(){moodRenderTimer=null;renderMoods();},500);
  }).observe(document.body||document.documentElement,{childList:true,subtree:true});
}

/* ===== Asset Unpriced Indicator ===== */
var unpricedCache={count:0,names:[],ready:false};

function fetchUnpricedNodes(){
  fetch("/api/nodes").then(function(r){return r.json()}).then(function(data){
    var nodes=(data&&data.data)||[];
    if(!Array.isArray(nodes)) return;
    var unpriced=[];
    nodes.forEach(function(n){
      var p=Number(n.price);
      if(!Number.isFinite(p)||p<=0){
        if(p!==-1){
          unpriced.push(n.name||n.uuid||"\u672A\u77E5");
        }
      }
    });
    unpricedCache={count:unpriced.length,names:unpriced,ready:true};
  }).catch(function(){});
}

function tryInjectAssetBox(){
  if(!unpricedCache.ready||unpricedCache.count===0) return;
  // Find the asset detail grid - it contains "在线资产估值"
  var allStats=document.querySelectorAll(".ds-detail-mini-stat");
  var assetGrid=null;
  for(var i=0;i<allStats.length;i++){
    var txt=allStats[i].textContent||"";
    if(txt.indexOf("\u8D44\u4EA7\u4F30\u503C")!==-1||txt.indexOf("\u8D44\u4EA7\u6761\u76EE")!==-1){
      assetGrid=allStats[i].parentElement;
      break;
    }
  }
  if(!assetGrid) return;
  if(assetGrid.querySelector(".komari-unpriced-box")) return;

  // Create a 4th box matching the mN component style
  var box=document.createElement("div");
  box.className="ds-detail-mini-stat ds-detail-mini-stat-corner tone-orange komari-unpriced-box";
  box.title="\u672A\u8BBE\u7F6E\u4EF7\u683C\u7684\u8282\u70B9:\n"+unpricedCache.names.join("\n");
  box.innerHTML='<div class="ds-detail-mini-head"><div class="ds-detail-mini-icon"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></div><span>\u672A\u6807\u8BB0\u4EF7\u683C</span></div><div class="ds-detail-mini-value">'+unpricedCache.count+' \u53F0</div>';
  assetGrid.appendChild(box);
}

function initAsset(){
  fetchUnpricedNodes();
  setInterval(fetchUnpricedNodes,3600000);

  // Only check for injection when detail panels appear (click-driven)
  document.addEventListener("click",function(){
    setTimeout(tryInjectAssetBox,300);
    setTimeout(tryInjectAssetBox,800);
  },true);
}

/* ===== Main init ===== */
function init(){
  initMood();
  initAsset();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,2000);});
else setTimeout(init,2000);
window.addEventListener("load",function(){setTimeout(init,3000);});
})();
