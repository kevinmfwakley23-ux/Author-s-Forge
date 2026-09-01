import { createHash } from "node:crypto";
import { deflateSync, inflateSync } from "node:zlib";
import jpeg from "jpeg-js";
import type { SpecializedCreationMode } from "../domain/specialized-creation";
import {
  type FlyerData,
  type InvitationData,
  type SpecializedArtifactKind,
  type SpecializedAsset,
  type SpecializedElement,
  type SpecializedOfficeProject,
  type SpecializedProductionProfile,
  type SpecializedSurface,
  type TcgData,
  validateProductionProfile,
  validateSpecializedDocument,
} from "../domain/specialized-creation-office";
import { createSpecializedQrMatrix, SPECIALIZED_QR_QUIET_ZONE_MODULES } from "./specialized-creation-qr";
import { renderEmbeddedPdf, renderEmbeddedSvg } from "./specialized-creation-embedded-renderer";

export type SpecializedPreflightSeverity = "error" | "warning" | "info";
export interface SpecializedPreflightIssue { readonly code:string; readonly severity:SpecializedPreflightSeverity; readonly message:string; readonly documentId?:string; readonly surfaceId?:string; readonly elementId?:string; }
export interface SpecializedPreflightReport { readonly projectId:string; readonly profileId:string; readonly generatedAt:string; readonly issues:readonly SpecializedPreflightIssue[]; readonly blocking:number; readonly warnings:number; readonly ready:boolean; }
export interface SpecializedRenderedArtifact { readonly kind:SpecializedArtifactKind; readonly fileName:string; readonly mimeType:string; readonly bytesBase64:string; readonly byteLength:number; readonly sha256:string; readonly pageCount?:number; readonly widthPixels?:number; readonly heightPixels?:number; readonly dpi?:number; readonly sourceDocumentIds:readonly string[]; }
export interface SpecializedRasterDimensions { readonly widthPixels:number; readonly heightPixels:number; readonly pixelCount:number; readonly estimatedRawBytes:number; }

export const MAX_SPECIALIZED_PRODUCTION_RASTER_PIXELS=25_000_000;
export const MAX_SPECIALIZED_PRODUCTION_RASTER_BYTES=128*1024*1024;

export function productionRasterDimensions(surface:SpecializedSurface,profile:SpecializedProductionProfile):SpecializedRasterDimensions {
  validateProductionProfile(profile);
  const widthPixels=Math.max(1,Math.round(surface.widthInches*profile.dpi));
  const heightPixels=Math.max(1,Math.round(surface.heightInches*profile.dpi));
  const pixelCount=widthPixels*heightPixels;
  const estimatedRawBytes=(widthPixels*4+1)*heightPixels;
  if(!Number.isSafeInteger(pixelCount)||pixelCount>MAX_SPECIALIZED_PRODUCTION_RASTER_PIXELS||estimatedRawBytes>MAX_SPECIALIZED_PRODUCTION_RASTER_BYTES)throw new Error(`Production raster ${widthPixels}×${heightPixels} at ${profile.dpi} DPI exceeds the safe in-process raster budget. Choose a smaller physical size/DPI or use vector PDF/SVG production; Forge will not silently downscale a production artifact.`);
  return Object.freeze({widthPixels,heightPixels,pixelCount,estimatedRawBytes});
}

