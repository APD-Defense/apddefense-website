/* APD website v10 page behaviour. No network calls, no storage, no tracking.
   Every control gives visible feedback and announces its result. Reduced motion = same results, no movement.
   New in v10: the reel (scroll position -> frame number for assets/scrub.js, beat cards, callout lines, jumps), the header menu
   and the current-section mark. The tap-through demo, the relay map and the audience tabs are unchanged from v3. */
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

/* ---------- reel: scroll position -> frame, beat cards, callout lines, jumps ----------
   One tall track; each beat owns a segment of it (heights in site.css). The frame number comes from how far the bottom edge of
   the (small) viewport is into the current segment, with dwell frames taking twice the distance of moving frames. The scroll handler only
   does this arithmetic from cached sizes and hands the number to scrub.js; nothing is drawn or measured here while scrolling. */
var reel=(function(){
 var D=window.APD_BEATS,FRM=window.APDFrame,track=$("#track"),pinEl=$("#pin");
 var S=window.APDScroll={target:1,b:0,beat:0,frame:1};
 var none={sync:function(){},measure:function(){},end:function(){return 0;}};
 if(!D||!FRM||!track||!pinEl)return none;
 var BEATS=D.beats,NB=BEATS.length,segs=$$(".seg",track),cards=[],subs=[],subOn=[],rate=D.rate||{move:0.025,dwell:0.05};
 if(segs.length!==NB)return none;
 var svg=$("#leader"),line=$("#leader-line"),ring=$("#leader-ring");
 var byName={},cum=[],segTop=[],segH=[],vh=root.clientHeight||innerHeight,cardBox=[],stageAt={x:0,y:0},wide=false,curBeat=-1,lastOn=-2,measuredOn=false;
 BEATS.forEach(function(b,i){
  byName[b.name]=i;
  cards[i]=$('.beat-card[data-beat="'+b.name+'"]',pinEl);
  subs[i]=cards[i]?$$(".sub",cards[i]):[];subOn[i]=-2;
  var a=[0],f;
  for(f=b.first;f<=b.last;f++)a.push(a[a.length-1]+(f>=b.dwell[0]&&f<=b.dwell[1]?rate.dwell:rate.move));
  cum[i]=a;
 });
 function framesOn(){return root.classList.contains("frames-on");}
 /* how far (0..1) into beat i's segment frame f sits, and the reverse */
 function posOf(i,f){
  var c=cum[i],n=c.length-1,k=Math.max(0,Math.min(n,f-BEATS[i].first)),k0=Math.min(n-1,Math.floor(k));
  return (c[k0]+(c[k0+1]-c[k0])*(k-k0))/c[n];
 }
 function frameOf(i,t){
  var c=cum[i],n=c.length-1,w=Math.max(0,Math.min(1,t))*c[n],lo=0,up=n,m;
  while(up-lo>1){m=(lo+up)>>1;if(c[m]<=w)lo=m;else up=m;}
  return BEATS[i].first+lo+(w-c[lo])/(c[lo+1]-c[lo]);
 }
 /* where each card fades in and out, as a share of its segment, for the scroll-driven CSS in site.css */
 BEATS.forEach(function(b,i){
  var c=cards[i],w=b.card;if(!c)return;
  c.style.setProperty("--in0",(posOf(i,w[0])*100).toFixed(2)+"%");c.style.setProperty("--in1",(posOf(i,w[1]+1)*100).toFixed(2)+"%");
  c.style.setProperty("--out0",(posOf(i,w[2])*100).toFixed(2)+"%");c.style.setProperty("--out1",(posOf(i,w[3]+1)*100).toFixed(2)+"%");
 });

 function measure(){
  vh=root.clientHeight||innerHeight;                 /* the small viewport height: steady when a phone hides its address bar */
  wide=!!(window.matchMedia&&matchMedia(FRM.WIDE).matches);
  measuredOn=framesOn();
  if(!measuredOn)return;
  var sy=scrollY,pr=pinEl.getBoundingClientRect(),st=$("#stage"),i,r;
  for(i=0;i<NB;i++){r=segs[i].getBoundingClientRect();segTop[i]=r.top+sy;segH[i]=r.height;}
  if(st){r=st.getBoundingClientRect();stageAt={x:r.left-pr.left,y:r.top-pr.top};}
  for(i=0;i<NB;i++){
   if(!cards[i])continue;
   r=cards[i].getBoundingClientRect();
   cardBox[i]={l:r.left-pr.left,r:r.right-pr.left,t:r.top-pr.top,b:r.bottom-pr.top};
  }
 }
 /* A change of size changes the reel's length, so the same scroll position would mean another frame. keep() notes the frame on
    show before anything is measured again; restore() puts the scroll back on it afterwards. It only acts when the reel's own
    length changed (a real change of size, not a phone hiding its address bar) and the reel was on, with the scroll inside it.
    The resize event and the scrubber's size observer can arrive in either order; both go through here, and the first one in
    still finds the old frame. */
 function keep(){return {f:S.target,i:S.beat,h0:segH[0],held:measuredOn&&segH.length===NB&&scrollY<=segTop[NB-1]+segH[NB-1]-vh};}
 function restore(k){
  if(!k.held||!framesOn()||!(Math.abs(segH[0]-k.h0)>1))return false;
  scrollTo(0,Math.max(0,Math.round(segTop[k.i]+posOf(k.i,k.f)*segH[k.i]-vh)));
  return true;
 }
 function relay(){
  var k=keep(),moved;
  measure();moved=restore(k);update();
  if(moved&&window.APDScrub)window.APDScrub.jump();
 }
 function leader(name,f,i){
  if(!svg)return;
  var a=name&&wide?D.anchors[name]:null,R=a&&window.APDScrub?window.APDScrub.rect(f):null,box=cardBox[i],pt=null;
  if(a&&R&&box&&f>=a[0][0]&&f<a[a.length-1][0]+1){
   var k=Math.min(a.length-1,Math.max(0,Math.floor(f-a[0][0]))),p=a[k],q=a[Math.min(a.length-1,k+1)],t=Math.max(0,Math.min(1,f-p[0]));
   pt=[stageAt.x+R.x+(p[1]+(q[1]-p[1])*t)*R.w,stageAt.y+R.y+(1-(p[2]+(q[2]-p[2])*t))*R.h];
  }
  if(!pt){svg.classList.remove("is-on");return;}
  var rad=10,sx=box.r,sy=(box.t+box.b)/2,dx=pt[0]-sx,dy=pt[1]-sy,len=Math.sqrt(dx*dx+dy*dy)||1;
  line.setAttribute("x1",sx.toFixed(1));line.setAttribute("y1",sy.toFixed(1));
  line.setAttribute("x2",(pt[0]-dx/len*rad).toFixed(1));line.setAttribute("y2",(pt[1]-dy/len*rad).toFixed(1));
  ring.setAttribute("cx",pt[0].toFixed(1));ring.setAttribute("cy",pt[1].toFixed(1));ring.setAttribute("r",rad);
  svg.classList.add("is-on");
 }
 function show(i,f){
  var w=BEATS[i].card,onNow=(f>=w[0]&&f<w[3]+1)?i:-1,k,s=-1,el;
  if(onNow!==lastOn){for(k=0;k<NB;k++)if(cards[k])cards[k].classList.toggle("is-on",k===onNow);lastOn=onNow;}
  if(i!==curBeat){curBeat=i;pinEl.classList.toggle("is-compact",i>0);}          /* after the hero the text area is smaller (narrow screens) */
  if(subs[i].length){
   subs[i].forEach(function(sb,j){if(f>=+sb.getAttribute("data-a")&&f<+sb.getAttribute("data-b")+1)s=j;});
   if(s!==subOn[i]){subs[i].forEach(function(sb,j){sb.classList.toggle("is-on",j===s);});subOn[i]=s;}
  }
  el=s>=0?subs[i][s]:cards[i];
  leader(onNow>=0&&el?el.getAttribute("data-anchor"):null,f,i);
 }
 function update(){
  if(!framesOn()){S.target=1;S.frame=1;S.beat=0;S.b=0;return;}
  var p=scrollY+vh,i,t,f;
  for(i=NB-1;i>0;i--)if(p>=segTop[i])break;
  t=segH[i]?(p-segTop[i])/segH[i]:0;
  f=Math.max(1,Math.min(D.frames,frameOf(i,t)));
  S.b=i+Math.max(0,Math.min(1,t));S.target=f;S.frame=f;S.beat=i;
  show(i,f);
  if(window.APDScrub)window.APDScrub.kick(true);
 }
 function goTo(i,f){
  if(!framesOn())return false;
  measure();
  scrollTo(0,Math.max(0,Math.round(segTop[i]+posOf(i,f)*segH[i]-vh+1)));
  update();
  if(window.APDScrub)window.APDScrub.jump();
  return true;
 }
 /* The pinned layout gives each card a fixed area. If a card does not fit it (very large text, unusual text spacing), nothing may
    be cut off: the page falls back to the plain layout instead. A card's height is final only once the web fonts are in (a
    fallback font wraps differently), so while they are still loading the answer is yes and the question is asked again when
    they land (settle, below). */
 function fits(){
  if(!framesOn())return true;
  var cs=getComputedStyle(root),box=$(".cards-in",pinEl),rem=parseFloat(cs.fontSize)||16,i,c,room,ok=true,compact=parseFloat(cs.getPropertyValue("--card-area-compact"))||13.5;
  if(!box)return true;
  for(i=0;i<NB;i++){
   c=cards[i];if(!c)continue;
   room=wide||i===0?box.clientHeight-(wide?0:16):compact*rem-16;      /* compact = --card-area-compact in site.css, in rem */
   if(c.offsetHeight>room+1){ok=false;break;}
  }
  return ok||fontsPending();      /* asked after the measuring above: that layout is what makes the browser fetch a font it still needs */
 }
 function fontsPending(){
  var fs=document.fonts,p=false;
  if(!fs)return false;
  if(fs.status==="loading")return true;
  try{fs.forEach(function(face){if(face.status==="loading")p=true;});}catch(e){}
  return p;
 }
 /* decided = the mode was already switched by someone else (scrub.js giving up); otherwise ask boot.js again */
 function sync(decided){
  var k=keep(),moved;
  if(!decided)FRM.mode();
  wide=!!(window.matchMedia&&matchMedia(FRM.WIDE).matches);
  /* the scrubber lays the picture out for this window and hands the cards their widths; only then can the cards be measured */
  if(framesOn()&&window.APDScrub)window.APDScrub.mode();
  if(!fits())root.classList.remove("frames-on");
  if(!framesOn()){pinEl.classList.remove("is-compact");cards.forEach(function(c,j){if(c)c.classList.toggle("is-on",j===0);});lastOn=-2;curBeat=-1;}
  measure();moved=restore(k);update();
  if(moved&&window.APDScrub)window.APDScrub.jump();
 }
 $$("[data-go]").forEach(function(a){a.addEventListener("click",function(e){
  var i=byName[a.getAttribute("data-go")];
  if(i!==undefined&&goTo(i,BEATS[i].dwell[0]))e.preventDefault();
 });});
 /* a link that names something inside a beat card (#parts) goes to that beat */
 function fromHash(){
  var id=location.hash.slice(1),el=id&&document.getElementById(id),card=el&&el.closest?el.closest(".beat-card"):null,k=card?byName[card.getAttribute("data-beat")]:undefined;
  if(k!==undefined)goTo(k,BEATS[k].dwell[0]);
 }
 addEventListener("scroll",update,{passive:true});
 addEventListener("resize",function(){sync(false);});
 /* page loaded, or fonts in (or failed): decide the layout again from scratch, whichever way an earlier answer went */
 function settle(){sync(false);}
 addEventListener("load",function(){settle();fromHash();});
 if(document.fonts){
  if(document.fonts.ready)document.fonts.ready.then(settle);
  if(document.fonts.addEventListener)document.fonts.addEventListener("loadingdone",settle);
 }
 addEventListener("hashchange",fromHash);
 wide=!!(window.matchMedia&&matchMedia(FRM.WIDE).matches);
 if(!fits())root.classList.remove("frames-on");
 measure();update();
 window.APDReel={sync:sync,measure:relay,frameOf:frameOf,posOf:posOf,
  end:function(){return framesOn()&&segTop.length?segTop[NB-1]+segH[NB-1]-vh:0;},
  top:function(i,f){return segTop[i]+posOf(i,f)*segH[i]-vh;}};
 return window.APDReel;
})();
function onMotionChange(e){reduce=e.matches;reel.sync(false);dots.redraw();}
if(mq.addEventListener)mq.addEventListener("change",onMotionChange);else if(mq.addListener)mq.addListener(onMotionChange);

