(function(){
"use strict";
var css=document.createElement("style");
css.textContent="\
.ds-hdr2-left{display:grid!important;grid-template-columns:auto 1fr;grid-template-rows:auto auto;align-items:center;column-gap:6px;row-gap:1px}\
.ds-hdr2-left .ds-hdr-flag{grid-row:1/3;align-self:center}\
.ds-hdr2-left .ds-hdr-name{grid-column:2;grid-row:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
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

/* ===== Settings (localStorage + API fallback) ===== */
var LS_KEY="komari-mood-settings";
var settings={showMoodSystem:true,showLevelSystem:true};

function loadLocalSettings(){
  try{
    var s=localStorage.getItem(LS_KEY);
    if(s){var p=JSON.parse(s);if(typeof p.showMoodSystem==="boolean")settings.showMoodSystem=p.showMoodSystem;if(typeof p.showLevelSystem==="boolean")settings.showLevelSystem=p.showLevelSystem;}
  }catch(e){}
}

function saveLocalSettings(){
  try{localStorage.setItem(LS_KEY,JSON.stringify(settings));}catch(e){}
}

function loadSettings(){
  loadLocalSettings();
  fetch("/api/public").then(function(r){return r.json()}).then(function(data){
    var ts=data&&data.data&&data.data.theme_settings||{};
    var localOverride=localStorage.getItem(LS_KEY);
    if(localOverride) return; // local takes priority
    if(typeof ts.showMoodSystem==="boolean") settings.showMoodSystem=ts.showMoodSystem;
    else if(ts.showMoodSystem==="false") settings.showMoodSystem=false;
    if(typeof ts.showLevelSystem==="boolean") settings.showLevelSystem=ts.showLevelSystem;
    else if(ts.showLevelSystem==="false") settings.showLevelSystem=false;
  }).catch(function(){});
}

/* ===== Mood logic ===== */
var moodCache={};

function getMood(cpu,mem,isOnline){
  if(!isOnline)return{emoji:"\u{1F480}",tip:"\u72B6\u6001: \u79BB\u7EBF"};
  if(cpu>90||mem>95)return{emoji:"\u{1F630}",tip:"\u72B6\u6001: \u5371\u9669 (\u5747\u503C CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  if(cpu>80||mem>85)return{emoji:"\u{1F630}",tip:"\u72B6\u6001: \u7D27\u5F20 (\u5747\u503C CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  if(cpu>50||mem>70)return{emoji:"\u{1F624}",tip:"\u72B6\u6001: \u5FD9\u788C (\u5747\u503C CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  if(cpu>15||mem>40)return{emoji:"\u{1F60A}",tip:"\u72B6\u6001: \u6B63\u5E38 (\u5747\u503C CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  if(cpu>3||mem>20)return{emoji:"\u{1F60C}",tip:"\u72B6\u6001: \u60A0\u95F2 (\u5747\u503C CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
  return{emoji:"\u{1F634}",tip:"\u72B6\u6001: \u7761\u89C9 (\u5747\u503C CPU "+cpu.toFixed(1)+"% / \u5185\u5B58 "+mem.toFixed(1)+"%)"};
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

function renderMoods(){
  if(!settings.showMoodSystem&&!settings.showLevelSystem){
    document.querySelectorAll(".komari-mood-row").forEach(function(e){e.remove();});
    return;
  }
  var cards=document.querySelectorAll(".ds-card2");
  cards.forEach(function(card){
    var uuid=getCardUuid(card);
    if(!uuid)return;
    var cached=moodCache[uuid];
    if(!cached||!cached.ready)return;

    var hdrLeft=card.querySelector(".ds-hdr2-left");
    if(!hdrLeft)return;

    var days=parseUptime(card);
    var mood=getMood(cached.cpu,cached.mem,cached.online);
    var nurture=getLevel(days);

    var existingRow=hdrLeft.querySelector(".komari-mood-row");
    if(existingRow){
      var emojiEl=existingRow.querySelector(".komari-mood-emoji");
      var lvEl=existingRow.querySelector(".komari-lv");
      if(emojiEl){
        if(!settings.showMoodSystem){emojiEl.style.display="none";}
        else{emojiEl.style.display="";if(emojiEl.textContent!==mood.emoji){emojiEl.textContent=mood.emoji;emojiEl.title=mood.tip;}}
      }
      if(lvEl){
        if(!settings.showLevelSystem){lvEl.style.display="none";var xp=existingRow.querySelector(".komari-xp-mini");if(xp)xp.style.display="none";}
        else{lvEl.style.display="";lvEl.title=nurture.tip;var xp2=existingRow.querySelector(".komari-xp-mini");if(xp2)xp2.style.display="";}
      }
      if(!settings.showMoodSystem&&!settings.showLevelSystem){existingRow.remove();}
      return;
    }

    var moodHtml=settings.showMoodSystem?"<span class=\"komari-mood-emoji\" title=\""+mood.tip+"\">"+mood.emoji+"</span>":"";
    var lvHtml=settings.showLevelSystem?"<span class=\"komari-lv "+nurture.cls+"\" title=\""+nurture.tip+"\">"+nurture.name+"</span><span class=\"komari-xp-mini\" title=\""+nurture.tip+"\"><span class=\"komari-xp-mini-fill\" style=\"width:"+nurture.pct+"%\"></span></span>":"";

    if(!moodHtml&&!lvHtml)return;

    var row=document.createElement("div");
    row.className="komari-mood-row";
    row.innerHTML=moodHtml+lvHtml;
    hdrLeft.appendChild(row);
    setTimeout(function(){row.classList.add("komari-visible");},50);
  });
}

/* ===== ThemeSwitcher Panel Injection ===== */
var INJECT_MARKER="komari-mood-injected";

function injectSettingsPanel(panel){
  if(panel.querySelector("."+INJECT_MARKER)) return;
  var grid=panel.querySelector(".ds-card-settings-grid");
  if(!grid) return;

  // Create divider
  var divider=document.createElement("hr");
  divider.className="komari-inject-divider "+INJECT_MARKER;
  grid.appendChild(divider);

  // Create title
  var title=document.createElement("div");
  title.className="komari-inject-title";
  title.textContent="\u5FC3\u60C5\u4E0E\u517B\u6210";
  grid.appendChild(title);

  // Mood toggle
  var moodLabel=document.createElement("label");
  moodLabel.className="ds-card-settings-option";
  var moodCb=document.createElement("input");
  moodCb.type="checkbox";
  moodCb.checked=settings.showMoodSystem;
  moodCb.addEventListener("change",function(){
    settings.showMoodSystem=moodCb.checked;
    saveLocalSettings();
    renderMoods();
  });
  var moodSpan=document.createElement("span");
  moodSpan.textContent="\u5FC3\u60C5\u8868\u60C5";
  moodLabel.appendChild(moodCb);
  moodLabel.appendChild(moodSpan);
  grid.appendChild(moodLabel);

  // Level toggle
  var lvLabel=document.createElement("label");
  lvLabel.className="ds-card-settings-option";
  var lvCb=document.createElement("input");
  lvCb.type="checkbox";
  lvCb.checked=settings.showLevelSystem;
  lvCb.addEventListener("change",function(){
    settings.showLevelSystem=lvCb.checked;
    saveLocalSettings();
    renderMoods();
  });
  var lvSpan=document.createElement("span");
  lvSpan.textContent="\u7B49\u7EA7\u5FBD\u7AE0";
  lvLabel.appendChild(lvCb);
  lvLabel.appendChild(lvSpan);
  grid.appendChild(lvLabel);
}

function watchSettingsPanels(){
  var observer=new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      m.addedNodes.forEach(function(node){
        if(node.nodeType!==1) return;
        // Check if the added node IS a settings panel or CONTAINS one
        var panels=[];
        if(node.classList&&node.classList.contains("ds-card-settings-panel")) panels.push(node);
        else if(node.querySelectorAll) panels=node.querySelectorAll(".ds-card-settings-panel");
        panels.forEach(function(p){injectSettingsPanel(p);});
      });
    });
    // Also check existing panels (for panels that were already in DOM)
    document.querySelectorAll(".ds-card-settings-panel").forEach(function(p){injectSettingsPanel(p);});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  // Initial scan
  document.querySelectorAll(".ds-card-settings-panel").forEach(function(p){injectSettingsPanel(p);});
}

/* ===== Also inject into the global ThemeSwitcher dialog ===== */
function injectThemeSwitcherDialog(){
  // The ThemeSwitcher is triggered by the palette button and opens a dialog/sheet
  // Look for dialogs that contain theme-related content
  var dialogs=document.querySelectorAll('[role="dialog"], [data-state="open"], .ds-theme-panel');
  dialogs.forEach(function(dialog){
    if(dialog.querySelector("."+INJECT_MARKER)) return;
    // Look for sections with "卡片显示" or "显示设置" text
    var headings=dialog.querySelectorAll("h3, h4, .font-medium, .text-sm.font-medium, label");
    var found=false;
    headings.forEach(function(h){
      var t=(h.textContent||"").trim();
      if(t.indexOf("\u663E\u793A\u8BBE\u7F6E")!==-1||t.indexOf("\u5361\u7247\u663E\u793A")!==-1){
        found=true;
      }
    });
    if(!found) return;
    // Find the container with switches/checkboxes
    var switchContainers=dialog.querySelectorAll(".space-y-3, .space-y-2, .grid");
    if(switchContainers.length===0) return;
    var target=switchContainers[switchContainers.length-1];
    // Don't double-inject
    if(target.querySelector("."+INJECT_MARKER)) return;

    var wrapper=document.createElement("div");
    wrapper.className=INJECT_MARKER+" mt-3 pt-3 border-t border-dashed border-border/50";
    wrapper.innerHTML='<div class="text-xs font-medium text-muted-foreground mb-2">\u5FC3\u60C5\u4E0E\u517B\u6210</div>';

    // Mood switch
    var moodRow=document.createElement("div");
    moodRow.className="flex items-center justify-between py-1";
    moodRow.innerHTML='<span class="text-sm">\u5FC3\u60C5\u8868\u60C5</span>';
    var moodBtn=createToggle(settings.showMoodSystem,function(v){
      settings.showMoodSystem=v;
      saveLocalSettings();
      renderMoods();
    });
    moodRow.appendChild(moodBtn);
    wrapper.appendChild(moodRow);

    // Level switch
    var lvRow=document.createElement("div");
    lvRow.className="flex items-center justify-between py-1";
    lvRow.innerHTML='<span class="text-sm">\u7B49\u7EA7\u5FBD\u7AE0</span>';
    var lvBtn=createToggle(settings.showLevelSystem,function(v){
      settings.showLevelSystem=v;
      saveLocalSettings();
      renderMoods();
    });
    lvRow.appendChild(lvBtn);
    wrapper.appendChild(lvRow);

    target.appendChild(wrapper);
  });
}

function createToggle(checked,onChange){
  var btn=document.createElement("button");
  btn.type="button";
  btn.setAttribute("role","switch");
  btn.setAttribute("aria-checked",checked?"true":"false");
  var baseClass="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  btn.className=baseClass+(checked?" bg-primary":" bg-input");
  btn.innerHTML='<span class="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform '+(checked?"translate-x-4":"translate-x-0")+'"></span>';
  btn.addEventListener("click",function(){
    checked=!checked;
    btn.setAttribute("aria-checked",checked?"true":"false");
    btn.className=baseClass+(checked?" bg-primary":" bg-input");
    btn.querySelector("span").className="pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform "+(checked?"translate-x-4":"translate-x-0");
    onChange(checked);
  });
  return btn;
}

/* ===== Init ===== */
function init(){
  loadSettings();
  fetchMoodData();
  setTimeout(renderMoods,2500);
  setTimeout(renderMoods,5000);
  setInterval(function(){fetchMoodData();setTimeout(renderMoods,3000);},3600000);
  watchSettingsPanels();
  // Watch for ThemeSwitcher dialog
  new MutationObserver(function(){
    setTimeout(injectThemeSwitcherDialog,200);
  }).observe(document.documentElement,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,2000);});
else setTimeout(init,2000);
window.addEventListener("load",function(){setTimeout(init,3000);});
})();
