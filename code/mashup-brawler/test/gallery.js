const G={rt:0,ff:false};
function galleryDraw(){x.setTransform(BASE,0,0,BASE,0,0);x.fillStyle='#7fb6e8';x.fillRect(0,0,W,H);
 const list=[['sonic','master'],['metal',''],['bowser','claw'],['mario','fists'],['luigi',''],['ganon',''],['dk','nunch'],['diddy',''],['egg',''],['kirby','pipe'],['mrx',''],['goon1',''],['goon2',''],['samus','broad']];
 list.forEach(([n,w],i)=>{const col=i%3,row=Math.floor(i/3);const o={x:180+col*360,y:380+row*380,face:1,wpn:w,t:1,sc:.62};drawChar(CHAR[n],o);stext(n,o.x,o.y+30,30,'#fff')});
 // attack poses
}
galleryDraw();
