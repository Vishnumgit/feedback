/* effects.js — Custom Cursor for Student Feedback Hub
   Auto-initializes on any page that loads this script. */
(function(){
"use strict";

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
  var obs=new MutationObserver(function(){addHover()});
  obs.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',function(){initCursor()});
}else{
  initCursor();
}
})();
