import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { DatabaseSync } from "node:sqlite";

const ROOT = path.resolve(process.env.APP_ROOT || process.cwd());
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(ROOT, "dist/client"));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, "data"));
const ATTACH_DIR = path.join(DATA_DIR, "attachments");
const DB_PATH = path.join(DATA_DIR, "operations.sqlite");
const SEED_PATH = path.join(DATA_DIR, "seed-snapshot.json");
const UPSTREAM_MANIFEST_PATH = path.join(DATA_DIR, "upstream-attachments.json");
const UPSTREAM_IMPORT_MARKER = path.join(DATA_DIR, "upstream-imported.json");
const PORT = Number(process.env.PORT || 8080);
const EXPECTED_HASH = process.env.WORKSPACE_KEY_HASH || "ec46eb36bb7e5a949866c89c1df8fd2bda7546511b21106c0bf8c82a1a0a10b0";
const UPSTREAM_SYNC_ENDPOINT = (process.env.UPSTREAM_SYNC_ENDPOINT || "https://fxpnnmtlopuunptiaval.supabase.co/functions/v1/workspace-sync").replace(/\/+$/, "");
let attachmentMigrationPromise = null;

fs.mkdirSync(ATTACH_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`create table if not exists shared_snapshot (
  id text primary key,
  payload text not null,
  revision integer not null default 0,
  updated_at text not null
)`);

