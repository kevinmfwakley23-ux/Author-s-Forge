import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { FileProjectStore } from "./infrastructure/file-project-store";
import { createProject, withProjectBookGenome } from "./domain/project";
import { createMemoryRecord, type MemoryAuthority, type MemoryClass } from "./domain/memory";
import { BookGenomeService, FinalProductAuditService, GovernanceService } from "./application/final-product-systems";
import { DELIVERY_AUDIT_CATEGORIES as FINAL_AUDIT_CATEGORIES, type BookGenomeNode, type FinalDeliveryCheck } from "./domain/final-product-systems";

const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "127.0.0.1";
const dataRoot = process.env.FORGE_DATA_DIR ?? join(process.cwd(), ".forge-data");
const publicRoot = join(process.cwd(), "public");
const store = new FileProjectStore(dataRoot);
const genome = new BookGenomeService();
const audit = new FinalProductAuditService();
const governance = new GovernanceService();
const defaultProjectId = "forge-studio";

async function ensureDefaultProject():Promise<void> { if(!(await store.exists(defaultProjectId))) await store.create(createProject({id:defaultProjectId,title:"My First Forge Book"})); }
function json(res:ServerResponse,status:number,value:unknown):void { const responseBody=JSON.stringify(value); res.writeHead(status,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}); res.end(responseBody); }
function text(res:ServerResponse,status:number,value:string,contentType:string):void { res.writeHead(status,{"content-type":contentType,"cache-control":"no-store","x-content-type-options":"nosniff"}); res.end(value); }
async function body(req:IncomingMessage):Promise<Record<string,unknown>> { let raw=""; for await(const chunk of req) raw+=String(chunk); if(raw.length>1024*1024) throw new Error("Request body exceeds 1 MiB limit."); if(!raw.trim()) return {}; const parsed=JSON.parse(raw); if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)) throw new Error("JSON object body required."); return parsed as Record<string,unknown>; }
function projectIdFrom(pathname:string):string|null { const match=pathname.match(/^\/api\/projects\/([A-Za-z0-9_-]+)(?:\/|$)/); return match?.[1]??null; }
function enumValue<T extends string>(value:unknown,allowed:readonly T[],label:string):T { if(typeof value!=="string"||!allowed.includes(value as T)) throw new Error(`Invalid ${label}.`); return value as T; }
const MEMORY_CLASSES:readonly MemoryClass[]=["author-memory","project-memory","story-canon","character-memory","relationship-memory","location-memory","timeline-memory","style-memory","research-memory","creative-note","working-draft","hypothesis","open-thread","visual-identity","production-memory","publishing-memory","marketing-memory","generated-alternative"];
const MEMORY_AUTHORITIES:readonly MemoryAuthority[]=["proposed","working","verified","authoritative","superseded","archived"];
async function handleApi(req:IncomingMessage,res:ServerResponse,url:URL):Promise<boolean> {
  if(url.pathname==="/api/health"&&req.method==="GET"){json(res,200,{ok:true,service:"authors-forge-studio",projectId:defaultProjectId,port});return true;}
  if(url.pathname==="/api/governance"&&req.method==="GET"){json(res,200,{ownership:governance.ownershipPolicy(),accessibility:governance.accessibilityProfile()});return true;}
  if(url.pathname==="/api/projects"&&req.method==="POST"){const input=await body(req);const project=createProject({id:String(input.id??""),title:String(input.title??"")});await store.create(project);json(res,201,project);return true;}
  const projectId=projectIdFrom(url.pathname); if(projectId){ const project=await store.load(projectId); if(!project){json(res,404,{error:"Project not found."});return true;}
    if(url.pathname===`/api/projects/${projectId}`&&req.method==="GET"){json(res,200,project);return true;}
    if(url.pathname===`/api/projects/${projectId}/memory`&&req.method==="POST"){const input=await body(req);const memory=createMemoryRecord({id:String(input.id??`memory-${randomUUID()}`),projectId,class:enumValue(input.class??"creative-note",MEMORY_CLASSES,"memory class"),authority:enumValue(input.authority??"working",MEMORY_AUTHORITIES,"memory authority"),summary:String(input.summary??""),content:String(input.content??""),provenance:[{kind:"author",reference:String(input.reference??"studio"),recordedAt:new Date().toISOString()}],relatedMemoryIds:Array.isArray(input.relatedMemoryIds)?input.relatedMemoryIds.map(String):[],relevanceTags:Array.isArray(input.relevanceTags)?input.relevanceTags.map(String):[]});if(project.memories.some(m=>m.id===memory.id)){json(res,409,{error:`Memory id "${memory.id}" already exists.`});return true;}const saved={...project,memories:[...project.memories,memory],metadata:{...project.metadata,updatedAt:new Date().toISOString()}};await store.save(saved);json(res,201,memory);return true;}
    if(url.pathname===`/api/projects/${projectId}/genome`&&req.method==="POST"){const input=await body(req);const nodes=Array.isArray(input.nodes)?input.nodes as BookGenomeNode[]:[];const nextGenome=genome.create({projectId,nodes});await store.save(withProjectBookGenome(project,nextGenome));json(res,200,nextGenome);return true;}
    if(url.pathname===`/api/projects/${projectId}/genome/impact`&&req.method==="POST"){const input=await body(req);const nodes=Array.isArray(input.nodes)?input.nodes as BookGenomeNode[]:[];const graph=genome.create({projectId,nodes});json(res,200,genome.impact(graph,String(input.changedNodeId??"")));return true;}
    if(url.pathname===`/api/projects/${projectId}/delivery-audit`&&req.method==="POST"){const input=await body(req);const checks=Array.isArray(input.checks)?input.checks as FinalDeliveryCheck[]:FINAL_AUDIT_CATEGORIES.map(category=>({category,passed:false,message:"No audit evidence supplied.",blocking:true}));json(res,200,audit.run({id:String(input.id??`audit-${randomUUID()}`),projectId,checks}));return true;}
  }
  return false;
}
async function serveStatic(req:IncomingMessage,res:ServerResponse,url:URL):Promise<void>{const requested=url.pathname==="/"?"index.html":url.pathname.slice(1);const safe=normalize(requested);if(safe.startsWith("..")||safe.includes("/../")){text(res,400,"Bad path","text/plain; charset=utf-8");return;}const file=join(publicRoot,safe);try{const data=await readFile(file);const type:Record<string,string>={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};res.writeHead(200,{"content-type":type[extname(file)]??"application/octet-stream","cache-control":"no-cache","x-content-type-options":"nosniff","content-security-policy":"default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'"});res.end(data);}catch{text(res,404,"Not found","text/plain; charset=utf-8");}}
const server=createServer(async(req,res)=>{try{const url=new URL(req.url??"/",`http://${req.headers.host??`${host}:${port}`}`);if(url.pathname.startsWith("/api/")){if(await handleApi(req,res,url))return;json(res,404,{error:"API route not found."});return;}if(req.method!=="GET"&&req.method!=="HEAD"){json(res,405,{error:"Method not allowed."});return;}await serveStatic(req,res,url);}catch(error){json(res,400,{error:error instanceof Error?error.message:"Request failed."});}});
server.on("error",error=>{console.error(error);process.exitCode=1;});
ensureDefaultProject().then(()=>server.listen(port,host,()=>console.log(`Author's Forge Studio: http://${host}:${port}`))).catch(error=>{console.error(error);process.exitCode=1;});
