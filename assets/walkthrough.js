/* Cursor walkthrough of the tap-through demo (hand-built stand-in for a Stageshow-style faux-UI tour).
   Swappable: it only clicks the demo's real buttons through the DOM, so replacing this file (or deleting it
   and its two hooks in index.html: .cursor and [data-walk]) leaves the demo working by hand.
   Plays once when the demo first comes into view, only when motion is allowed. Any real tap or key press
   inside the demo stops it. "Play walkthrough" / "Stop walkthrough" toggles it. */
(function(){
"use strict";
var demo=document.querySelector(".try"),bay=demo&&demo.querySelector(".bay"),cur=bay&&bay.querySelector(".cursor"),
    btn=demo&&demo.querySelector("[data-walk]");
if(!cur||!btn)return;
var mq=window.matchMedia?matchMedia("(prefers-reduced-motion: reduce)"):{matches:false};
var SCRIPT=[
 {click:"[data-restart]",wait:300,silent:true},
 {move:"[data-act=connect]",wait:900},{click:"[data-act=connect]",wait:2400},
 {move:"[data-act=send]",wait:900},{click:"[data-act=send]",wait:2200},
 {move:".step[data-step='4']",wait:900},{click:".step[data-step='4']",wait:2400}
];
var running=false,timer=0,i=0,played=false;
function el(s){return demo.querySelector(s);}
function moveTo(s){var t=el(s);if(!t)return;var b=bay.getBoundingClientRect(),r=t.getBoundingClientRect();
 cur.style.transform="translate("+Math.round(r.left-b.left+r.width*.6)+"px,"+Math.round(r.top-b.top+r.height*.55)+"px)";}
function tap(){cur.classList.remove("tap");void cur.offsetWidth;cur.classList.add("tap");}
function next(){
 if(!running)return;
 if(i>=SCRIPT.length){stop(true);return;}
 var s=SCRIPT[i++];
 if(s.move)moveTo(s.move);
 if(s.click){var t=el(s.click);if(t&&!t.disabled){if(!s.silent){moveTo(s.click);tap();}t.click();}}
 timer=setTimeout(next,s.wait);
}
function start(){if(mq.matches)return;running=true;played=true;i=0;btn.textContent="Stop walkthrough";
 moveTo("[data-act=connect]");cur.classList.add("on");next();}
function stop(done){running=false;clearTimeout(timer);cur.classList.remove("on");btn.textContent=done?"Play again":"Play walkthrough";}
btn.addEventListener("click",function(e){e.stopPropagation();if(running)stop(false);else start();});
demo.addEventListener("pointerdown",function(e){if(running&&e.isTrusted&&e.target!==btn)stop(false);},true);
demo.addEventListener("keydown",function(e){if(running&&e.isTrusted&&e.target!==btn)stop(false);},true);
btn.hidden=mq.matches;
if(mq.addEventListener)mq.addEventListener("change",function(e){if(e.matches&&running)stop(false);btn.hidden=e.matches;});
new IntersectionObserver(function(es,ob){if(es[0].isIntersecting&&!played&&!mq.matches){ob.disconnect();setTimeout(start,600);}},{threshold:.5}).observe(bay);
})();
