/* APD website v10: scroll-scrubbed frame sequence (pre-rendered frames drawn into one canvas).
   - The poster frame is plain HTML and is on screen before this file runs. Nothing here blocks the page.
   - Frames are fetched after the page has loaded and is idle, a few at a time: every 24th frame first, then the frames round the
     current scroll position, then every 12th, 6th, 3rd and the rest, nearest first. The frame the picture rests on jumps the queue.
     Until a frame has arrived, close neighbours are cross-faded; if only distant ones are in, the nearer one is shown alone.
   - The frame number follows the scroll target from app.js (window.APDScroll) through exponential damping on requestAnimationFrame,
     forward and backward. Scroll handlers never draw. When the scroll rests, the picture settles on one whole frame.
   - The picture is placed by window.APDFrame (boot.js) from the measured position of the radio, so the radio is never cropped and
     never enters the copy column, on any window shape. Where the picture stops short of the stage its edge fades (CSS mask).
   - Small screens scrub the 640 px set. Whenever the picture rests on one frame it is swapped for a sharper file of that frame:
     the full-size one on small screens, the double-size one (where it exists, see frames-manifest.js) on large or dense screens.
   - A canvas that changes size is wiped by the browser. resize() therefore draws the picture again at once, before the next paint,
     so the picture area is never shown empty (on narrow screens it changes size, over a few frames, when the hero text leaves).
   Reduced motion or no canvas: this file does nothing and the page shows stills. No network APIs, no storage.
   Beat by beat (snap-on, the /preview-3d/ page): the frame number no longer follows the scroll; app.js names the next beat's
   hold frame and glide() plays the frames to it on time (see below).
   Public: window.APDScrub = {kick(), jump(), glide(frame), mode(), rect(frame), info()}. */
