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
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
let attachmentMigrationPromise = null;
let telegramBotUsername = "";
let telegramPolling = false;

fs.mkdirSync(ATTACH_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`create table if not exists shared_snapshot (
  id text primary key,
  payload text not null,
  revision integer not null default 0,
  updated_at text not null
);
create table if not exists telegram_links (
  user_id text primary key,
  chat_id text not null unique,
  telegram_username text,
  linked_at text not null
);
create table if not exists telegram_link_codes (
  code text primary key,
  user_id text not null,
  expires_at integer not null
);
create table if not exists telegram_state (
  key text primary key,
  value text not null
);
create table if not exists telegram_sent (
  notice_id text primary key,
  sent_at text not null
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
function inferNoticeSender(payload, notice) {
  if (notice?.fromUserId) return notice.fromUserId;
  const tasks = arrayOf(payload?.app?.tasks);
  const task = notice?.taskId ? tasks.find((item) => item.id === notice.taskId) : undefined;
  if (!task) return undefined;

  const noticeAt = Date.parse(notice.at || "") || 0;
  const candidates = arrayOf(task.updates)
    .map((update) => ({
      authorId: update.authorId,
      at: Date.parse(update.editedAt || update.at || "") || 0,
    }))
    .filter((update) => update.authorId && (!noticeAt || update.at <= noticeAt + 3000))
    .sort((a, b) => b.at - a.at);

  if (candidates[0]?.authorId) return candidates[0].authorId;
  if (typeof task.issuedById === "string" && task.issuedById) return task.issuedById;
  return undefined;
}
function enrichNoticeSenders(payload) {
  const app = payload?.app;
  if (!app || !Array.isArray(app.notices)) return payload;
  let changed = false;
  const notices = app.notices.map((notice) => {
    if (!notice || notice.fromUserId) return notice;
    const fromUserId = inferNoticeSender(payload, notice);
    if (!fromUserId) return notice;
    changed = true;
    return { ...notice, fromUserId };
  });
  return changed ? { ...payload, app: { ...app, notices } } : payload;
}
function writeRow(payload, revision, notifyTelegram = true) {
  const previous = currentRow().payload;
  const enrichedPayload = enrichNoticeSenders(payload);
  const updatedAt = new Date().toISOString();
  db.prepare("update shared_snapshot set payload=?, revision=?, updated_at=? where id=?")
    .run(JSON.stringify(enrichedPayload), revision, updatedAt, "main");
  if (notifyTelegram) void dispatchTelegramNotices(previous, enrichedPayload);
  return { payload: enrichedPayload, revision, updated_at: updatedAt };
}
function arrayOf(value) { return Array.isArray(value) ? value.filter((x)=>x && typeof x === "object") : []; }
function byId(items) { const m=new Map(); for(const x of items){ if(typeof x.id==="string" && x.id) m.set(x.id,x); } return m; }
function timeOf(v){ return typeof v==="string" ? v : ""; }

async function telegramApi(method, body = {}) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("telegram_not_configured");
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(method === "getUpdates" ? 35_000 : 12_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(`telegram_${method}_failed`);
  return data.result;
}
async function ensureTelegramIdentity() {
  if (!TELEGRAM_BOT_TOKEN) return "";
  if (telegramBotUsername) return telegramBotUsername;
  const me = await telegramApi("getMe");
  telegramBotUsername = String(me?.username || "");
  return telegramBotUsername;
}
function telegramUserExists(userId) {
  if (userId === "__system-administrator__") return true;
  return arrayOf(currentRow().payload?.org?.users).some((user) => user.id === userId && user.active !== false);
}
async function sendTelegram(chatId, text) {
  await telegramApi("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}
async function dispatchTelegramNotices(previousPayload, nextPayload) {
  if (!TELEGRAM_BOT_TOKEN) return;
  const before = new Set(arrayOf(previousPayload?.app?.notices).map((notice) => notice.id).filter(Boolean));
  const added = arrayOf(nextPayload?.app?.notices).filter((notice) => notice.id && !before.has(notice.id));
  for (const notice of added) {
    if (!notice.userId || !notice.text) continue;
    if (db.prepare("select 1 from telegram_sent where notice_id=?").get(notice.id)) continue;
    const link = db.prepare("select chat_id from telegram_links where user_id=?").get(notice.userId);
    if (!link?.chat_id) continue;
    try {
      const orgUsers = arrayOf(nextPayload?.org?.users);
      const senderName = notice.fromUserId === "__system-administrator__"
        ? "Administrator"
        : orgUsers.find((user) => user.id === notice.fromUserId)?.name || "النظام";
      await sendTelegram(link.chat_id, `إشعار جديد — فرع اتصالات ريف دمشق\nمن: ${senderName}\n\n${notice.text}`);
      db.prepare("insert or ignore into telegram_sent(notice_id,sent_at) values(?,?)").run(notice.id, new Date().toISOString());
    } catch (error) { console.error("telegram notification failed", notice.id, error); }
  }
}
async function handleTelegramUpdate(update) {
  const message = update?.message;
  const chatId = message?.chat?.id;
  if (!chatId) return;
  const text = String(message?.text || "").trim();
  if (!text.startsWith("/start")) return;
  const code = text.split(/\s+/)[1]?.toUpperCase() || "";
  if (!code) {
    await sendTelegram(chatId, "افتح «حسابي» في موقع فرع اتصالات ريف دمشق واضغط «ربط تيليغرام»، ثم افتح رابط البوت من هناك.");
    return;
  }
  const row = db.prepare("select user_id,expires_at from telegram_link_codes where code=?").get(code);
  if (!row || Number(row.expires_at) < Date.now() || !telegramUserExists(row.user_id)) {
    db.prepare("delete from telegram_link_codes where code=?").run(code);
    await sendTelegram(chatId, "رمز الربط غير صالح أو انتهت صلاحيته. أنشئ رمزاً جديداً من الموقع.");
    return;
  }
  const username = String(message?.from?.username || "");
  const at = new Date().toISOString();
  db.prepare(`insert into telegram_links(user_id,chat_id,telegram_username,linked_at)
    values(?,?,?,?)
    on conflict(user_id) do update set chat_id=excluded.chat_id,telegram_username=excluded.telegram_username,linked_at=excluded.linked_at`)
    .run(row.user_id, String(chatId), username, at);
  db.prepare("delete from telegram_link_codes where user_id=?").run(row.user_id);
  await sendTelegram(chatId, "تم ربط حسابك بنجاح. ستصلك إشعارات العمل المهمة من النظام هنا.");
}
async function telegramPollLoop() {
  if (!TELEGRAM_BOT_TOKEN || telegramPolling) return;
  telegramPolling = true;
  try {
    await ensureTelegramIdentity();
    while (telegramPolling) {
      const saved = db.prepare("select value from telegram_state where key='update_offset'").get();
      const offset = Number(saved?.value || 0);
      try {
        const updates = await telegramApi("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
        for (const update of Array.isArray(updates) ? updates : []) {
          await handleTelegramUpdate(update);
          const next = Number(update.update_id) + 1;
          db.prepare(`insert into telegram_state(key,value) values('update_offset',?)
            on conflict(key) do update set value=excluded.value`).run(String(next));
        }
      } catch (error) {
        console.error("telegram polling error", error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  } finally { telegramPolling = false; }
}
async function handleTelegramApi(req, res, url) {
  if (req.method === "OPTIONS") { res.writeHead(204, cors()); return res.end(); }
  if (!authorized(req)) return sendJson(res, { error: "unauthorized" }, 401);
  const configured = Boolean(TELEGRAM_BOT_TOKEN);
  const userIdFromQuery = url.searchParams.get("userId") || "";
  if (url.pathname === "/api/telegram/status" && req.method === "GET") {
    const userId = userIdFromQuery;
    if (!telegramUserExists(userId)) return sendJson(res, { error: "user_not_found" }, 404);
    if (configured && !telegramBotUsername) { try { await ensureTelegramIdentity(); } catch {} }
    const link = db.prepare("select telegram_username,linked_at from telegram_links where user_id=?").get(userId);
    return sendJson(res, { configured, linked: Boolean(link), botUsername: telegramBotUsername || undefined, telegramUsername: link?.telegram_username || undefined, linkedAt: link?.linked_at || undefined });
  }
  if (url.pathname === "/api/telegram/link" && req.method === "POST") {
    if (!configured) return sendJson(res, { configured: false, error: "telegram_not_configured" }, 503);
    const body = await readJsonBody(req);
    const userId = String(body?.userId || "");
    if (!telegramUserExists(userId)) return sendJson(res, { error: "user_not_found" }, 404);
    const username = await ensureTelegramIdentity();
    if (!username) return sendJson(res, { error: "bot_identity_unavailable" }, 503);
    db.prepare("delete from telegram_link_codes where user_id=? or expires_at<?").run(userId, Date.now());
    const code = crypto.randomBytes(6).toString("hex").toUpperCase();
    const expiresAt = Date.now() + 15 * 60_000;
    db.prepare("insert into telegram_link_codes(code,user_id,expires_at) values(?,?,?)").run(code, userId, expiresAt);
    return sendJson(res, { configured: true, code, expiresAt: new Date(expiresAt).toISOString(), url: `https://t.me/${username}?start=${code}` });
  }
  if (url.pathname === "/api/telegram/link" && req.method === "DELETE") {
    const userId = userIdFromQuery;
    if (!telegramUserExists(userId)) return sendJson(res, { error: "user_not_found" }, 404);
    db.prepare("delete from telegram_links where user_id=?").run(userId);
    db.prepare("delete from telegram_link_codes where user_id=?").run(userId);
    return sendJson(res, { ok: true });
  }
  if (url.pathname === "/api/telegram/test" && req.method === "POST") {
    if (!configured) return sendJson(res, { error: "telegram_not_configured" }, 503);
    const body = await readJsonBody(req);
    const userId = String(body?.userId || "");
    if (!telegramUserExists(userId)) return sendJson(res, { error: "user_not_found" }, 404);
    const link = db.prepare("select chat_id from telegram_links where user_id=?").get(userId);
    if (!link?.chat_id) return sendJson(res, { error: "telegram_not_linked" }, 409);
    await sendTelegram(link.chat_id, "اختبار ناجح ✅\n\nتم ربط حسابك بمنظومة فرع اتصالات ريف دمشق بنجاح، وإشعارات النظام عبر تيليغرام تعمل بشكل صحيح.");
    return sendJson(res, { ok: true });
  }
  return sendJson(res, { error: "method_not_allowed" }, 405);
}

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
    if(Number(upstream.revision)>=Number(current.revision)) writeRow(upstream.payload,Number(upstream.revision),false);
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
    if(url.pathname==="/health") return sendJson(res,{ok:true,service:"operations-app",telegramConfigured:Boolean(TELEGRAM_BOT_TOKEN),time:new Date().toISOString()});
    if(url.pathname==="/api/workspace-sync") return await handleApi(req,res,url);
    if(url.pathname.startsWith("/api/telegram/")) return await handleTelegramApi(req,res,url);
    return serveStatic(req,res,url);
  }catch(error){
    console.error(error);
    if(!res.headersSent) sendJson(res,{error:"internal_error"},500); else res.end();
  }
});
server.listen(PORT,"0.0.0.0",()=>{
  console.log(`operations-app listening on 0.0.0.0:${PORT}`);
  if (TELEGRAM_BOT_TOKEN) void telegramPollLoop();
});
