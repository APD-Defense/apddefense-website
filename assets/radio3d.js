/* APD website v3: scroll-driven 3D radio (three.js r128, vendored). Generic concept shape only:
   shells, plain board, battery, antenna, three buttons, belt clip. No internal layout, no chips, no specs.
   Loaded by app.js only when motion is allowed and WebGL works. Renders only while the stage is on screen
   and something changed (scroll, pointer, resize, the one load-in assembly). */
(function(){
"use strict";
var root=document.documentElement;
var stage=document.querySelector(".stage");
if(!stage||!window.THREE)return;
var pin=stage.querySelector(".stage-pin"),canvas=document.getElementById("gl");
var svg=pin.querySelector(".leaders"),tagsUl=pin.querySelector(".tags");
var prog=pin.querySelector(".stage-progress"),progI=prog.querySelector("i");
var css=getComputedStyle(root);
function tok(n){return css.getPropertyValue(n).trim();}
function col(n){return new THREE.Color(tok(n)).convertSRGBToLinear();}

var renderer;
try{renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true,powerPreference:"low-power"});}
catch(e){root.classList.remove("gl-on");return;}
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.15;
renderer.setClearColor(0x000000,0);
var scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(30,1,.1,100);
cam.position.set(0,0,12);
var white=col("--color-text");
scene.add(new THREE.HemisphereLight(white,col("--color-bg"),.6));
var key=new THREE.DirectionalLight(white,1.7);key.position.set(-4,6,8);scene.add(key);
var rim=new THREE.DirectionalLight(white,1.5);rim.position.set(6,3,-6);scene.add(rim);
var fill=new THREE.DirectionalLight(white,.35);fill.position.set(2,-5,4);scene.add(fill);

function M(t,rough,metal){return new THREE.MeshStandardMaterial({color:col(t),roughness:rough,metalness:metal});}
var mShell=M("--hw-shell",.55,.25),mBack=M("--hw-shell-back",.6,.2),mBoard=M("--hw-board",.7,.1),
    mBatt=M("--hw-battery",.5,.15),mBtn=M("--hw-button",.45,.3),mAcc=M("--color-accent",.4,.1),mGlass=M("--hw-glass",.15,.6);
function slab(w,h,d,r,mat){
 var s=new THREE.Shape(),x=-w/2,y=-h/2;
 s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
 var bev=Math.min(r*.5,d*.3),g=new THREE.ExtrudeGeometry(s,{depth:Math.max(.001,d-2*bev),bevelEnabled:true,bevelThickness:bev,bevelSize:bev*.6,bevelSegments:3,curveSegments:10});
 g.translate(0,0,-d/2+bev);return new THREE.Mesh(g,mat);}

/* parts: name, object, home position, explode offset (local), label anchor (local, relative to part) */
var radio=new THREE.Group(),parts=[];
function add(name,obj,pos,off,anchor){obj.position.set(pos[0],pos[1],pos[2]);radio.add(obj);
 parts.push({name:name,o:obj,home:obj.position.clone(),off:new THREE.Vector3(off[0],off[1],off[2]),a:new THREE.Vector3(anchor[0],anchor[1],anchor[2])});}
var front=new THREE.Group();front.add(slab(1.2,2.1,.22,.24,mShell));
var glass=slab(.84,.66,.03,.06,mGlass);glass.position.set(0,.42,.115);front.add(glass);
add("front",front,[0,0,.11],[0,0,1.45],[-.6,-.3,.1]);
var btns=new THREE.Group();
[-.32,0,.32].forEach(function(x,i){var b=slab(.2,.2,.08,.09,i===2?mAcc:mBtn);b.position.set(x,0,0);btns.add(b);});
add("buttons",btns,[0,-.55,.25],[0,0,2.3],[0,0,.05]);
add("board",slab(1.0,1.85,.04,.08,mBoard),[0,0,-.02],[0,0,.6],[.5,.4,0]);
add("battery",slab(.88,1.3,.12,.08,mBatt),[0,-.2,-.12],[0,0,-.35],[.44,-.2,0]);
add("back",slab(1.2,2.1,.28,.24,mBack),[0,0,-.14],[0,0,-1.25],[.6,-.5,0]);
add("clip",slab(.42,1.5,.06,.08,mBack),[0,.1,-.31],[0,0,-2.05],[0,.6,0]);
var ant=new THREE.Group(),conn=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.18,20),M("--hw-button",.35,.8));
var whip=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,1.35,16),M("--hw-glass",.8,.1));whip.position.y=.76;ant.add(conn);ant.add(whip);
add("antenna",ant,[.38,1.15,0],[0,.6,0],[0,1.1,0]);
scene.add(radio);

/* labels: text comes from the cleared parts list in the page */
var NS="http://www.w3.org/2000/svg",labels={};
Array.prototype.forEach.call(document.querySelectorAll(".parts-list li"),function(li){
 var t=document.createElement("li");t.textContent=li.textContent;tagsUl.appendChild(t);
 var ln=document.createElementNS(NS,"line"),dot=document.createElementNS(NS,"circle");dot.setAttribute("r","3");
 svg.appendChild(ln);svg.appendChild(dot);labels[li.getAttribute("data-part")]={li:t,ln:ln,dot:dot};});

