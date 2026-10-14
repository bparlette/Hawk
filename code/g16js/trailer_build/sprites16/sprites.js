<script>
/* THE CAST (16-bit) + 16-BIT VS LIVE (adapted from trailer_v2/sprites_patch): nothing is fetched or built until the section is near the viewport */
(function(){
  var secs=[].slice.call(document.querySelectorAll("section.spr")); if(!secs.length) return;
  var GR=[["HERO","Heroes","#3ae06a"],["BOSS","Bosses","#ff3b28"],["MINI-BOSS","Mini-Bosses","#ff8a2a"],["ENEMY","Enemies","#c43aff"],["ALLY","Allies","#3ab8e0"]];
  var dataP=null;
  function data(){ if(!dataP) dataP=fetch("sprites.json").then(function(r){ if(!r.ok) throw new Error("sprites.json "+r.status); return r.json(); }); return dataP; }
  var idle=window.requestIdleCallback?function(f){ requestIdleCallback(f,{timeout:300}); }:function(f){ setTimeout(function(){ f({timeRemaining:function(){return 8;}}); },16); };
  function el(t,c,txt){ var e=document.createElement(t); if(c) e.className=c; if(txt!=null) e.textContent=txt; return e; }
  function img(src,w,h,max,px){ var s=Math.min(1,max/h), i=new Image(); i.loading="lazy"; i.decoding="async"; i.setAttribute("loading","lazy"); i.setAttribute("decoding","async");
    i.width=Math.round(w*s); i.height=Math.round(h*s); i.style.width=i.width+"px"; i.alt=""; if(px) i.className="px"; i.src=src; return i; }
  function scene(lv){ return lv?("Scene "+lv):"Every scene"; }
  /* lightbox (cast) */
  var lb=null, list=[], li=0;
  function lbShow(){ var p=list[li]; if(!p) return; var im=lb.querySelector("img"); im.src=p.p.bit16; im.className="px"; im.width=p.p.w; im.height=p.p.h; im.alt=p.c.name+" "+p.p.n;
    lb.querySelector(".lcap").innerHTML=""; var cap=lb.querySelector(".lcap"); cap.appendChild(document.createTextNode(p.c.name)); cap.appendChild(el("small",null,p.p.n+" · "+scene(p.c.lv)+" · "+(li+1)+" / "+list.length)); }
  function lbOpen(items,i){ if(!lb){ lb=el("div"); lb.id="slb"; lb.setAttribute("role","dialog"); lb.setAttribute("aria-modal","true");
      lb.innerHTML='<img alt="" decoding="async"><div class="lcap"></div><button class="lx" type="button" aria-label="Close">✕</button><button class="lp" type="button" aria-label="Previous">‹</button><button class="ln" type="button" aria-label="Next">›</button>';
      document.body.appendChild(lb);
      lb.querySelector(".lx").onclick=lbClose; lb.querySelector(".lp").onclick=function(e){ e.stopPropagation(); step(-1); }; lb.querySelector(".ln").onclick=function(e){ e.stopPropagation(); step(1); };
      lb.addEventListener("click",function(e){ if(e.target===lb) lbClose(); });
      var sx=null; lb.addEventListener("touchstart",function(e){ sx=e.touches[0].clientX; },{passive:true});
      lb.addEventListener("touchend",function(e){ if(sx==null) return; var dx=e.changedTouches[0].clientX-sx; sx=null; if(Math.abs(dx)>40) step(dx<0?1:-1); },{passive:true});
      document.addEventListener("keydown",function(e){ if(!lb.classList.contains("on")) return; if(e.key==="Escape") lbClose(); else if(e.key==="ArrowLeft") step(-1); else if(e.key==="ArrowRight") step(1); });
    }
    list=items; li=i; lbShow(); lb.classList.add("on"); }
  function lbClose(){ if(lb) lb.classList.remove("on"); }
  function step(d){ li=(li+d+list.length)%list.length; lbShow(); }

  function build(sec,chars){
    var mode=sec.getAttribute("data-mode"), body=sec.querySelector(".sbody"), id=sec.id;
    var tool=el("div","stool"), groups=[], cards=[], q="";
    var inp=el("input"); inp.type="search"; inp.placeholder="Filter by name"; inp.setAttribute("aria-label","Filter characters by name"); inp.autocomplete="off";
    GR.forEach(function(g){
      var cs=chars.filter(function(c){ return c.grp===g[0]; }); if(!cs.length) return;
      var n=cs.reduce(function(a,c){ return a+c.poses.length; },0);
      var box=el("div","sgrp"); box.id=id+"-"+g[0].toLowerCase(); var h=el("h3",null,g[1]); h.appendChild(el("small",null,cs.length+(cs.length>1?" characters · ":" character · ")+n+" poses")); box.appendChild(h);
      var wrap=el("div","scards"); box.appendChild(wrap); body.appendChild(box);
      var b=el("button",null,g[1]); b.type="button"; b.onclick=function(){ box.scrollIntoView(); var n=0, y=scrollY; (function fix(){ if(++n>6||Math.abs(scrollY-y)>4) return; var t=box.getBoundingClientRect().top; if(Math.abs(t-12)>4){ box.scrollIntoView(); } y=scrollY; setTimeout(fix,250); })(); }; tool.appendChild(b);
      var G={g:g,cs:cs,box:box,wrap:wrap,done:0,busy:false}; groups.push(G);
    });
    tool.appendChild(inp); body.insertBefore(tool,body.firstChild);
    function match(c){ return !q || c.name.toLowerCase().indexOf(q)>=0; }
    function card(c,color){
      var d=el("div","scard"); d.style.setProperty("--c",color); d._c=c; d.appendChild(el("b",null,c.name)); d.appendChild(el("span","slv",scene(c.lv)));
      var ps=el("div","sposes");
      c.poses.forEach(function(p,pi){
        if(mode==="cast"){
          var bt=el("button","spose"); bt.type="button"; bt.setAttribute("aria-label",c.name+" "+p.n+", view full size");
          var f=el("figure"); f.appendChild(img(p.bit16,p.w,p.h,160,true)); f.appendChild(el("figcaption",null,p.n)); bt.appendChild(f);
          bt.onclick=function(){ var items=[], at=0; groups.forEach(function(G){ G.cs.forEach(function(cc){ if(!match(cc)) return; cc.poses.forEach(function(pp){ if(cc===c&&pp===p) at=items.length; items.push({c:cc,p:pp}); }); }); }); lbOpen(items,at); };
          ps.appendChild(bt);
        } else {
          var pr=el("div","spair"), row=el("div");
          var f1=el("figure"); f1.appendChild(img(p.painted,p.w,p.h,140,false)); f1.appendChild(el("figcaption",null,"LIVE"));
          var f2=el("figure"); f2.appendChild(img(p.bit16,p.w,p.h,140,true)); f2.appendChild(el("figcaption",null,"16-BIT"));
          f1.querySelector("img").alt=c.name+" "+p.n+" live"; f2.querySelector("img").alt=c.name+" "+p.n+" 16-bit";
          row.appendChild(f2); row.appendChild(f1); pr.appendChild(row); pr.appendChild(el("span",null,p.n)); ps.appendChild(pr);
        }
      });
      if(mode==="cast") ps.querySelectorAll("img").forEach(function(im,k){ im.alt=c.name+" "+c.poses[k].n+" (16-bit)"; });
      d.appendChild(ps); d.hidden=!match(c); return d;
    }
    /* batched render: each group has a sentinel after its rendered cards; unrendered space is reserved with min-height so
       later groups stay far away and only the group being scrolled into is built, a few cards per idle slice */
    function near(G){ var r=G.sen.getBoundingClientRect(); return r.top<innerHeight+600 && r.bottom>-600; }
    function renderGroup(G,all){ if(all) G.all=true; if(G.busy||G.done>=G.cs.length) return; G.busy=true;
      (function chunk(){ var t0=Date.now(), k=0;
        while(G.done<G.cs.length && (k<1 || (k<3 && Date.now()-t0<8))){ var cd=card(G.cs[G.done++],G.g[2]); cards.push(cd); G.wrap.insertBefore(cd,G.sen); k++; }
        G.wrap.style.minHeight=G.done<G.cs.length?((G.cs.length-G.done)*G.est+"px"):"";
        if(G.done<G.cs.length && (G.all||near(G))) idle(chunk); else G.busy=false; })();
    }
    function vis(G){ var any=G.cs.some(match); G.box.hidden=!any; }
    var gio=new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting) groups.forEach(function(G){ if(G.sen===e.target) renderGroup(G); }); }); },{rootMargin:"600px 0px"});
    groups.forEach(function(G){ G.sen=el("div"); G.sen.style.height="1px"; G.wrap.appendChild(G.sen); G.est=mode==="cast"?(innerWidth<600?420:240):(innerWidth<600?900:420);
      G.wrap.style.minHeight=(G.cs.length*G.est)+"px"; gio.observe(G.sen); });
    var tmr; inp.addEventListener("input",function(){ clearTimeout(tmr); tmr=setTimeout(function(){
      q=inp.value.trim().toLowerCase(); cards.forEach(function(cd){ cd.hidden=!match(cd._c); }); groups.forEach(vis);
      if(q) groups.forEach(function(G){ if(G.cs.some(match)) renderGroup(G,true); }); },120); });
  }
  var io=new IntersectionObserver(function(es){ es.forEach(function(e){ if(!e.isIntersecting) return; io.unobserve(e.target); var sec=e.target;
    data().then(function(d){ build(sec,d); }).catch(function(err){ var m=sec.querySelector(".sbody"); m.appendChild(el("p","smore","Couldn't load the sprites right now. Reload to try again.")); dataP=null; }); }); },{rootMargin:"600px 0px"});
  secs.forEach(function(s){ io.observe(s); });
})();
</script>