/* ---------- header menu: one list of links; a pop-up when the row does not fit, inline when it does ---------- */
(function(){
 var inner=hdr&&$(".bar",hdr),menu=$("#site-menu"),btn=hdr&&$(".menu-btn",hdr);
 if(!inner||!menu||!btn){root.classList.remove("nav-wide");return;}
 var hasPop="popover" in HTMLElement.prototype,lastW=0;
 function isOpen(){try{return hasPop&&menu.hasAttribute("popover")&&menu.matches(":popover-open");}catch(e){return false;}}
 function apply(wideNow){
  hdr.classList.toggle("is-wide",wideNow);
  if(hasPop){if(wideNow)menu.removeAttribute("popover");else if(!menu.hasAttribute("popover"))menu.setAttribute("popover","auto");}
  else{menu.removeAttribute("popover");menu.hidden=!wideNow;btn.setAttribute("aria-expanded","false");}
 }
 /* collapsed and still too wide (large text, tiny screens): the button moves into the menu */
 function tight(){
  hdr.classList.remove("is-tight");
  if(!hdr.classList.contains("is-wide")&&inner.scrollWidth>inner.clientWidth)hdr.classList.add("is-tight");
 }
 function fit(force){
  var w=hdr.clientWidth,wideNow=hdr.classList.contains("is-wide");
  if(!force&&!wideNow&&w<=lastW){tight();return;}       /* collapsed: look again only when the header has grown */
  var open=isOpen();
  hdr.classList.add("is-measuring","is-wide");
  if(hasPop)menu.removeAttribute("popover");else menu.hidden=false;
  var fits=inner.scrollWidth<=inner.clientWidth;
  apply(fits);
  tight();
  if(!fits&&open){try{menu.showPopover();}catch(e){}}
  lastW=w;root.classList.remove("nav-wide");
  requestAnimationFrame(function(){hdr.classList.remove("is-measuring");});
 }
 if(!hasPop){btn.addEventListener("click",function(){var show=menu.hidden;menu.hidden=!show;btn.setAttribute("aria-expanded",show?"true":"false");});}
 menu.addEventListener("click",function(e){
  if(!e.target.closest||!e.target.closest("a"))return;
  if(isOpen())menu.hidePopover();
  else if(!hasPop&&!hdr.classList.contains("is-wide")){menu.hidden=true;btn.setAttribute("aria-expanded","false");}
 });
 if(window.ResizeObserver){var ro=new ResizeObserver(function(){fit(false);});ro.observe(hdr);ro.observe(menu);}
 else addEventListener("resize",function(){fit(true);});
 fit(true);
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){fit(true);});
})();