export class SpecializedCreationProductionEngine {
  preflight(project:SpecializedOfficeProject, profile:SpecializedProductionProfile, now=new Date().toISOString(), modeContext:SpecializedOfficeProject=project):SpecializedPreflightReport {
    validateProductionProfile(profile);
    if(modeContext.id!==project.id||modeContext.forgeProjectId!==project.forgeProjectId||modeContext.mode!==project.mode)throw new Error("Specialized preflight mode context must match the scoped project identity and mode.");
    const issues:SpecializedPreflightIssue[]=[];
    if(!project.documents.length)issues.push(issue("NO_DOCUMENTS","error","No specialized creation documents exist."));
    for(const document of project.documents){
      validateSpecializedDocument(document,project);
      if(!document.surfaces.length)issues.push(issue("NO_SURFACES","error",`Document ${document.title} has no surfaces.`,document.id));
      for(const surface of document.surfaces){
        if(Math.abs(surface.widthInches-profile.widthInches)>0.01||Math.abs(surface.heightInches-profile.heightInches)>0.01)issues.push(issue("PROFILE_SIZE_MISMATCH","warning",`Surface ${surface.label} differs from production profile size.`,document.id,surface.id));
        for(const element of surface.elements){
          if(element.metadata.hidden===true)continue;
          if(element.box.x<0||element.box.y<0||element.box.x+element.box.width>surface.widthInches||element.box.y+element.box.height>surface.heightInches)issues.push(issue("ELEMENT_OUTSIDE_SURFACE","error",`Element ${element.id} extends outside the surface.`,document.id,surface.id,element.id));
          const safe=surface.safeMarginInches;
          if(element.box.x<safe||element.box.y<safe||element.box.x+element.box.width>surface.widthInches-safe||element.box.y+element.box.height>surface.heightInches-safe)issues.push(issue("SAFE_AREA_RISK","warning",`Element ${element.id} enters the safe-margin zone.`,document.id,surface.id,element.id));
          if(element.kind==="text"){
            if(!element.text?.trim())issues.push(issue("EMPTY_TEXT","error",`Text element ${element.id} is empty.`,document.id,surface.id,element.id));
            const fontSize=element.style.fontSizePt??12;
            if(fontSize<6)issues.push(issue("TEXT_TOO_SMALL","warning",`Text element ${element.id} is below 6 pt.`,document.id,surface.id,element.id));
            if(element.text&&estimatedTextHeight(element.text,fontSize,element.box.width)>element.box.height*72)issues.push(issue("TEXT_OVERFLOW","error",`Text element ${element.id} is likely overset.`,document.id,surface.id,element.id));
          }
          if(element.kind==="image"&&element.assetId){
            const asset=project.assets.find(item=>item.id===element.assetId);
            if(!asset)issues.push(issue("MISSING_ASSET","error",`Image element ${element.id} references missing asset ${element.assetId}.`,document.id,surface.id,element.id));
            else if(asset.pixelWidth&&asset.pixelHeight){const effective=Math.min(asset.pixelWidth/(element.box.width||1),asset.pixelHeight/(element.box.height||1));if(effective<profile.dpi)issues.push(issue("LOW_EFFECTIVE_DPI","warning",`Asset ${asset.name} resolves to about ${Math.round(effective)} DPI at placed size.`,document.id,surface.id,element.id));}
          }
          if(element.kind==="qr"){
            const quiet=Number(element.metadata.quietZoneModules??0);
            if(quiet<4)issues.push(issue("QR_QUIET_ZONE","error",`QR element ${element.id} requires at least four modules of quiet zone.`,document.id,surface.id,element.id));
            if(typeof element.metadata.destination!=="string"||!String(element.metadata.destination).trim())issues.push(issue("QR_DESTINATION","error",`QR element ${element.id} has no visible destination in project state.`,document.id,surface.id,element.id));
          }
        }
      }
    }
    this.modePreflight(modeContext,issues);
    const blocking=issues.filter(item=>item.severity==="error").length,warnings=issues.filter(item=>item.severity==="warning").length;
    return Object.freeze({projectId:project.id,profileId:profile.id,generatedAt:now,issues:Object.freeze(issues),blocking,warnings,ready:blocking===0});
  }

