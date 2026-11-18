/* APD website v3 page behaviour. No network calls, no storage, no tracking.
   Every control gives visible feedback and announces its result. Reduced motion = same results, no movement. */
(function(){
"use strict";
var root=document.documentElement;
var mq=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):{matches:false,addEventListener:function(){}};
var reduce=mq.matches;
function $(s,c){return(c||document).querySelector(s);}
function $$(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s));}
function later(fn,ms){return setTimeout(fn,reduce?0:ms);}

/* ---------- header: transparent over the hero, solid once the page scrolls ---------- */
var hdr=$("header.site");
function hdrPaint(){if(hdr)hdr.classList.toggle("solid",scrollY>8);}
addEventListener("scroll",hdrPaint,{passive:true});hdrPaint();

/* ---------- 3D loader: only with motion allowed and WebGL available ---------- */
var glLoaded=false;
function loadScript(src,ok){var s=document.createElement("script");s.src=src;s.onload=ok;
 s.onerror=function(){root.classList.remove("gl-on");};document.body.appendChild(s);}
function loadGL(){if(glLoaded){if(window.APDRadio3D)window.APDRadio3D.kick();return;}glLoaded=true;
 loadScript("assets/vendor/three.min.js",function(){loadScript("assets/radio3d.js",function(){});});}
if(root.classList.contains("gl-on"))loadGL();
function onMotionChange(e){reduce=e.matches;
 if(reduce)root.classList.remove("gl-on");
 else if(root.classList.contains("gl-ok")){root.classList.add("gl-on");loadGL();}
 dots.redraw();}
if(mq.addEventListener)mq.addEventListener("change",onMotionChange);else if(mq.addListener)mq.addListener(onMotionChange);

/* ---------- tap-through demo ---------- */
var demo=$(".try");
if(demo){
 var steps=$$(".step",demo),live=$("[data-demo-live]",demo),phone=$(".phone",demo),
     lcd=$("[data-lcd]",demo),lcdBar=$("[data-lcd-bar]",demo),devStatus=$("[data-dev-status]",demo),
     bConnect=$("[data-act=connect]",demo),bSend=$("[data-act=send]",demo),draft=$("[data-draft]",demo),
     out=$("[data-out]",demo),reply=$("[data-reply]",demo),tabs=$$(".tabbar svg",demo),
     st={connected:false,sent:false,replied:false,step:1},timers=[];
 function t(fn,ms){timers.push(later(fn,ms));}
 function clear(){timers.forEach(clearTimeout);timers=[];}
 function say(m){live.textContent=m;}
 function screen(name){$$(".scr",demo).forEach(function(s){s.hidden=s.getAttribute("data-screen")!==name;});
  tabs.forEach(function(s){s.classList.toggle("on",s.getAttribute("data-tab")===name);});}
 function setStep(n){st.step=n;steps.forEach(function(b){var on=+b.getAttribute("data-step")===n;
  if(on)b.setAttribute("aria-current","step");else b.removeAttribute("aria-current");});}
 function paint(){
  lcd.textContent=st.connected?"LINKED":(bConnect.getAttribute("aria-busy")==="true"?"PAIRING":"READY");
  lcdBar.classList.toggle("on",st.connected);phone.classList.toggle("linked",st.connected);
  devStatus.textContent=st.connected?"Connected":"No radio connected";
  if(st.connected){bConnect.textContent="Connected";bConnect.classList.add("done");bConnect.disabled=true;}
  out.hidden=!st.sent;reply.hidden=!st.replied;
  draft.textContent=st.sent?"Message":"Copy. Heading to you.";draft.classList.toggle("empty",st.sent);
  bSend.disabled=st.sent;bSend.textContent=st.sent?"Sent":"Send";bSend.classList.toggle("done",st.sent);}
 function connect(then){
  if(st.connected){if(then)then();return;}
  bConnect.setAttribute("aria-busy","true");bConnect.textContent="Connecting";paint();
  t(function(){bConnect.removeAttribute("aria-busy");st.connected=true;paint();say("Radio connected.");
   t(function(){if(then)then();},600);},900);}
 function send(){
  if(st.sent)return;st.sent=true;paint();say("Message sent.");
  t(function(){st.replied=true;paint();setStep(3);say("Reply received.");},1200);}
 function go(n){clear();bConnect.removeAttribute("aria-busy");
  if(n===1){setStep(1);screen("settings");paint();return;}
  if(!st.connected){st.connected=true;}
  if(n>=3){st.sent=true;st.replied=true;}
  setStep(n);screen(n===4?"map":"messages");paint();}
 bConnect.addEventListener("click",function(){connect(function(){setStep(2);screen("messages");paint();});});
 bSend.addEventListener("click",send);
 steps.forEach(function(b){b.addEventListener("click",function(){go(+b.getAttribute("data-step"));});});
 $("[data-restart]",demo).addEventListener("click",function(){clear();st={connected:false,sent:false,replied:false,step:1};
  bConnect.disabled=false;bConnect.classList.remove("done");bConnect.textContent="Connect radio";
  go(1);say("Started over.");});
 go(1);
}

