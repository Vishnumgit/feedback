/* effects.js — 3D Background + Custom Cursor for Student Feedback Hub
   Auto-initializes on any page that loads this script. */
(function(){
"use strict";

// ═══════════ CUSTOM CURSOR ═══════════
function initCursor(){
  if('ontouchstart' in window) return; // Skip on mobile/touch
  
  var style=document.createElement('style');
  style.textContent=`
    *,*::before,*::after{cursor:none!important}
    .fx-cursor-dot{position:fixed;width:8px;height:8px;background:linear-gradient(135deg,#A855F7,#3B82F6);border-radius:50%;pointer-events:none;z-index:99999;box-shadow:0 0 15px rgba(168,85,247,0.8),0 0 30px rgba(59,130,246,0.4);transition:transform 0.05s}
    .fx-cursor-ring{position:fixed;width:36px;height:36px;border:2px solid rgba(168,85,247,0.4);border-radius:50%;pointer-events:none;z-index:99998;transition:all 0.15s ease-out}
    .fx-cursor-trail{position:fixed;width:5px;height:5px;background:rgba(168,85,247,0.3);border-radius:50%;pointer-events:none;z-index:99997}
  `;
  document.head.appendChild(style);
  
  var dot=document.createElement('div');dot.className='fx-cursor-dot';document.body.appendChild(dot);
  var ring=document.createElement('div');ring.className='fx-cursor-ring';document.body.appendChild(ring);
  
  var trails=[];
  for(var i=0;i<8;i++){var t=document.createElement('div');t.className='fx-cursor-trail';t.style.opacity='0';document.body.appendChild(t);trails.push({el:t,x:0,y:0})}
  
  var mx=0,my=0,rx=0,ry=0;
  document.addEventListener('mousemove',function(e){mx=e.clientX;my=e.clientY;dot.style.left=mx-4+'px';dot.style.top=my-4+'px'});
  
  function anim(){
    rx+=(mx-rx)*0.15;ry+=(my-ry)*0.15;
    ring.style.left=rx-18+'px';ring.style.top=ry-18+'px';
    for(var i=trails.length-1;i>0;i--){trails[i].x=trails[i-1].x;trails[i].y=trails[i-1].y}
    trails[0].x=mx;trails[0].y=my;
    trails.forEach(function(t,i){t.el.style.left=t.x-2.5+'px';t.el.style.top=t.y-2.5+'px';t.el.style.opacity=String(0.3-i*0.035);t.el.style.transform='scale('+String(1-i*0.1)+')'});
    requestAnimationFrame(anim);
  }
  anim();
  
  function addHover(){
    document.querySelectorAll('a,button,.role-card,.nav-link,.btn,.tab-btn,[onclick]').forEach(function(el){
      el.addEventListener('mouseenter',function(){ring.style.transform='scale(1.5)';ring.style.borderColor='rgba(168,85,247,0.8)';dot.style.transform='scale(1.5)'});
      el.addEventListener('mouseleave',function(){ring.style.transform='scale(1)';ring.style.borderColor='rgba(168,85,247,0.4)';dot.style.transform='scale(1)'});
    });
  }
  addHover();
  // Re-bind on DOM changes (for dynamic content)
  var obs=new MutationObserver(function(){addHover()});
  obs.observe(document.body,{childList:true,subtree:true});
}

// ═══════════ THREE.JS 3D BACKGROUND ═══════════
function initThreeBackground(){
  if(typeof THREE==='undefined') return;
  
  var canvas=document.createElement('canvas');
  canvas.id='fx-three-bg';
  canvas.style.cssText='position:fixed;inset:0;z-index:0;pointer-events:none';
  document.body.insertBefore(canvas,document.body.firstChild);
  
  // Ensure page content is above canvas
  var pw=document.querySelector('.page-wrapper');
  if(pw) pw.style.position='relative'; if(pw) pw.style.zIndex='1';
  var sidebars=document.querySelectorAll('.sidebar,.admin-sidebar,.teacher-sidebar');
  sidebars.forEach(function(s){s.style.position='relative';s.style.zIndex='2'});
  
  var W=window.innerWidth,H=window.innerHeight;
  var scene=new THREE.Scene();
  var cam=new THREE.PerspectiveCamera(55,W/H,0.1,1000);
  cam.position.set(0,0,35);
  var ren=new THREE.WebGLRenderer({canvas:canvas,antialias:true,alpha:true});
  ren.setSize(W,H);ren.setPixelRatio(Math.min(window.devicePixelRatio,2));
  ren.setClearColor(0x000000,0); // transparent so page bg shows
  
  // Lights
  scene.add(new THREE.AmbientLight(0x221133,0.5));
  var pLights=[];
  [{c:0xA855F7,i:2,p:[12,10,10]},{c:0x3B82F6,i:1.5,p:[-12,-6,8]},{c:0xec4899,i:0.8,p:[0,15,-5]},{c:0x06b6d4,i:0.6,p:[-8,0,12]}].forEach(function(l){
    var p=new THREE.PointLight(l.c,l.i,55);p.position.set(l.p[0],l.p[1],l.p[2]);scene.add(p);pLights.push(p);
  });
  
  // Materials
  var gm=new THREE.MeshPhysicalMaterial({color:0x8b5cf6,transparent:true,opacity:0.12,roughness:0.05,metalness:0.4,clearcoat:1,clearcoatRoughness:0.05});
  var wm=new THREE.MeshBasicMaterial({color:0xA855F7,wireframe:true,transparent:true,opacity:0.06});
  var em=new THREE.MeshPhysicalMaterial({color:0x3B82F6,transparent:true,opacity:0.18,emissive:0x3B82F6,emissiveIntensity:0.4,roughness:0.15});
  var pm=new THREE.MeshPhysicalMaterial({color:0xec4899,transparent:true,opacity:0.1,emissive:0xec4899,emissiveIntensity:0.2});
  
  var shapes=[];
  function add(g,m,x,y,z,s){var o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.setScalar(s);o.userData={rx:(Math.random()-.5)*.01,ry:(Math.random()-.5)*.01,rz:(Math.random()-.5)*.005,fy:Math.random()*Math.PI*2,fa:Math.random()*0.4+0.3,ox:x,oy:y};scene.add(o);shapes.push(o)}
  
  add(new THREE.IcosahedronGeometry(1,0),gm,-14,7,5,2.5);
  add(new THREE.TorusGeometry(1,.35,16,60),em,16,5,-3,2);
  add(new THREE.OctahedronGeometry(1,0),gm,-9,-9,0,2);
  add(new THREE.IcosahedronGeometry(1,1),wm,12,-7,3,3.5);
  add(new THREE.TorusKnotGeometry(1,.28,100,16),em,0,12,-8,1.2);
  add(new THREE.DodecahedronGeometry(1,0),gm,17,11,-5,1.5);
  add(new THREE.TetrahedronGeometry(1,0),pm,-17,-4,-4,2.5);
  add(new THREE.SphereGeometry(1,20,20),wm,6,-12,-2,2.8);
  add(new THREE.ConeGeometry(1,2,6),gm,-4,14,2,1.5);
  add(new THREE.TorusGeometry(1.5,.2,12,40),em,20,-2,-6,1.3);
  add(new THREE.IcosahedronGeometry(1,2),wm,-18,0,8,2);
  add(new THREE.OctahedronGeometry(1,1),pm,8,16,-10,1.8);
  
  // Particles
  var pg=new THREE.BufferGeometry();var pc=500;var pp=new Float32Array(pc*3);
  for(var i=0;i<pc*3;i++) pp[i]=(Math.random()-.5)*70;
  pg.setAttribute('position',new THREE.BufferAttribute(pp,3));
  var pts=new THREE.Points(pg,new THREE.PointsMaterial({color:0xA855F7,size:0.06,transparent:true,opacity:0.3}));
  scene.add(pts);
  
  // Mouse interaction
  var mouseX=0,mouseY=0;
  document.addEventListener('mousemove',function(e){mouseX=(e.clientX/W-.5)*2;mouseY=(e.clientY/H-.5)*2});
  
  var t=0;
  function animate(){
    requestAnimationFrame(animate);t+=0.005;
    cam.position.x+=(mouseX*3-cam.position.x)*.015;
    cam.position.y+=(-mouseY*2-cam.position.y)*.015;
    cam.lookAt(0,0,0);
    shapes.forEach(function(s){s.rotation.x+=s.userData.rx;s.rotation.y+=s.userData.ry;s.rotation.z+=s.userData.rz||0;s.position.y=s.userData.oy+Math.sin(t*1.5+s.userData.fy)*s.userData.fa*3;s.position.x=s.userData.ox+Math.cos(t+s.userData.fy)*s.userData.fa*1.5});
    pLights[0].position.x=Math.sin(t*.5)*14;pLights[0].position.y=Math.cos(t*.3)*10;
    pLights[1].position.x=Math.cos(t*.4)*12;pLights[1].position.y=Math.sin(t*.6)*8;
    if(pLights[2]) pLights[2].position.z=Math.sin(t*.7)*8;
    pts.rotation.y+=0.0003;pts.rotation.x+=0.0001;
    ren.render(scene,cam);
  }
  animate();
  
  window.addEventListener('resize',function(){W=window.innerWidth;H=window.innerHeight;cam.aspect=W/H;cam.updateProjectionMatrix();ren.setSize(W,H)});
}

// ═══════════ INIT ═══════════
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){initCursor();initThreeBackground()});
}else{
  initCursor();initThreeBackground();
}
})();
