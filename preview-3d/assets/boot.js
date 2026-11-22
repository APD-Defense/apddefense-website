/* APD website v10: early page setup (no inline script, CSP-safe). Runs in <head>, after assets/beats.js, before first paint.
   1. Picks the mode. frames-on = the canvas scrubs the rendered frames with the scroll. Otherwise (reduced motion, no 2D canvas,
      or a window too small to pin a picture and its text) the page is plain: one still per beat with its text.
   2. Works out where the picture sits in this window, with the same arithmetic scrub.js uses later, and hands it to the stylesheet
      as custom properties, so the poster frame and the headline are already in their final place on the first paint.
   The layout numbers below mirror site.css (header height, gutters, card area); change them together. No network, no storage. */
(function(){
"use strict";
var root=document.documentElement,D=window.APD_BEATS;
root.classList.add("js");
var mq=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):{matches:false};
var c2d=false;
try{var c=document.createElement("canvas");c2d=!!(c.getContext&&c.getContext("2d"));}catch(e){c2d=false;}
function mm(q){return !!(window.matchMedia&&matchMedia(q).matches);}
var WIDE="(min-width:56.25em) and (min-aspect-ratio:5/4)",BIG="(min-width:48em)";
var MH=0.02,MV=0.03;                             /* breathing room kept round the radio, as a share of the frame */

/* Where one scene's picture goes. box = [x0,y0,x1,y1] of the radio in the frame (y from the bottom); W,H = the stage;
   c = the line the radio must stay right of (the copy column); want = a line it should stay right of if it can (the headline).
   Only empty backdrop is ever cropped. */
function place(box,W,H,c,iw,ih,want){
 var X0=Math.max(0,box[0]-MH),X1=Math.min(1,box[2]+MH),Y0=Math.max(0,box[1]-MV),Y1=Math.min(1,box[3]+MV);
 var s=Math.min(Math.max(W/iw,H/ih),H/((Y1-Y0)*ih),(W-c)/((X1-X0)*iw));
 var w=iw*s,h=ih*s;
 var x=w>=W?(W-w)/2:W-w;                        /* wider than the stage: centred crop; narrower: against the right edge */
 if(!c&&w>=W)x=Math.max(W-w,Math.min(0,W/2-(X0+X1)/2*w));   /* no copy column (narrow screens): the radio as near the middle as the picture allows */
 if(want)x=Math.max(x,want-X0*w);               /* slide right to give the headline its width ... */
 x=Math.max(c-X0*w,Math.min(W-X1*w,x));         /* ... but never cut the radio, never let it into the copy column */
 var y=H/2-(1-(Y0+Y1)/2)*h;                     /* radio centred top to bottom */
 y=h>=H?Math.max(H-h,Math.min(0,y)):Math.max(0,Math.min(H-h,y));
 return {s:s,x:x,y:y,w:w,h:h};
}
/* Soft edges where the picture stops short of the stage: [gap left,right,top,bottom, fade left,right,top,bottom] in px */
function mask(R,W,H){
 var el=Math.max(0,R.x),er=Math.max(0,W-R.x-R.w),et=Math.max(0,R.y),eb=Math.max(0,H-R.y-R.h);
 function f(e,m){return Math.min(m,e*2.5);}
 return [el,er,et,eb,f(el,R.w*0.14),f(er,R.w*0.14),f(et,R.h*0.12),f(eb,R.h*0.12)];
}
/* The whole layout for this window. compact = the smaller text area used after the hero on narrow screens.
   sw,sh (optional) = the stage size as measured in the page; without them it is worked out from the same rules as site.css. */
function layout(compact,sw,sh){
 var r=parseFloat(getComputedStyle(root).fontSize)||16,W=root.clientWidth,H=root.clientHeight;
 var big=mm(BIG),wide=mm(WIDE);
 if(sw>0)W=sw;else sw=W;                        /* the stage spans the page: its measured width is the page width */
 var gut=(big?2:1)*r,hdr=(big?4:3.5)*r,left=Math.max(0,(W-80*r)/2)+gut,gap=2*r;
 var tiny=mm("(max-width:22.49em)"),area=wide?0:(compact?(tiny?30:27):(big?27.5:(tiny?30:27)))*r;      /* v14: the callout cards need more room */
 if(!(sh>0))sh=H-hdr-area;
 var cc=wide?Math.max(0.34*W,left+20*r+gap):0;
 /* the headline's size by the same rule as --text-hero in site.css, and the width its longest line needs (8.3 em) */
 var font=Math.max(0,Math.min(Math.max(2.5*r,r+0.065*W),6.875*r,(H-hdr-15.6*r)/4.6)),want=wide?left+8.3*font+gap:0;
 var L={wide:wide,rem:r,W:W,H:H,hdr:hdr,left:left,gap:gap,sw:sw,sh:sh,c:cc,rects:[],clear:[],heroW:0,copyW:0,
        ok:sw>=17.5*r&&sh>=(wide?24:11)*r};
 if(!D)return L;
 var sc=D.scenes,i,j,b;
 for(i=0;i<sc.length;i++)L.rects.push(place(sc[i].box,sw,sh,cc,D.width,D.height,sc[i].hero?want:0));
 for(i=0;i<D.beats.length;i++){b=D.beats[i];for(j=0;j<sc.length-1;j++)if(b.first<=sc[j].last)break;
  L.clear.push(L.rects[j].x+b.box[0]*L.rects[j].w-gap);}
 if(wide){L.heroW=L.clear[0]-left;L.copyW=Math.min(30*r,Math.min.apply(null,L.clear.slice(1))-left);}
 else{L.heroW=L.copyW=W-2*gut;}
 return L;
}
var NAMES=["--el","--er","--et","--eb","--fl","--fr","--ft","--fb"];
/* Hand the numbers to the stylesheet. el = the element to set them on; R = the picture rectangle on show (default: the opening scene) */
function vars(L,el,R){
 if(!L.rects.length)return;
 var st=el.style,P=L.rects[0],m=mask(R||P,L.sw,L.sh),i;
 st.setProperty("--pw",P.w.toFixed(1)+"px");st.setProperty("--px",P.x.toFixed(1)+"px");st.setProperty("--py",P.y.toFixed(1)+"px");
 for(i=0;i<8;i++)st.setProperty(NAMES[i],m[i].toFixed(1)+"px");
 st.setProperty("--hero-w",Math.max(0,L.heroW).toFixed(1)+"px");st.setProperty("--copy-w",Math.max(0,L.copyW).toFixed(1)+"px");
}
var units=!!(window.CSS&&CSS.supports&&CSS.supports("height","100svh"));      /* the pinned layout is written in small-viewport units */
function mode(){
 var L=layout(false),on=c2d&&units&&!mq.matches&&!!D&&L.ok;
 root.classList.toggle("frames-on",on);root.classList.toggle("snap-on",on);root.classList.toggle("reduced",!!mq.matches);
 if(on)vars(L,root);
 return on;
}
window.APDFrame={place:place,mask:mask,layout:layout,vars:vars,mode:mode,names:NAMES,WIDE:WIDE};
if(mm("(min-width:64em)"))root.classList.add("nav-wide");      /* first guess for the header row; app.js measures it */
mode();
})();