(function(){
"use strict";
var root=document.documentElement,S=window.APDScroll,D=window.APD_BEATS,FR=window.APDFrame,F=window.APD_FRAMES;
function $(id){return document.getElementById(id);}
var pin=$("pin"),stage=$("stage"),canvas=$("frames-canvas"),poster=$("stage-poster");
var overlay=$("boot-overlay"),bar=$("boot-fill"),pctEl=$("boot-pct");
var view=stage&&stage.querySelector(".stage-view");
var DAMP=9;                 /* 1/s: higher = snappier; about 110 ms to cover 63% of a jump */
var LEVELS=[24,12,6,3,1];   /* key frames first */
var MAXC=6;                 /* frames in flight at once */
var REST=140;               /* ms without scrolling before the picture settles on a whole frame */
var NEAR=8;                 /* frames either side of the current position that are fetched ahead of the coarse levels */

function on(){return root.classList.contains("frames-on");}
function off(){
 root.classList.remove("frames-on");
 if(overlay)overlay.classList.add("is-done");
 if(window.APDReel)window.APDReel.sync(true);
}
if(poster){
 var broken=function(){poster.classList.add("is-broken");};
 if(poster.complete&&poster.naturalWidth===0)broken();
 poster.addEventListener("error",broken);
}
var ctx=null;
if(F&&S&&D&&FR&&pin&&stage&&view&&canvas&&F.have&&F.have.length){try{ctx=canvas.getContext("2d");}catch(e){ctx=null;}}
if(!ctx){
 if(on())off();
 window.APDScrub={kick:function(){},jump:function(){},glide:function(){},mode:function(){},rect:function(){return null;},info:function(){return null;}};
 return;
}

var IW=D.width,IH=D.height,total=F.have.length,can={};
F.have.forEach(function(n){can[n]=1;});
var small=false,dir="frames/";
var imgs={},have=[],asked={},tries={},loaded=0,failed=0,inflight=0,level=0,started=false,done=false;
var L=null,cw=0,ch=0,live=false,dirty=true,maskKey="";
var cur=null,drawn=null,running=false,last=0,way=1,moved=0;
var hi={},hiOrder=[],hiBad={},hiDir="",hiHas=null,hiAlias={},restTimer=0,warmed={};

function pad(n){var s=String(n);while(s.length<(F.pad||4))s="0"+s;return s;}

/* ---------- loading ---------- */
function insert(n){
 var lo=0,up=have.length,m;
 while(lo<up){m=(lo+up)>>1;if(have[m]<n)lo=m+1;else up=m;}
 if(have[lo]!==n)have.splice(lo,0,n);
}
function next(){
 var list=F.have,c=S.target||1,st,i,n,d,best,bd,r=Math.round(c);
 if(level>0){               /* once every 24th frame is in: the frames round the current position come first */
  best=0;bd=NEAR+1;
  for(n=Math.max(1,r-NEAR);n<=Math.min(D.frames,r+NEAR);n++){
   if(asked[n]||!can[n])continue;
   d=Math.abs(n-c);if(d<bd){bd=d;best=n;}
  }
  if(best)return best;
 }
 for(;level<LEVELS.length;level++){
  st=LEVELS[level];best=0;bd=1e9;
  for(i=0;i<list.length;i++){n=list[i];if(asked[n]||(n-1)%st)continue;d=Math.abs(n-c);if(d<bd){bd=d;best=n;}}
  if(best)return best;
 }
 return 0;
}
function progress(){
 var p=Math.round((loaded+failed)/total*100);
 if(bar)bar.value=p;
 if(pctEl)pctEl.textContent=p+"%";
 if(!done&&loaded+failed>=total){
  done=true;
  if(!loaded){off();return;}
  if(overlay)overlay.classList.add("is-done");
 }
}
function load(n){
 asked[n]=1;inflight++;
 var im=new Image();
 im.decoding="async";
 if("fetchPriority" in im)im.fetchPriority=loaded||inflight>1?"low":"high";   /* the first one asked for is the frame on screen */
 im.onload=function(){imgs[n]=im;insert(n);loaded++;inflight--;dirty=true;progress();kick();pump();};
 im.onerror=function(){
  inflight--;
  if(!tries[n]){tries[n]=1;setTimeout(function(){asked[n]=0;level=0;pump();},1500);pump();return;}   /* one more go, a little later */
  failed++;progress();pump();
 };
 im.src=dir+pad(n)+".webp";
}
function pump(){var n;while(inflight<MAXC&&(n=next()))load(n);}
function hiKey(n){return hiAlias[n]||n;}
/* a sharper file of frame n, for when the picture rests on it */
function sharp(n){
 var k=hiKey(n);
 if(!hiDir||hi[k]||hi[k]===0||hiBad[k]||(hiHas&&!hiHas[k]))return;
 hi[k]=0;                                               /* asked for */
 var im=new Image();
 im.decoding="async";
 im.onload=function(){
  hi[k]=im;hiOrder.push(k);
  while(hiOrder.length>4)delete hi[hiOrder.shift()];
  if(cur===null||hiKey(Math.round(cur))===k){dirty=true;kick();}
 };
 im.onerror=function(){delete hi[k];hiBad[k]=1;};
 im.src=hiDir+pad(k)+".webp";
}
function start(){
 if(started||!on())return;
 started=true;
 var c=navigator.connection,x2=F.x2,dpr=Math.min(window.devicePixelRatio||1,2);
 small=!!(F.tiers&&F.tiers.indexOf("frames-640")>=0)&&(!!(c&&c.saveData)||root.clientWidth<700);
 dir=small?"frames-640/":"frames/";
 if(small)hiDir="frames/";
 else if(x2&&x2.have&&x2.have.length&&L&&L.rects.length&&L.rects[0].w*dpr>1300){      /* the picture is drawn larger than the frames are */
  hiDir=x2.dir+"/";hiHas={};hiAlias=x2.alias||{};
  x2.have.forEach(function(n){hiHas[n]=1;});
 }
 if(overlay)overlay.classList.add("is-busy");
 if(hiDir)sharp(Math.round(S.target||1));               /* the frame on screen first, so the hand-over from the poster does not soften */
 pump();
}
function whenIdle(fn){if(window.requestIdleCallback)requestIdleCallback(fn,{timeout:1200});else setTimeout(fn,200);}

/* ---------- where the picture goes ---------- */
function sceneOf(f){var sc=D.scenes,i;for(i=0;i<sc.length-1;i++)if(f<sc[i].last+1)break;return i;}
function ease(t){t=t<0?0:t>1?1:t;return t*t*(3-2*t);}
function rect(f){
 if(!L||!L.rects.length)return null;
 var i=sceneOf(f),R=L.rects[i],e=D.scenes[i].ease,P,t;
 if(e&&i>0&&f<e[1]){
  P=L.rects[i-1];t=ease((f-e[0])/(e[1]-e[0]));
  return {s:P.s+(R.s-P.s)*t,x:P.x+(R.x-P.x)*t,y:P.y+(R.y-P.y)*t,w:P.w+(R.w-P.w)*t,h:P.h+(R.h-P.h)*t};
 }
 return R;
}
function setMask(R){
 var m=FR.mask(R,L.sw,L.sh),k="",i;
 for(i=0;i<8;i++)k+=m[i].toFixed(1)+",";
 if(k===maskKey)return;
 maskKey=k;
 for(i=0;i<8;i++)view.style.setProperty(FR.names[i],m[i].toFixed(1)+"px");
}
function resize(entry){
 if(!on())return;
 var r=stage.getBoundingClientRect();
 if(!(r.width>0&&r.height>0))return;
 L=FR.layout(pin.classList.contains("is-compact"),r.width,r.height);
 var real=window.devicePixelRatio||1,dpr=Math.min(real,2);
 var w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr)),b=entry&&entry.devicePixelContentBoxSize;
 if(b&&b[0]&&real<=2&&Math.abs(b[0].inlineSize-w)<=2&&Math.abs(b[0].blockSize-h)<=2){w=b[0].inlineSize;h=b[0].blockSize;}   /* exact device pixels where the browser reports them */
 if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
 cw=w;ch=h;
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 FR.vars(L,pin,rect(cur===null?(S.target||1):cur));
 maskKey="";dirty=true;
 if(window.APDReel)window.APDReel.measure();
 if(live&&cur!==null&&draw(cur)){drawn=cur;dirty=false;}      /* now, not on the next animation frame: that paint would show the wiped canvas */
 kick();
}

