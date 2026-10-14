<script>
/*sprite-sections: nothing renders and sprites.json + PNGs are not requested until a section is within 600px of the viewport*/
(function(){
  var GR=[["HERO","Heroes","#7fe08a"],["BOSS","Bosses","#ff3b28"],["MINI-BOSS","Mini-Bosses","#ff8a2a"],["ENEMY","Enemies","#e83aa0"],["ALLY","Allies","#3ab0ff"]];
  var secs=[].slice.call(document.querySelectorAll("section.spr")), data=null, loading=null;
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];});}
  function load(){ if(!loading) loading=fetch("sprites.json").then(function(r){if(!r.ok) throw new Error("sprites.json "+r.status); return r.json();}).then(function(d){data=d;return d;}); return loading; }
  function sz(p){ var h=Math.min(p.h,160), k=h/p.h; return {w:Math.max(1,Math.round(p.w*k)),h:h}; }
  function img(url,p,alt){ var s=sz(p); return '<img loading="lazy" decoding="async" src="'+esc(url)+'" width="'+s.w+'" height="'+s.h+'" alt="'+esc(alt)+'">'; }
  function where(c){ return c.lv? "Scene "+c.lv : "Every scene"; }
  function card(c,mode,ci){
    var col=(GR.filter(function(g){return g[0]===c.grp;})[0]||[0,0,"#ffd23c"])[2];
    var h='<div class="scard" style="--c:'+col+'" data-name="'+esc(c.name.toLowerCase())+'"><b>'+esc(c.name)+'</b><span class="slv">'+where(c)+'</span>';
    if(mode==="cast"){
      h+='<div class="sposes">'+c.poses.map(function(p,pi){ return '<figure><button type="button" data-ci="'+ci+'" data-pi="'+pi+'" aria-label="'+esc(c.name+" "+p.n)+' full size">'+img(p.bit16,p,c.name+" "+p.n+" (16-bit)")+'</button><figcaption>'+esc(p.n)+'</figcaption></figure>'; }).join("")+'</div>';
    } else {
      h+='<div class="svs">'+c.poses.map(function(p){ return '<div class="pair"><span class="pname">'+esc(p.n)+'</span><div><figure>'+img(p.bit16,p,c.name+" "+p.n+" 16-bit")+'<figcaption class="t16">16-bit</figcaption></figure><figure>'+img(p.painted,p,c.name+" "+p.n+" painted")+'<figcaption class="tp">Painted</figcaption></figure></div></div>'; }).join("")+'</div>';
    }
    return h+'</div>';
  }
  function build(sec){
    if(sec._built) return; sec._built=true;
    var mode=sec.getAttribute("data-mode"), body=sec.querySelector(".sbody"), nav=sec.querySelector(".sjump"), inp=sec.querySelector(".sfilter");
    load().then(function(d){
      body.innerHTML=""; var queue=[], grpEls={};
      GR.forEach(function(g){
        var list=d.map(function(c,i){return [c,i];}).filter(function(x){return x[0].grp===g[0];}); if(!list.length) return;
        var el=document.createElement("div"); el.className="sgrp"; el.id=sec.id+"-"+g[0].toLowerCase();
        var np=list.reduce(function(a,x){return a+x[0].poses.length;},0);
        el.innerHTML='<h3>'+g[1]+'<small>'+list.length+(list.length>1?" characters":" character")+' · '+np+' poses</small></h3><div class="scards"></div>';
        body.appendChild(el); grpEls[g[0]]=el;
        var b=document.createElement("button"); b.type="button"; b.textContent=g[1];
        b.addEventListener("click",function(){ flush(); el.scrollIntoView({behavior:"smooth",block:"start"}); }); nav.appendChild(b);
        list.forEach(function(x){ queue.push([el.querySelector(".scards"),x[0],x[1]]); });
      });
      function apply(){ var q=(inp.value||"").trim().toLowerCase();
        [].forEach.call(body.querySelectorAll(".scard"),function(c){ c.hidden=!!q && c.getAttribute("data-name").indexOf(q)<0; });
        Object.keys(grpEls).forEach(function(k){ var el=grpEls[k]; el.hidden=!!q && !el.querySelector(".scard:not([hidden])"); }); }
      function step(n){ var t=queue.splice(0,n), byBox=new Map();
        t.forEach(function(x){ byBox.set(x[0],(byBox.get(x[0])||"")+card(x[1],mode,x[2])); });
        byBox.forEach(function(h,box){ box.insertAdjacentHTML("beforeend",h); }); if(t.length) apply(); }
      function flush(){ step(queue.length); }
      sec._flush=flush;
      (function batch(){ step(mode==="cast"?6:4); if(queue.length) (window.requestIdleCallback||function(f){return setTimeout(f,16);})(batch); })();
      inp.addEventListener("input",function(){ flush(); apply(); });
      if(mode==="cast") body.addEventListener("click",function(e){ var b=e.target.closest("button[data-ci]"); if(b) open(+b.getAttribute("data-ci"),+b.getAttribute("data-pi"),sec); });
    }).catch(function(e){ sec._built=false; body.innerHTML='<p class="sload">Could not load the cast ('+esc(e.message)+'). Scroll back to retry.</p>'; });
  }
  /* lightbox over the (filtered) cast, prev/next across every visible pose */
  var lb=document.getElementById("slb"), lbi=lb.querySelector("img"), lbc=lb.querySelector("figcaption"), list=[], at=0, lastFocus=null;
  function visible(sec){ return [].slice.call(sec.querySelectorAll(".scard:not([hidden]) button[data-ci]")).filter(function(b){return !b.closest(".sgrp[hidden]");}).map(function(b){return [+b.getAttribute("data-ci"),+b.getAttribute("data-pi")];}); }
  function show(){ var x=list[at], c=data[x[0]], p=c.poses[x[1]];
    lbi.removeAttribute("src"); lbi.width=p.w; lbi.height=p.h; lbi.src=p.bit16; lbi.alt=c.name+" "+p.n+" (16-bit)";
    lbc.textContent=c.name+" · "+p.n+" · "+p.w+"×"+p.h+" ("+(at+1)+"/"+list.length+")"; }
  function open(ci,pi,sec){ if(sec._flush) sec._flush(); list=visible(sec); at=Math.max(0,list.findIndex(function(x){return x[0]===ci&&x[1]===pi;}));
    lastFocus=document.activeElement; lb.hidden=false; document.documentElement.style.overflow="hidden"; show(); lb.querySelector(".slb-x").focus(); }
  function close(){ lb.hidden=true; document.documentElement.style.overflow=""; if(lastFocus&&lastFocus.focus) lastFocus.focus(); }
  function go(d){ if(!list.length) return; at=(at+d+list.length)%list.length; show(); }
  lb.querySelector(".slb-x").addEventListener("click",close);
  lb.querySelector(".slb-p").addEventListener("click",function(e){e.stopPropagation();go(-1);});
  lb.querySelector(".slb-n").addEventListener("click",function(e){e.stopPropagation();go(1);});
  lb.addEventListener("click",function(e){ if(e.target===lb) close(); });
  document.addEventListener("keydown",function(e){ if(lb.hidden) return; if(e.key==="Escape") close(); else if(e.key==="ArrowLeft") go(-1); else if(e.key==="ArrowRight") go(1); });
  var sx=null; lb.addEventListener("touchstart",function(e){ sx=e.touches[0].clientX; },{passive:true});
  lb.addEventListener("touchend",function(e){ if(sx===null) return; var dx=e.changedTouches[0].clientX-sx; sx=null; if(Math.abs(dx)>50) go(dx<0?1:-1); });
  if("IntersectionObserver" in window){
    var io=new IntersectionObserver(function(es){ es.forEach(function(en){ if(en.isIntersecting){ build(en.target); if(en.target._built) io.unobserve(en.target); } }); },{rootMargin:"600px 0px"});
    secs.forEach(function(s){ io.observe(s); });
  } else { var chk=function(){ secs.forEach(function(s){ if(s.getBoundingClientRect().top<innerHeight+600) build(s); }); }; addEventListener("scroll",chk,{passive:true}); chk(); }
})();
</script>