  render(project:SpecializedOfficeProject,profile:SpecializedProductionProfile,kind:SpecializedArtifactKind,modeContext:SpecializedOfficeProject=project):SpecializedRenderedArtifact {
    const report=this.preflight(project,profile,new Date().toISOString(),modeContext);
    if(!profile.artifactKinds.includes(kind))throw new Error(`${kind} is not enabled by production profile ${profile.id}.`);
    if(report.blocking)throw new Error(`Specialized production is blocked by ${report.blocking} preflight error(s).`);
    if(kind==="svg")return renderEmbeddedSvg(project);
    if(kind==="pdf")return renderEmbeddedPdf(project);
    if(kind==="png"){
      const surfaces=project.documents.flatMap(document=>document.surfaces);if(!surfaces.length)throw new Error("PNG rendering requires a document surface.");
      if(surfaces.length!==1)throw new Error(`PNG is a single-surface production artifact, but the selected scope contains ${surfaces.length} surfaces. Select a single-surface document or use PDF/CBZ so Forge does not silently omit pages.`);
      const surface=surfaces[0],dimensions=productionRasterDimensions(surface,profile),bytes=renderPng(surface,profile,project);
      return artifact(kind,`${safeName(project.title)}.png`,"image/png",bytes,project.documents.map(d=>d.id),1,dimensions.widthPixels,dimensions.heightPixels,profile.dpi);
    }
    if(kind==="cbz")return artifact(kind,`${safeName(project.title)}.cbz`,"application/vnd.comicbook+zip",renderCbz(project,profile),project.documents.map(d=>d.id),project.documents.reduce((sum,d)=>sum+d.surfaces.length,0));
    if(kind==="json")return artifact(kind,`${safeName(project.title)}-data.json`,"application/json",Buffer.from(`${JSON.stringify(project.modeData,null,2)}\n`),project.documents.map(d=>d.id));
    if(kind==="csv")return artifact(kind,`${safeName(project.title)}-cards.csv`,"text/csv",Buffer.from(renderTcgCsv(project),"utf8"),project.documents.map(d=>d.id));
    throw new Error(`Unsupported artifact kind ${kind}.`);
  }

  private modePreflight(project:SpecializedOfficeProject,issues:SpecializedPreflightIssue[]):void {
    if(project.mode==="comic-book"){
      const comic=project.modeData as {pages?:readonly {page:number;panels:readonly {order:number}[]}[]};
      if(!comic.pages?.length)issues.push(issue("COMIC_NO_PAGES","error","Comic requires at least one scripted page."));
      for(const page of comic.pages??[]){const ordered=[...page.panels].sort((a,b)=>a.order-b.order);if(ordered.some((panel,index)=>panel.order!==index+1))issues.push(issue("COMIC_READING_ORDER","warning",`Comic page ${page.page} panel order is not contiguous from 1.`));}
    } else if(project.mode==="greeting-card"||project.mode==="birthday-card"){
      const surfaces=project.documents.flatMap(d=>d.surfaces.map(s=>s.kind));for(const needed of ["front","inside-left","inside-right","back"]){if(!surfaces.includes(needed as never))issues.push(issue("CARD_SURFACE_MISSING","error",`Folded card requires ${needed} surface.`));}
    } else if(project.mode==="invitation"){
      const data=project.modeData as InvitationData;
      if(!data.primaryNames.length)issues.push(issue("INVITE_NAMES_MISSING","error","Invitation requires primary names/identity."));
      if(!data.date)issues.push(issue("INVITE_DATE_MISSING","error","Invitation date is missing."));
      if(!data.startTime)issues.push(issue("INVITE_TIME_MISSING","warning","Invitation start time is missing."));
      if(!data.venue&&!data.address)issues.push(issue("INVITE_LOCATION_MISSING","error","Invitation venue/address is missing."));
      if(!data.rsvpMethod)issues.push(issue("INVITE_RSVP_MISSING","warning","Invitation has no RSVP method."));
    } else if(project.mode==="flyer"){
      const data=project.modeData as FlyerData;
      if(!data.objective.trim())issues.push(issue("FLYER_OBJECTIVE_MISSING","error","Flyer objective is required."));
      if(!data.primaryCta.trim())issues.push(issue("FLYER_CTA_MISSING","error","Flyer primary CTA is required."));
      if(data.secondaryActions.length>2)issues.push(issue("FLYER_COMPETING_CTA","warning","Flyer contains several secondary actions that may compete with the primary CTA."));
      if(!data.destination.trim())issues.push(issue("FLYER_DESTINATION_MISSING","error","Flyer CTA destination is required."));
    } else if(project.mode==="trading-card-game"){
      const data=project.modeData as TcgData;
      if(!data.fields.length)issues.push(issue("TCG_SCHEMA_MISSING","error","TCG requires a card schema."));
      if(!data.templates.length)issues.push(issue("TCG_TEMPLATE_MISSING","error","TCG requires at least one reusable card template."));
      if(!data.cards.length)issues.push(issue("TCG_CARDS_MISSING","error","TCG requires at least one card."));
      const templates=new Set(data.templates.map(t=>t.id));for(const card of data.cards){if(!templates.has(card.templateId))issues.push(issue("TCG_TEMPLATE_REFERENCE","error",`Card ${card.id} references missing template ${card.templateId}.`));for(const field of data.fields.filter(f=>f.required)){if(card.fields[field.key]===undefined||String(card.fields[field.key]).trim()==="")issues.push(issue("TCG_REQUIRED_FIELD","error",`Card ${card.id} is missing ${field.label}.`));}}
    }
  }
}