/* state */
var W=1,H=1,narrow=false,active=false,raf=0,last=0,pointer={x:0,y:0},intro=0,introStart=-1;
var cur={x:0,y:0,s:1,rx:0,ry:0,e:0},tgt={x:0,y:0,s:1,rx:0,ry:0,e:0},P=0;
function sm(a,b,v){var t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t);}
function mix(a,b,t){return a+(b-a)*t;}
function poses(){
 if(!narrow)return{hero:{x:3.4,y:-.1,s:1.1,rx:.14,ry:-.5},apart:{x:.9,y:-.8,s:.95,rx:.28,ry:-1.05},end:{x:1.6,y:-.6,s:1.05,rx:.1,ry:-.25}};
 return{hero:{x:0,y:.25,s:.62,rx:.12,ry:-.5},apart:{x:-.05,y:-.85,s:.6,rx:.95,ry:-.45},end:{x:0,y:-1.0,s:.75,rx:.1,ry:-.3}};}
function targets(){
 var r=stage.getBoundingClientRect(),range=Math.max(1,stage.offsetHeight-innerHeight);
 P=Math.min(1,Math.max(0,-r.top/range));
 var p=poses(),a=sm(.12,.38,P),b=sm(.74,.94,P),k;
 for(k in p.hero){tgt[k]=b>0?mix(p.apart[k],p.end[k],b):mix(p.hero[k],p.apart[k],a);}
 tgt.ry+=sm(.38,.74,P)*.3*(1-b);
 tgt.e=sm(.2,.42,P)*(1-sm(.74,.92,P));
 var heroW=1-a;tgt.ry+=pointer.x*.25*heroW;tgt.rx+=pointer.y*.12*heroW;
 if(intro<1)tgt.e=Math.max(tgt.e,(1-intro)*.45);
}
function resize(){W=pin.clientWidth;H=pin.clientHeight;if(!W||!H)return;narrow=W/H<1;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setSize(W,H,false);
 cam.aspect=W/H;cam.fov=narrow?34:30;cam.updateProjectionMatrix();svg.setAttribute("viewBox","0 0 "+W+" "+H);kick();}
var v=new THREE.Vector3();
function project(p){v.copy(p.a).add(p.o.position);radio.localToWorld(v);v.project(cam);return{x:(v.x+1)/2*W,y:(1-v.y)/2*H};}
function layoutLabels(show){
 tagsUl.classList.toggle("on",show);
 svg.style.opacity=show?1:0;
 if(!show)return;
 var cx=(new THREE.Vector3()).copy(radio.position).project(cam),ccx=(cx.x+1)/2*W,cols={l:[],r:[]},gut=narrow?16:32;
 parts.forEach(function(p,i){var L=labels[p.name];if(!L)return;var s=project(p);
  var side=narrow?(i%2?"r":"l"):(s.x<ccx?"l":"r");cols[side].push({p:p,L:L,s:s,y:s.y});});
 var all=cols.l.concat(cols.r),minX=Math.min.apply(null,all.map(function(o){return o.s.x;})),maxX=Math.max.apply(null,all.map(function(o){return o.s.x;}));
 ["l","r"].forEach(function(side){var c=cols[side].sort(function(a,b){return a.y-b.y;}),minY=narrow?160:200,gap=32;
  c.forEach(function(o){o.y=Math.max(o.y,minY);minY=o.y+gap;});
  c.forEach(function(o){var lw=o.L.li.offsetWidth,lx,ex;
   if(narrow){lx=side==="l"?gut:W-gut-lw;}else{lx=side==="l"?Math.max(gut,minX-64-lw):Math.min(W-gut-lw,maxX+64);}
   ex=side==="l"?lx+lw:lx;
   o.L.li.style.transform="translate("+Math.round(lx)+"px,"+Math.round(o.y-10)+"px)";
   o.L.ln.setAttribute("x1",o.s.x);o.L.ln.setAttribute("y1",o.s.y);o.L.ln.setAttribute("x2",ex);o.L.ln.setAttribute("y2",o.y);
   o.L.dot.setAttribute("cx",o.s.x);o.L.dot.setAttribute("cy",o.s.y);});});
}
function frame(t){
 raf=0;if(!active||!root.classList.contains("gl-on"))return;
 var dt=last?Math.min(64,t-last):16.7;last=t;
 if(introStart<0)introStart=t;intro=Math.min(1,(t-introStart)/1400);
 targets();
 var k=1-Math.pow(1-.12,dt/16.7),moving=intro<1,key2;
 for(key2 in cur){var d=tgt[key2]-cur[key2];if(Math.abs(d)>.0005)moving=true;cur[key2]+=d*k;}
 radio.position.set(cur.x,cur.y,0);radio.scale.setScalar(cur.s);radio.rotation.set(cur.rx,cur.ry,0);
 parts.forEach(function(p){p.o.position.copy(p.home).addScaledVector(p.off,cur.e);});
 radio.updateMatrixWorld(true);
 renderer.render(scene,cam);
 layoutLabels(cur.e>.85);
 prog.classList.toggle("on",P>.1&&P<.97);progI.style.transform="scaleX("+P.toFixed(3)+")";
 if(moving)kick();else last=0;
}
function kick(){if(!raf&&active)raf=requestAnimationFrame(frame);}
addEventListener("scroll",kick,{passive:true});
addEventListener("resize",resize);
addEventListener("pointermove",function(e){if(e.pointerType!=="mouse")return;pointer.x=e.clientX/innerWidth-.5;pointer.y=e.clientY/innerHeight-.5;kick();},{passive:true});
new IntersectionObserver(function(es){active=es[0].isIntersecting;if(active){last=0;kick();}}).observe(stage);
window.APDRadio3D={kick:function(){last=0;resize();kick();}};
resize();
})();