/* ---------- dot-field terrain (canvas). Slow roll with motion; one still frame without ---------- */
var dots=(function(){
 var map=$("[data-map]"),cv=map&&$(".dots",map);if(!cv)return{redraw:function(){}};
 var ctx=cv.getContext("2d",{willReadFrequently:true}),w=0,h=0,dpr=1,t=0,vis=false,raf=0,lastT=0;
 var ink=getComputedStyle(root).getPropertyValue("--color-text-muted").trim();
 function size(){var r=cv.getBoundingClientRect();dpr=1;w=r.width;h=r.height;
  cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
 function height(x,z,tt){return .5*Math.sin(x*2.1+tt*.35)+.45*Math.sin(z*1.25-tt*.25+x*.6)+.15*Math.sin(x*5.3+z*3.1);}
 function draw(){
  ctx.clearRect(0,0,w,h);ctx.fillStyle=ink;
  var cols=Math.round(Math.min(160,w/9)),rows=60,horizon=h*.08,j,i;
  for(j=0;j<rows;j++){var z=1+5*(1-j/(rows-1)),a=.12+.55*(1-(z-1)/5);ctx.globalAlpha=a;
   var s=Math.max(1,2.4/z);
   for(i=0;i<cols;i++){var x=-1.7*z/2+(1.7*z)*(i/(cols-1)),y=height(x,z,t)*.32;
    var sx=w/2+(x/z)*w*.62,sy=horizon+((1.15-y)/z)*h*.82;
    if(sx<-2||sx>w+2||sy>h+2)continue;ctx.fillRect(sx,sy,s,s);}}
  ctx.globalAlpha=1;}
 function loop(now){raf=0;if(!vis||reduce)return;if(now-lastT>=33){t+=(lastT?Math.min(100,now-lastT):33)/1000;lastT=now;draw();}raf=requestAnimationFrame(loop);}
 function redraw(){size();draw();if(!reduce&&vis&&!raf){lastT=0;raf=requestAnimationFrame(loop);}}
 new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)redraw();}).observe(map);
 addEventListener("resize",redraw);
 return{redraw:redraw};
})();

