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
";
document.head.appendChild(css);

var moodCache={};
var settings={showMoodSystem:true,showLevelSystem:true};

function loadSettings(){
  fetch("/api/public").then(function(r){return r.json()}).then(function(data){
    var ts=data&&data.data&&data.data.theme_settings||{};
    if(typeof ts.showMoodSystem==="boolean") settings.showMoodSystem=ts.showMoodSystem;
    else if(ts.showMoodSystem==="false") settings.showMoodSystem=false;
    if(typeof ts.showLevelSystem==="boolean") settings.showLevelSystem=ts.showLevelSystem;
    else if(ts.showLevelSystem==="false") settings.showLevelSystem=false;
  }).catch(function(){});
}

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

function init(){
  loadSettings();
  fetchMoodData();
  setTimeout(renderMoods,2500);
  setTimeout(renderMoods,5000);
  setInterval(function(){fetchMoodData();setTimeout(renderMoods,3000);},3600000);
  new MutationObserver(function(){setTimeout(renderMoods,500);}).observe(document.documentElement,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(init,2000);});
else setTimeout(init,2000);
window.addEventListener("load",function(){setTimeout(init,3000);});
})();