/* ---------- in-page links: a short hop scrolls smoothly; a jump that would run through the reel is instant ---------- */
document.addEventListener("click",function(e){
 var a=e.target.closest?e.target.closest('a[href^="#"]'):null;
 if(!a||a.hasAttribute("data-go")||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
 var id=a.getAttribute("href").slice(1),el=id&&document.getElementById(id);
 if(!el||reduce||!("scrollBehavior" in root.style))return;
 var end=reel.end(),y=el.getBoundingClientRect().top+scrollY;
 if(scrollY<end-1||y<end-1)return;
 e.preventDefault();
 el.scrollIntoView({behavior:"smooth",block:"start"});
 if(history.pushState)history.pushState(null,"","#"+id);
 if(el.hasAttribute("tabindex"))el.focus({preventScroll:true});
});

/* ---------- current section in the header (native scroll-target-group where the browser has it) ---------- */
(function(){
 var menu=$("#site-menu");if(!menu)return;
 var links=$$('a[href^="#"]',menu);
 if(window.CSS&&CSS.supports&&CSS.supports("scroll-target-group: auto")){
  var mirror=function(){
   var now=null;try{now=menu.querySelector("a:target-current");}catch(e){}
   links.forEach(function(l){l.setAttribute("aria-current",l===now?"true":"false");});
  };
  mirror();document.addEventListener("scrollend",mirror);
  return;
 }
 if(!window.IntersectionObserver)return;
 var io=new IntersectionObserver(function(es){es.forEach(function(en){
  if(!en.isIntersecting)return;
  var id=en.target.getAttribute("id");
  links.forEach(function(l){var onNow=l.getAttribute("href")==="#"+id;l.classList.toggle("target-current",onNow);l.setAttribute("aria-current",onNow?"true":"false");});
 });},{rootMargin:"-50% 0px -50% 0px",threshold:0});
 links.forEach(function(l){var t=document.getElementById(l.getAttribute("href").slice(1));if(t)io.observe(t);});
})();

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
