/* Early page setup (no inline script, CSP-safe). Decides between the WebGL scroll story and the static stills
   before first paint, so the layout never jumps. Reduced motion or no WebGL = static stills. */
(function(){
"use strict";
var root=document.documentElement;
root.classList.add("js");
var reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
var gl=false;
try{var c=document.createElement("canvas");var x=c.getContext("webgl")||c.getContext("experimental-webgl");gl=!!x;
 if(x&&x.getExtension("WEBGL_lose_context"))x.getExtension("WEBGL_lose_context").loseContext();}catch(e){gl=false;}
if(gl)root.classList.add("gl-ok");
if(gl&&!reduce)root.classList.add("gl-on");
})();