/* ---------- drawing ---------- */
function around(p){
 var lo=0,up=have.length-1,m;
 if(up<0)return null;
 if(p<=have[0])return [have[0],have[0]];
 if(p>=have[up])return [have[up],have[up]];
 while(up-lo>1){m=(lo+up)>>1;if(have[m]<=p)lo=m;else up=m;}
 return [have[lo],have[up]];
}
function draw(p){
 var R=rect(p);
 if(!R||!cw)return false;
 var k=Math.round(p),hk=hi[hiKey(k)],n=null,a,b=null,kx=cw/L.sw,ky=ch/L.sh,t;
 if(hk&&Math.abs(p-k)<0.02)a=hk;                                 /* at rest: the sharper file of this frame */
 else{
  n=around(p);
  if(!n)return false;
  a=imgs[n[0]];
  if(n[1]!==n[0]){
   if(n[1]-n[0]<=2)b=imgs[n[1]];                                 /* close neighbours: cross-fade */
   else if(p-n[0]>n[1]-p){a=imgs[n[1]];n=[n[1],n[1]];}           /* distant ones: the nearer alone, no double image */
  }
 }
 ctx.globalAlpha=1;
 ctx.clearRect(0,0,cw,ch);
 ctx.drawImage(a,R.x*kx,R.y*ky,R.w*kx,R.h*ky);
 if(b){
  t=(p-n[0])/(n[1]-n[0]);
  if(t>0.004){ctx.globalAlpha=t;ctx.drawImage(b,R.x*kx,R.y*ky,R.w*kx,R.h*ky);ctx.globalAlpha=1;}
 }
 setMask(R);
 if(!live){live=true;stage.classList.add("is-live");}
 return true;
}
function warm(){
 /* decode the next few frames in the direction of travel before they are needed */
 var c=Math.round(cur),k,n,im;
 for(k=1;k<=5;k++){
  n=c+k*way;im=imgs[n];
  if(im&&!warmed[n]&&im.decode){warmed[n]=1;im.decode().catch(function(){});}
 }
 for(n in warmed)if(Math.abs(n-c)>30)delete warmed[n];
}
/* the frame to settle on: the nearest whole frame, or one within a frame and a half that has a sharper file
   (the double-size files exist for every third frame of each dwell zone, where the picture hardly changes from frame to frame) */
function restOn(t){
 var r=Math.max(1,Math.min(D.frames,Math.round(t))),best=r,bd=9,k,d;
 if(hiHas)for(k=r-2;k<=r+2;k++){
  d=Math.abs(k-t);
  if(k>=1&&k<=D.frames&&d<=1.5&&d<bd&&hiHas[hiKey(k)]&&!hiBad[hiKey(k)]){bd=d;best=k;}
 }
 return best;
}
function rest(){
 var k=cur===null?0:Math.round(cur);
 if(started&&k&&can[k]&&!imgs[k]&&!asked[k])load(k);              /* the frame being looked at jumps the queue (never before the page has loaded) */
 if(!hiDir)return;
 clearTimeout(restTimer);
 restTimer=setTimeout(function(){if(!running&&cur!==null&&on())sharp(Math.round(cur));},180);
}

/* ---------- beat-by-beat mode (snap-on): the picture glides from where it is to the next beat's hold frame ----------
   The glide runs on time, not on the scroll: about 0.35 s for a caption change inside a beat, about 0.8 to 1.5 s from one beat
   to the next, eased in and out (cubic Hermite). A new target mid-glide starts a new glide from the frame on screen; going the
   same way it keeps its speed, turning back it starts from rest. On arrival app.js is told, and shows the beat's words. */