function renderPng(surface:SpecializedSurface,profile:SpecializedProductionProfile,project:SpecializedOfficeProject):Buffer {
  const {widthPixels:targetW,heightPixels:targetH}=productionRasterDimensions(surface,profile),stride=targetW*4+1,raw=Buffer.alloc(stride*targetH);
  for(let y=0;y<targetH;y++){const row=y*stride;raw[row]=0;raw.fill(255,row+1,row+stride);}
  for(const element of [...surface.elements].sort((a,b)=>a.zIndex-b.zIndex).filter(element=>element.metadata.hidden!==true)){
    const x0=Math.max(0,Math.floor(element.box.x/surface.widthInches*targetW)),y0=Math.max(0,Math.floor(element.box.y/surface.heightInches*targetH)),x1=Math.min(targetW,Math.ceil((element.box.x+element.box.width)/surface.widthInches*targetW)),y1=Math.min(targetH,Math.ceil((element.box.y+element.box.height)/surface.heightInches*targetH));
    if(element.kind==="qr"){drawQrRaster(raw,stride,targetW,targetH,x0,y0,x1,y1,String(element.metadata.destination??""));continue;}
    if(element.kind==="text"){drawTextRaster(raw,stride,targetW,targetH,x0,y0,x1,y1,element,profile);continue;}
    if(element.kind==="image"){drawImageRaster(raw,stride,targetW,targetH,x0,y0,x1,y1,element,project);continue;}
    drawShapeRaster(raw,stride,targetW,targetH,x0,y0,x1,y1,element);
  }
  return pngEncode(targetW,targetH,raw);
}

function drawTextRaster(raw:Buffer,stride:number,targetW:number,targetH:number,x0:number,y0:number,x1:number,y1:number,element:SpecializedElement,profile:SpecializedProductionProfile):void {
  const color=parseColor(element.style.fill,"#111111"),opacity=clampOpacity(element.style.opacity),fontPixels=Math.max(7,Math.round((element.style.fontSizePt??12)*profile.dpi/72)),scale=Math.max(1,Math.floor(fontPixels/8)),advance=6*scale,lineHeight=8*scale,maxColumns=Math.max(1,Math.floor((x1-x0)/advance)),maxLines=Math.max(1,Math.floor((y1-y0)/lineHeight)),lines=wrapRasterText(normalizeRasterText(element.text??""),maxColumns).slice(0,maxLines),bold=Number(element.style.fontWeight??400)>=600;
  for(let lineIndex=0;lineIndex<lines.length;lineIndex++){let x=x0,y=y0+lineIndex*lineHeight;for(const char of lines[lineIndex]){drawGlyph(raw,stride,targetW,targetH,x,y,char,scale,color,opacity,bold);x+=advance;if(x+5*scale>x1)break;}}
}
function drawGlyph(raw:Buffer,stride:number,targetW:number,targetH:number,x:number,y:number,char:string,scale:number,color:Rgb,opacity:number,bold:boolean):void {const rows=RASTER_GLYPHS[char]??RASTER_GLYPHS[char.toUpperCase()]??RASTER_GLYPHS["?"];if(!rows)return;for(let row=0;row<7;row++)for(let col=0;col<5;col++)if(rows[row][col]==="1"){fillRectAlpha(raw,stride,targetW,targetH,x+col*scale,y+row*scale,x+(col+1)*scale+(bold?1:0),y+(row+1)*scale,color,opacity);}}
function wrapRasterText(value:string,maxColumns:number):string[]{const output:string[]=[];for(const paragraph of value.split("\n")){if(!paragraph){output.push("");continue;}let line="";for(const word of paragraph.split(/\s+/)){if(word.length>maxColumns){if(line){output.push(line);line="";}for(let i=0;i<word.length;i+=maxColumns)output.push(word.slice(i,i+maxColumns));continue;}const candidate=line?`${line} ${word}`:word;if(candidate.length>maxColumns){output.push(line);line=word;}else line=candidate;}if(line)output.push(line);}return output;}
function normalizeRasterText(value:string):string{return value.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"...").replace(/ /g," ");}