/* ---------- relay map: pick a radio, send, watch it pass along ---------- */
(function(){
 var map=$("[data-map]");if(!map)return;
 var nodes=$$(".node",map),names=nodes.map(function(n){return $(".node-n",n).textContent;}),
     cxl=$("[data-cx]",map),cyl=$("[data-cy]",map),connL=$("[data-conn]",map),route=$("[data-route]",map),
     pulse=$(".pulse",map),readout=$("[data-readout]",map),btn=$("[data-relay-send]"),
     WIDE=[[14,72],[34,40],[54,66],[72,34],[88,62]],TALL=[[22,88],[72,72],[30,54],[74,36],[28,18]],
     pos=WIDE,sender=0,busy=false,timer=0,anim=0;
 function layout(){var r=map.getBoundingClientRect();pos=r.width/r.height<1?TALL:WIDE;
  nodes.forEach(function(n,i){n.style.left=pos[i][0]+"%";n.style.top=pos[i][1]+"%";});aim(pos[sender]);conn();}
 function aim(p){cxl.setAttribute("x1",p[0]);cxl.setAttribute("x2",p[0]);cyl.setAttribute("y1",p[1]);cyl.setAttribute("y2",p[1]);}
 function conn(){var m=map.getBoundingClientRect(),r=readout.getBoundingClientRect(),p=pos[sender];
  var ax=(r.left-m.left+r.width/2)/m.width*100,ay=(r.bottom-m.top)/m.height*100;
  connL.setAttribute("x1",p[0]);connL.setAttribute("y1",p[1]);connL.setAttribute("x2",ax);connL.setAttribute("y2",ay);}
 function state(i,txt,cls){var n=nodes[i];$("[data-state]",n).textContent=txt;n.classList.remove("hop","got");if(cls)n.classList.add(cls);}
 function reset(){clearTimeout(timer);cancelAnimationFrame(anim);busy=false;btn.removeAttribute("aria-busy");
  nodes.forEach(function(n,i){state(i,"");});route.setAttribute("points","");pulse.classList.remove("on");}
 function select(i){reset();sender=i;nodes.forEach(function(n,k){n.setAttribute("aria-pressed",k===i?"true":"false");});
  readout.textContent="From "+names[i];aim(pos[i]);conn();}
 function place(p){pulse.style.left=p[0]+"%";pulse.style.top=p[1]+"%";}
 function send(){
  if(busy)return;reset();busy=true;btn.setAttribute("aria-busy","true");
  var dest=sender<=2?4:0,step=dest>sender?1:-1,path=[];for(var k=sender;k!==dest+step;k+=step)path.push(k);
  readout.textContent="From "+names[sender]+", sending to "+names[dest];state(sender,"Sent");conn();
  var pts=[pos[sender].join(",")];
  function finish(){busy=false;btn.removeAttribute("aria-busy");pulse.classList.remove("on");
   readout.textContent="From "+names[sender]+", received by "+names[dest];conn();}
  if(reduce){path.slice(1).forEach(function(i){state(i,i===dest?"Received":"Relayed",i===dest?"got":"hop");pts.push(pos[i].join(","));});
   route.setAttribute("points",pts.join(" "));finish();return;}
  pulse.classList.add("on");place(pos[sender]);
  var seg=1;
  function hop(){
   if(seg>=path.length){finish();return;}
   var a=pos[path[seg-1]],b=pos[path[seg]],t0=0,dur=700;
   function f(now){if(!t0)t0=now;var u=Math.min(1,(now-t0)/dur),p=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];place(p);
    route.setAttribute("points",pts.concat([p.join(",")]).join(" "));
    if(u<1){anim=requestAnimationFrame(f);return;}
    pts.push(b.join(","));var i=path[seg];state(i,i===dest?"Received":"Relayed",i===dest?"got":"hop");seg++;timer=setTimeout(hop,250);}
   anim=requestAnimationFrame(f);}
  hop();}
 nodes.forEach(function(n,i){n.addEventListener("click",function(){select(i);});});
 btn.addEventListener("click",send);
 map.addEventListener("pointermove",function(e){if(e.pointerType!=="mouse"||reduce)return;var r=map.getBoundingClientRect();
  aim([(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100]);});
 map.addEventListener("pointerleave",function(){aim(pos[sender]);});
 addEventListener("resize",layout);
 select(0);layout();
})();

/* ---------- audience tabs (WAI-ARIA tabs pattern, arrow keys, Home/End) ---------- */
(function(){
 var list=$(".tabs[role=tablist]");if(!list)return;var tabs=$$("[role=tab]",list);
 function pick(i,focus){tabs.forEach(function(tb,k){var on=k===i,p=document.getElementById(tb.getAttribute("aria-controls"));
  tb.setAttribute("aria-selected",on?"true":"false");tb.tabIndex=on?0:-1;p.hidden=!on;
  if(on&&!reduce){p.classList.remove("fade");void p.offsetWidth;p.classList.add("fade");}});
  if(focus)tabs[i].focus();}
 tabs.forEach(function(tb,i){tb.addEventListener("click",function(){pick(i,false);});
  tb.addEventListener("keydown",function(e){var n=tabs.length,j=null;
   if(e.key==="ArrowRight")j=(i+1)%n;else if(e.key==="ArrowLeft")j=(i-1+n)%n;else if(e.key==="Home")j=0;else if(e.key==="End")j=n-1;
   if(j!==null){e.preventDefault();pick(j,true);}});});
 tabs.forEach(function(tb,k){document.getElementById(tb.getAttribute("aria-controls")).hidden=k!==0;});
})();
})();