function seedIfNeeded() {
  const row = db.prepare("select id from shared_snapshot where id=?").get("main");
  if (row) return;
  let payload = {};
  let revision = 0;
  let updatedAt = new Date().toISOString();
  if (fs.existsSync(SEED_PATH)) {
    const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
    payload = seed.payload ?? seed;
    revision = Number(seed.revision ?? 0);
    updatedAt = seed.updated_at ?? updatedAt;
  }
  db.prepare("insert into shared_snapshot(id,payload,revision,updated_at) values(?,?,?,?)")
    .run("main", JSON.stringify(payload), revision, updatedAt);
}
seedIfNeeded();

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function authorized(req) {
  const key = String(req.headers["x-workspace-key"] || "");
  return key && hash(key) === EXPECTED_HASH;
}
function cors(extra={}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type,x-workspace-key,cache-control",
    "Access-Control-Allow-Methods": "GET,POST,HEAD,OPTIONS",
    ...extra,
  };
}
function sendJson(res, data, status=200) {
  const body = JSON.stringify(data);
  res.writeHead(status, cors({"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}));
  res.end(body);
}
function currentRow() {
  const row = db.prepare("select payload,revision,updated_at from shared_snapshot where id=?").get("main");
  return { payload: JSON.parse(row.payload), revision: Number(row.revision), updated_at: row.updated_at };
}
function writeRow(payload, revision) {
  const updatedAt = new Date().toISOString();
  db.prepare("update shared_snapshot set payload=?, revision=?, updated_at=? where id=?")
    .run(JSON.stringify(payload), revision, updatedAt, "main");
  return { payload, revision, updated_at: updatedAt };
}
function arrayOf(value) { return Array.isArray(value) ? value.filter((x)=>x && typeof x === "object") : []; }
function byId(items) { const m=new Map(); for(const x of items){ if(typeof x.id==="string" && x.id) m.set(x.id,x); } return m; }
function timeOf(v){ return typeof v==="string" ? v : ""; }
function mergeUpdates(a,b){
  const m=new Map();
  for(const u of [...arrayOf(a),...arrayOf(b)]){
    if(!u.id) continue;
    const p=m.get(u.id);
    const uv=timeOf(u.editedAt)||timeOf(u.at);
    const pv=p ? (timeOf(p.editedAt)||timeOf(p.at)) : "";
    if(!p || pv<=uv) m.set(u.id,u);
  }
  return [...m.values()].sort((x,y)=>timeOf(x.at).localeCompare(timeOf(y.at)));
}
function mergeTask(existing,incoming){
  if(!existing) return incoming;
  const incomingNewer=timeOf(existing.updatedAt)<=timeOf(incoming.updatedAt);
  const newer=incomingNewer?incoming:existing;
  const older=incomingNewer?existing:incoming;
  const updates=mergeUpdates(existing.updates,incoming.updates);
  const latest=updates.length ? (timeOf(updates.at(-1).editedAt)||timeOf(updates.at(-1).at)) : "";
  return {...older,...newer,updates,updatedAt:[timeOf(existing.updatedAt),timeOf(incoming.updatedAt),latest].sort().at(-1)};
}
function mergeNotice(existing,incoming){
  if(!existing) return incoming;
  const newer=timeOf(existing.at)<=timeOf(incoming.at)?incoming:existing;
  return {...existing,...newer,read:Boolean(existing.read)||Boolean(incoming.read)};
}
function mergeDelta(payload, body){
  const app={...(payload.app||{})};
  const tasks=byId(arrayOf(app.tasks));
  for(const task of arrayOf(body.tasks)) if(task.id) tasks.set(task.id,mergeTask(tasks.get(task.id),task));
  const notices=byId(arrayOf(app.notices));
  for(const notice of arrayOf(body.notices)) if(notice.id) notices.set(notice.id,mergeNotice(notices.get(notice.id),notice));
  return {...payload,app:{...app,tasks:[...tasks.values()],notices:[...notices.values()]}};
}
function safeName(name){ return String(name||"attachment").replace(/[\\/\0\r\n]/g,"_").slice(0,180)||"attachment"; }
function safeObjectPath(raw){
  const ext=(String(raw).toLowerCase().match(/\.([a-z0-9]{1,10})$/)||[])[0]||"";
  return `attachments/${crypto.randomUUID()}/file${ext}`;
}
function localAttachmentFile(objectPath){
  if(!objectPath.startsWith("attachments/") || objectPath.includes("..")) return null;
  return path.join(DATA_DIR, objectPath);
}
function attachmentManifest(){
  try {
    const parsed=JSON.parse(fs.readFileSync(UPSTREAM_MANIFEST_PATH,"utf8"));
    return Array.isArray(parsed) ? parsed.filter((item)=>item && typeof item.name==="string") : [];
  } catch { return []; }
}
async function cacheUpstreamAttachment(objectPath,key,expectedSize){
  const target=localAttachmentFile(objectPath);
  if(!target) return false;
  if(fs.existsSync(target) && (!expectedSize || fs.statSync(target).size===Number(expectedSize))) return true;
  const params=new URLSearchParams({attachment:"download",path:objectPath,name:path.basename(objectPath)});
  const response=await fetch(`${UPSTREAM_SYNC_ENDPOINT}?${params.toString()}`,{headers:{"x-workspace-key":key}});
  if(!response.ok) return false;
  const bytes=Buffer.from(await response.arrayBuffer());
  if(expectedSize && bytes.length!==Number(expectedSize)) throw new Error(`attachment_size_mismatch:${objectPath}`);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const temp=`${target}.part-${process.pid}`;
  fs.writeFileSync(temp,bytes);
  fs.renameSync(temp,target);
  return true;
}
async function migrateUpstreamAttachments(key){
  const manifest=attachmentManifest();
  if(!manifest.length) return {copied:0,total:0};
  let copied=0;
  for(const item of manifest){
    try { if(await cacheUpstreamAttachment(item.name,key,item.size)) copied+=1; }
    catch(error){ console.error("attachment migration failed",item.name,error); }
  }
  console.log(`attachment migration complete ${copied}/${manifest.length}`);
  return {copied,total:manifest.length};
}
async function importUpstreamSnapshotOnce(key){
  if(fs.existsSync(UPSTREAM_IMPORT_MARKER)) return {imported:false,reason:"already_imported"};
  try {
    const response=await fetch(`${UPSTREAM_SYNC_ENDPOINT}?state=1&_=${Date.now()}`,{cache:"no-store",headers:{"x-workspace-key":key}});
    if(!response.ok) return {imported:false,reason:`upstream_${response.status}`};
    const upstream=await response.json();
    if(!upstream?.payload || !Number.isFinite(Number(upstream.revision))) return {imported:false,reason:"invalid_upstream"};
    const current=currentRow();
    if(Number(upstream.revision)>=Number(current.revision)) writeRow(upstream.payload,Number(upstream.revision));
    const marker={at:new Date().toISOString(),upstreamRevision:Number(upstream.revision),localRevision:currentRow().revision};
    fs.writeFileSync(UPSTREAM_IMPORT_MARKER,JSON.stringify(marker,null,2),{mode:0o600});
    console.log("upstream snapshot import complete",marker);
    return {imported:true,...marker};
  } catch(error) {
    console.error("upstream snapshot import failed",error);
    return {imported:false,reason:"upstream_error"};
  }
}
async function readJsonBody(req){
  const chunks=[]; for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");
}
async function handleApi(req,res,url){
  if(req.method==="OPTIONS"){ res.writeHead(204,cors()); return res.end(); }
  if(!authorized(req)) return sendJson(res,{error:"unauthorized"},401);
  const workspaceKey=String(req.headers["x-workspace-key"]||"");
  if(url.searchParams.get("verify")==="1"){
    const upstreamImport=await importUpstreamSnapshotOnce(workspaceKey);
    if(!attachmentMigrationPromise){
      attachmentMigrationPromise=migrateUpstreamAttachments(workspaceKey).finally(()=>{ attachmentMigrationPromise=null; });
    }
    return sendJson(res,{ok:true,revision:currentRow().revision,upstreamImport});
  }
  const attachment=url.searchParams.get("attachment");
  if(attachment==="sign-upload" && req.method==="POST") return sendJson(res,{error:"local_simple_upload_only"},501);
  if(attachment==="upload" && req.method==="POST"){
    const request=new Request(`http://localhost${req.url}`,{method:"POST",headers:req.headers,body:Readable.toWeb(req),duplex:"half"});
    const form=await request.formData();
    const file=form.get("file");
    if(!(file instanceof File) || !file.size) return sendJson(res,{error:"file_required"},400);
    const objectPath=safeObjectPath(file.name);
    const target=localAttachmentFile(objectPath);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,Buffer.from(await file.arrayBuffer()));
    return sendJson(res,{path:objectPath,name:safeName(file.name),mime:file.type||"application/octet-stream",size:file.size});
  }
  if(attachment==="download" && req.method==="GET"){
    const objectPath=url.searchParams.get("path")||"";
    const target=localAttachmentFile(objectPath);
    if(!target) return sendJson(res,{error:"attachment_not_found"},404);
    if(!fs.existsSync(target)) await cacheUpstreamAttachment(objectPath,workspaceKey);
    if(!fs.existsSync(target)) return sendJson(res,{error:"attachment_not_found"},404);
    const name=safeName(url.searchParams.get("name")||path.basename(target));
    res.writeHead(200,cors({"Content-Type":"application/octet-stream","Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(name)}`,"Content-Length":String(fs.statSync(target).size)}));
    return fs.createReadStream(target).pipe(res);
  }
  if(url.searchParams.get("merge-app-delta")==="1" && req.method==="POST"){
    const body=await readJsonBody(req);
    const current=currentRow();
    const next=mergeDelta(current.payload,body);
    return sendJson(res,writeRow(next,current.revision+1));
  }
  if(req.method==="GET") return sendJson(res,currentRow());
  if(req.method==="POST"){
    const body=await readJsonBody(req);
    if(!body.payload || typeof body.payload!=="object") return sendJson(res,{error:"invalid_payload"},400);
    const current=currentRow();
    const expected=Number(body.revision ?? -1);
    if(expected>=0 && expected!==current.revision) return sendJson(res,{error:"revision_conflict",revision:current.revision},409);
    return sendJson(res,writeRow(body.payload,current.revision+1));
  }
  return sendJson(res,{error:"method_not_allowed"},405);
}
const mime={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon",".woff2":"font/woff2"};
function serveStatic(req,res,url){
  let rel=decodeURIComponent(url.pathname);
  if(rel==="/") rel="/index.html";
  let target=path.resolve(STATIC_DIR,"."+rel);
  if(!target.startsWith(STATIC_DIR)) { res.writeHead(403); return res.end("Forbidden"); }
  if(!fs.existsSync(target) || fs.statSync(target).isDirectory()){
    const index=path.join(STATIC_DIR,"index.html");
    const shell=path.join(STATIC_DIR,"_shell.html");
    target=fs.existsSync(index)?index:shell;
  }
  if(!fs.existsSync(target)){ res.writeHead(503,{"Content-Type":"text/plain"}); return res.end("Application build not found"); }
  const ext=path.extname(target).toLowerCase();
  res.writeHead(200,{"Content-Type":mime[ext]||"application/octet-stream","Cache-Control":ext===".html"?"no-store":"public, max-age=3600"});
  fs.createReadStream(target).pipe(res);
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||"/","http://localhost");
    if(url.pathname==="/health") return sendJson(res,{ok:true,service:"operations-app",time:new Date().toISOString()});
    if(url.pathname==="/api/workspace-sync") return await handleApi(req,res,url);
    return serveStatic(req,res,url);
  }catch(error){
    console.error(error);
    if(!res.headersSent) sendJson(res,{error:"internal_error"},500); else res.end();
  }
});
server.listen(PORT,"0.0.0.0",()=>console.log(`operations-app listening on 0.0.0.0:${PORT}`));