function drawImageRaster(raw:Buffer,stride:number,targetW:number,targetH:number,x0:number,y0:number,x1:number,y1:number,element:SpecializedElement,project:SpecializedOfficeProject):void {
  if(!element.assetId)throw new Error(`Image element ${element.id} has no asset id.`);const asset=project.assets.find(item=>item.id===element.assetId);if(!asset)throw new Error(`Image element ${element.id} references missing asset ${element.assetId}.`);const image=decodeRasterAsset(asset),boxW=Math.max(1,x1-x0),boxH=Math.max(1,y1-y0),fit=String(element.metadata.fit??"contain"),scale=fit==="cover"?Math.max(boxW/image.width,boxH/image.height):Math.min(boxW/image.width,boxH/image.height),drawW=image.width*scale,drawH=image.height*scale,ox=x0+(boxW-drawW)/2,oy=y0+(boxH-drawH)/2;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const sx=Math.floor((x-ox)/scale),sy=Math.floor((y-oy)/scale);if(sx<0||sy<0||sx>=image.width||sy>=image.height)continue;const si=(sy*image.width+sx)*4,alpha=(image.rgba[si+3]/255)*clampOpacity(element.style.opacity);blendPixel(raw,stride,x,y,image.rgba[si],image.rgba[si+1],image.rgba[si+2],alpha);}
}
function decodeRasterAsset(asset:SpecializedAsset):{width:number;height:number;rgba:Buffer}{const match=asset.uri.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/is);if(!match)throw new Error(`Raster production asset ${asset.id} must be an embedded PNG/JPEG data URI.`);const bytes=Buffer.from(match[2],"base64");if(match[1].toLowerCase()==="png")return decodeRasterPng(bytes);const decoded=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true});if(!decoded.width||!decoded.height||!decoded.data)throw new Error(`JPEG asset ${asset.id} could not be decoded.`);return{width:decoded.width,height:decoded.height,rgba:Buffer.from(decoded.data)};}
function decodeRasterPng(bytes:Buffer):{width:number;height:number;rgba:Buffer}{const sig=Buffer.from([137,80,78,71,13,10,26,10]);if(!bytes.subarray(0,8).equals(sig))throw new Error("Invalid PNG asset.");let offset=8,width=0,height=0,bitDepth=0,colorType=0,interlace=0;const idat:Buffer[]=[];while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset),type=bytes.subarray(offset+4,offset+8).toString("ascii"),data=bytes.subarray(offset+8,offset+8+length);offset+=12+length;if(type==="IHDR"){width=data.readUInt32BE(0);height=data.readUInt32BE(4);bitDepth=data[8];colorType=data[9];interlace=data[12];}else if(type==="IDAT")idat.push(Buffer.from(data));else if(type==="IEND")break;}if(!width||!height||bitDepth!==8||![2,6].includes(colorType)||interlace!==0)throw new Error("Raster PNG assets must be non-interlaced 8-bit RGB/RGBA images.");const channels=colorType===6?4:3,rowBytes=width*channels,encoded=inflateSync(Buffer.concat(idat)),decoded=Buffer.alloc(rowBytes*height);let source=0;for(let y=0;y<height;y++){const filter=encoded[source++],row=decoded.subarray(y*rowBytes,(y+1)*rowBytes),previous=y?decoded.subarray((y-1)*rowBytes,y*rowBytes):undefined;for(let x=0;x<rowBytes;x++){const value=encoded[source++],a=x>=channels?row[x-channels]:0,b=previous?previous[x]:0,c=previous&&x>=channels?previous[x-channels]:0;row[x]=(value+pngFilter(filter,a,b,c))&255;}}const rgba=Buffer.alloc(width*height*4);for(let i=0,p=0;i<width*height;i++){rgba[i*4]=decoded[p++];rgba[i*4+1]=decoded[p++];rgba[i*4+2]=decoded[p++];rgba[i*4+3]=channels===4?decoded[p++]:255;}return{width,height,rgba};}
function pngFilter(filter:number,a:number,b:number,c:number):number{if(filter===0)return 0;if(filter===1)return a;if(filter===2)return b;if(filter===3)return Math.floor((a+b)/2);if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;}throw new Error(`Unsupported PNG filter ${filter}.`);}