var G=null;
function snapping(){return root.classList.contains("snap-on");}
function glideDur(d){return 1000*Math.max(0.35,Math.min(1.5,0.25+0.0145*Math.abs(d)));}   /* ms */
function glideAt(g,now){
 var s=Math.max(0,Math.min(1,(now-g.t0)/g.dur)),s2=s*s,s3=s2*s,D=g.to-g.from;
 return {s:s,p:g.from+(3*s2-2*s3)*D+(s3-2*s2+s)*g.m0,v:((6*s-6*s2)*D+(3*s2-4*s+1)*g.m0)/g.dur};
}
function glide(to){
 to=Math.max(1,Math.min(D.frames,to));
 var now=window.performance&&performance.now?performance.now():Date.now(),from=cur===null?to:cur,v=0,dur,m0=0,d=to-from;
 if(G){var a=glideAt(G,now);from=a.p;v=a.v;d=to-from;}
 if(Math.abs(d)<0.01&&!G){cur=to;S.target=to;dirty=true;kick();arrive(to);return;}
 dur=glideDur(d);
 if(v*d>0)m0=Math.min(Math.abs(v*dur),2*Math.abs(d))*(d>0?1:-1);   /* same way: keep the speed, never overshoot */
 G={from:from,to:to,t0:now,dur:dur,m0:m0};
 cur=from;S.target=to;kick();
}
function arrive(f){if(window.APDReel&&window.APDReel.arrive)window.APDReel.arrive(f);}

/* ---------- damped scrub loop ---------- */
function tick(t){
 if(!on()){running=false;last=0;G=null;return;}
 var target=S.target||1,dt=last?Math.min(0.1,(t-last)/1000):1/60,prev,idle,g;
 last=t;
 if(cur===null)cur=target;
 if(snapping()){
  prev=cur;
  if(G){g=glideAt(G,window.performance&&performance.now?performance.now():Date.now());cur=g.s>=1?G.to:g.p;if(g.s>=1){target=G.to;G=null;arrive(target);}}
  else cur=target;
  if(cur!==prev)way=cur>prev?1:-1;
  if(dirty||drawn===null||Math.abs(cur-drawn)>0.002){if(draw(cur)){drawn=cur;dirty=false;}}
  if(have.length)warm();
  if(G||(dirty&&(have.length||hiOrder.length))){requestAnimationFrame(tick);}
  else{running=false;last=0;rest();}
  return;
 }
 idle=t-moved>REST;
 if(idle)target=restOn(target);                                         /* at rest: one whole frame, no blend */
 prev=cur;
 cur+=(target-cur)*(1-Math.exp(-DAMP*dt));
 if(Math.abs(target-cur)<0.01)cur=target;
 if(cur!==prev)way=cur>prev?1:-1;
 if(dirty||drawn===null||Math.abs(cur-drawn)>0.002){if(draw(cur)){drawn=cur;dirty=false;}}
 if(have.length)warm();
 if(cur!==target||!idle||(dirty&&(have.length||hiOrder.length))){requestAnimationFrame(tick);}
 else{running=false;last=0;rest();}
}
function kick(moving){
 if(moving)moved=window.performance&&performance.now?performance.now():0;
 if(!running&&on()){running=true;last=0;requestAnimationFrame(tick);}
}
function jump(){G=null;cur=S.target||1;dirty=true;kick(true);}

function mode(){
 if(!on())return;
 if(document.readyState==="complete")whenIdle(start);
 resize(null);
 kick(true);
}
if(window.ResizeObserver){
 var ro=new ResizeObserver(function(es){resize(es&&es[0]);});
 try{ro.observe(canvas,{box:"device-pixel-content-box"});}catch(e){ro.observe(canvas);}
}
addEventListener("resize",function(){resize(null);});
/* when a scroll ends, ask at once for the files of the frame the picture is about to settle on
   (browsers without scrollend get the same from rest(), a moment later) */
if("onscrollend" in window)addEventListener("scrollend",function(){
 if(!on()||!started)return;
 var k=restOn(S.target||1);
 if(can[k]&&!imgs[k]&&!asked[k])load(k);
 sharp(k);
});
if(document.readyState==="complete")whenIdle(start);
else addEventListener("load",function(){whenIdle(start);});
resize(null);

window.APDScrub={
 kick:kick,jump:jump,glide:glide,mode:mode,rect:rect,
 info:function(){return {tier:dir,sharp:hiDir,sharpNow:cur!==null&&!!hi[hiKey(Math.round(cur))],small:small,total:total,loaded:loaded,failed:failed,have:have.length,started:started,done:done,live:live,booted:live,complete:!!F.complete,
  cur:cur===null?null:+cur.toFixed(3),target:+(S.target||1).toFixed(3),drawn:drawn===null?null:+drawn.toFixed(3),
  canvas:[canvas.width,canvas.height],stage:L?[L.sw,L.sh]:null,gliding:!!G,wide:L?L.wide:null,rect:cur===null?null:rect(cur)};}
};
})();
