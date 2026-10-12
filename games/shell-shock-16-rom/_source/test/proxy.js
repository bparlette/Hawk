// Local server: serves ../site and mirrors EmulatorJS CDN files under /ejs/ into ../site/ejs (cached).
const http=require('http'),https=require('https'),fs=require('fs'),path=require('path');
const SITE='/workspace/work/g16/site', CDN='https://cdn.emulatorjs.org/stable/data/';
const MIME={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.png':'image/png','.svg':'image/svg+xml'};
const log=[];
function send(res,f){fs.readFile(f,(e,b)=>{if(e){res.writeHead(404);res.end();log.push('404 '+f);return;}res.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Access-Control-Allow-Origin':'*'});res.end(b);});}
function fetchCdn(u,dst,cb){https.get(u,r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location)return fetchCdn(new URL(r.headers.location,u).href,dst,cb);if(r.statusCode!==200){log.push('CDN '+r.statusCode+' '+u);r.resume();return cb(false);}const ch=[];r.on('data',c=>ch.push(c));r.on('end',()=>{fs.mkdirSync(path.dirname(dst),{recursive:true});fs.writeFileSync(dst,Buffer.concat(ch));cb(true);});}).on('error',e=>{log.push('ERR '+e.message);cb(false)});}
http.createServer((req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);log.push('GET '+u);
  if(u.startsWith('/ejs/')){const rel=u.slice(5),dst=path.join(SITE,'ejs',rel);if(fs.existsSync(dst))return send(res,dst);return fetchCdn(CDN+rel,dst,ok=>ok?send(res,dst):(res.writeHead(404),res.end()));}
  send(res,path.join(SITE,u==='/'?'index.html':u));}).listen(8123,()=>console.log('up'));
process.on('SIGTERM',()=>{fs.writeFileSync('/tmp/proxy.log',log.join('\n'));process.exit(0)});
setInterval(()=>fs.writeFileSync('/tmp/proxy.log',log.join('\n')),2000);