function drawShapeRaster(raw:Buffer,stride:number,targetW:number,targetH:number,x0:number,y0:number,x1:number,y1:number,element:SpecializedElement):void {const fill=parseColor(element.style.fill,"#dddddd"),opacity=clampOpacity(element.style.opacity);fillRectAlpha(raw,stride,targetW,targetH,x0,y0,x1,y1,fill,opacity);if(element.style.stroke){const stroke=parseColor(element.style.stroke,"#111111"),weight=Math.max(1,Math.round(Number(element.style.strokeWidthPt??1)));fillRectAlpha(raw,stride,targetW,targetH,x0,y0,x1,y0+weight,stroke,opacity);fillRectAlpha(raw,stride,targetW,targetH,x0,y1-weight,x1,y1,stroke,opacity);fillRectAlpha(raw,stride,targetW,targetH,x0,y0,x0+weight,y1,stroke,opacity);fillRectAlpha(raw,stride,targetW,targetH,x1-weight,y0,x1,y1,stroke,opacity);}}
function drawQrRaster(raw:Buffer,stride:number,targetW:number,targetH:number,x0:number,y0:number,x1:number,y1:number,destination:string):void {const qr=createSpecializedQrMatrix(destination),quiet=SPECIALIZED_QR_QUIET_ZONE_MODULES,total=qr.size+quiet*2,width=x1-x0,height=y1-y0,module=Math.max(1,Math.floor(Math.min(width,height)/total)),draw=module*total,ox=x0+Math.floor((width-draw)/2),oy=y0+Math.floor((height-draw)/2);fillRect(raw,stride,targetW,targetH,ox,oy,ox+draw,oy+draw,255,255,255,255);for(let row=0;row<qr.size;row++)for(let col=0;col<qr.size;col++)if(qr.modules[row][col])fillRect(raw,stride,targetW,targetH,ox+(col+quiet)*module,oy+(row+quiet)*module,ox+(col+quiet+1)*module,oy+(row+quiet+1)*module,17,17,17,255);}

type Rgb=Readonly<{r:number;g:number;b:number}>;
function parseColor(value:unknown,fallback:string):Rgb{const text=typeof value==="string"?value.trim():fallback,hex=/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)||/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(fallback)!;const raw=hex[1].length===3?hex[1].split("").map(char=>char+char).join(""):hex[1];return{r:parseInt(raw.slice(0,2),16),g:parseInt(raw.slice(2,4),16),b:parseInt(raw.slice(4,6),16)};}
function clampOpacity(value:unknown):number{const number=typeof value==="number"?value:1;return Math.max(0,Math.min(1,Number.isFinite(number)?number:1));}
function fillRectAlpha(raw:Buffer,stride:number,targetW:number,targetH:number,x0:number,y0:number,x1:number,y1:number,color:Rgb,opacity:number):void{for(let y=Math.max(0,Math.floor(y0));y<Math.min(targetH,Math.ceil(y1));y++)for(let x=Math.max(0,Math.floor(x0));x<Math.min(targetW,Math.ceil(x1));x++)blendPixel(raw,stride,x,y,color.r,color.g,color.b,opacity);}
function blendPixel(raw:Buffer,stride:number,x:number,y:number,r:number,g:number,b:number,alpha:number):void{const i=y*stride+1+x*4,a=Math.max(0,Math.min(1,alpha));raw[i]=Math.round(r*a+raw[i]*(1-a));raw[i+1]=Math.round(g*a+raw[i+1]*(1-a));raw[i+2]=Math.round(b*a+raw[i+2]*(1-a));raw[i+3]=255;}
function fillRect(raw:Buffer,stride:number,targetW:number,targetH:number,x0:number,y0:number,x1:number,y1:number,r:number,g:number,b:number,a:number):void {for(let y=Math.max(0,y0);y<Math.min(targetH,y1);y++)for(let x=Math.max(0,x0);x<Math.min(targetW,x1);x++)setPixel(raw,stride,x,y,r,g,b,a);}
function setPixel(raw:Buffer,stride:number,x:number,y:number,r:number,g:number,b:number,a:number):void {const i=y*stride+1+x*4;raw[i]=r;raw[i+1]=g;raw[i+2]=b;raw[i+3]=a;}
function pngEncode(width:number,height:number,raw:Buffer):Buffer {const signature=Buffer.from([137,80,78,71,13,10,26,10]);const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;const chunks=[pngChunk("IHDR",ihdr),pngChunk("IDAT",deflateSync(raw)),pngChunk("IEND",Buffer.alloc(0))];return Buffer.concat([signature,...chunks]);}
function pngChunk(type:string,data:Buffer):Buffer {const t=Buffer.from(type);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data]))>>>0);return Buffer.concat([len,t,data,crc]);}

function renderCbz(project:SpecializedOfficeProject,profile:SpecializedProductionProfile):Buffer {if(project.mode!=="comic-book")throw new Error("CBZ is only available for comic-book mode.");const entries=project.documents.flatMap(d=>d.surfaces).map((surface,index)=>({name:`${String(index+1).padStart(3,"0")}.png`,data:renderPng(surface,profile,project)}));return zipStored(entries);}
function zipStored(entries:readonly {name:string;data:Buffer}[]):Buffer {const local:Buffer[]=[];const central:Buffer[]=[];let offset=0;for(const entry of entries){const name=Buffer.from(entry.name),crc=crc32(entry.data);const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0,6);lh.writeUInt16LE(0,8);lh.writeUInt32LE(crc>>>0,14);lh.writeUInt32LE(entry.data.length,18);lh.writeUInt32LE(entry.data.length,22);lh.writeUInt16LE(name.length,26);local.push(lh,name,entry.data);const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt32LE(crc>>>0,16);ch.writeUInt32LE(entry.data.length,20);ch.writeUInt32LE(entry.data.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);central.push(ch,name);offset+=lh.length+name.length+entry.data.length;}const centralBuf=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBuf.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,centralBuf,end]);}

function renderTcgCsv(project:SpecializedOfficeProject):string {if(project.mode!=="trading-card-game")throw new Error("CSV export is only available for TCG mode.");const data=project.modeData as TcgData;const fields=["id","collectorNumber","templateId",...data.fields.map(f=>f.key)];return [fields,...data.cards.map(card=>[card.id,card.collectorNumber,card.templateId,...data.fields.map(f=>card.fields[f.key]??"")])].map(row=>row.map(csv).join(",")).join("\n")+"\n";}
function csv(value:unknown):string {const s=String(value??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function artifact(kind:SpecializedArtifactKind,fileName:string,mimeType:string,bytes:Buffer,sourceDocumentIds:readonly string[],pageCount?:number,widthPixels?:number,heightPixels?:number,dpi?:number):SpecializedRenderedArtifact {return Object.freeze({kind,fileName,mimeType,bytesBase64:bytes.toString("base64"),byteLength:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),...(pageCount?{pageCount}:{}),...(widthPixels?{widthPixels}:{}),...(heightPixels?{heightPixels}:{}),...(dpi?{dpi}:{}),sourceDocumentIds:Object.freeze([...sourceDocumentIds])});}
function issue(code:string,severity:SpecializedPreflightSeverity,message:string,documentId?:string,surfaceId?:string,elementId?:string):SpecializedPreflightIssue{return {code,severity,message,...(documentId?{documentId}:{}),...(surfaceId?{surfaceId}:{}),...(elementId?{elementId}:{})};}
function estimatedTextHeight(text:string,fontSize:number,widthInches:number):number {const charsPerLine=Math.max(1,Math.floor(widthInches*72/(fontSize*0.55))),lines=text.split(/\n/).reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/charsPerLine)),0);return lines*fontSize*1.25;}
function safeName(value:string):string{return value.trim().replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"specialized-creation";}
function crc32(data:Buffer):number {let crc=0xffffffff;for(const byte of data){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}

const RASTER_GLYPHS:Readonly<Record<string,readonly string[]>>=Object.freeze({
  " ":["00000","00000","00000","00000","00000","00000","00000"],"?":["01110","10001","00001","00010","00100","00000","00100"],"!":["00100","00100","00100","00100","00100","00000","00100"],".":["00000","00000","00000","00000","00000","00110","00110"],", ":["00000","00000","00000","00000","00110","00100","01000"],", ":["00000","00000","00000","00000","00110","00100","01000"],":":["00000","00110","00110","00000","00110","00110","00000"],";":["00000","00110","00110","00000","00110","00100","01000"],"'":["00100","00100","00000","00000","00000","00000","00000"],'"':["01010","01010","00000","00000","00000","00000","00000"],"-":["00000","00000","00000","11111","00000","00000","00000"],"_":["00000","00000","00000","00000","00000","00000","11111"],"/":["00001","00010","00100","01000","10000","00000","00000"],"(":["00010","00100","01000","01000","01000","00100","00010"],")":["01000","00100","00010","00010","00010","00100","01000"],"&":["01100","10010","10100","01000","10101","10010","01101"],"+":["00000","00100","00100","11111","00100","00100","00000"],"=":["00000","11111","00000","11111","00000","00000","00000"],"#":["01010","11111","01010","01010","11111","01010","00000"],"*":["00000","10101","01110","11111","01110","10101","00000"],"•":["00000","00000","01110","11111","11111","01110","00000"],
  "0":["01110","10001","10011","10101","11001","10001","01110"],"1":["00100","01100","00100","00100","00100","00100","01110"],"2":["01110","10001","00001","00010","00100","01000","11111"],"3":["11110","00001","00001","01110","00001","00001","11110"],"4":["00010","00110","01010","10010","11111","00010","00010"],"5":["11111","10000","10000","11110","00001","00001","11110"],"6":["01110","10000","10000","11110","10001","10001","01110"],"7":["11111","00001","00010","00100","01000","01000","01000"],"8":["01110","10001","10001","01110","10001","10001","01110"],"9":["01110","10001","10001","01111","00001","00001","01110"],
  "A":["01110","10001","10001","11111","10001","10001","10001"],"B":["11110","10001","10001","11110","10001","10001","11110"],"C":["01111","10000","10000","10000","10000","10000","01111"],"D":["11110","10001","10001","10001","10001","10001","11110"],"E":["11111","10000","10000","11110","10000","10000","11111"],"F":["11111","10000","10000","11110","10000","10000","10000"],"G":["01111","10000","10000","10111","10001","10001","01111"],"H":["10001","10001","10001","11111","10001","10001","10001"],"I":["11111","00100","00100","00100","00100","00100","11111"],"J":["00111","00010","00010","00010","00010","10010","01100"],"K":["10001","10010","10100","11000","10100","10010","10001"],"L":["10000","10000","10000","10000","10000","10000","11111"],"M":["10001","11011","10101","10101","10001","10001","10001"],"N":["10001","11001","10101","10011","10001","10001","10001"],"O":["01110","10001","10001","10001","10001","10001","01110"],"P":["11110","10001","10001","11110","10000","10000","10000"],"Q":["01110","10001","10001","10001","10101","10010","01101"],"R":["11110","10001","10001","11110","10100","10010","10001"],"S":["01111","10000","10000","01110","00001","00001","11110"],"T":["11111","00100","00100","00100","00100","00100","00100"],"U":["10001","10001","10001","10001","10001","10001","01110"],"V":["10001","10001","10001","10001","10001","01010","00100"],"W":["10001","10001","10001","10101","10101","11011","10001"],"X":["10001","01010","00100","00100","00100","01010","10001"],"Y":["10001","01010","00100","00100","00100","00100","00100"],"Z":["11111","00001","00010","00100","01000","10000","11111"]
});