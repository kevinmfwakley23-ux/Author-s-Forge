import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { SpecializedCreationMode } from "../domain/specialized-creation";
import {
  type FlyerData,
  type InvitationData,
  type SpecializedArtifactKind,
  type SpecializedDocument,
  type SpecializedElement,
  type SpecializedOfficeProject,
  type SpecializedProductionProfile,
  type SpecializedSurface,
  type TcgData,
  validateProductionProfile,
  validateSpecializedDocument,
} from "../domain/specialized-creation-office";

export type SpecializedPreflightSeverity = "error" | "warning" | "info";
export interface SpecializedPreflightIssue { readonly code:string; readonly severity:SpecializedPreflightSeverity; readonly message:string; readonly documentId?:string; readonly surfaceId?:string; readonly elementId?:string; }
export interface SpecializedPreflightReport { readonly projectId:string; readonly profileId:string; readonly generatedAt:string; readonly issues:readonly SpecializedPreflightIssue[]; readonly blocking:number; readonly warnings:number; readonly ready:boolean; }
export interface SpecializedRenderedArtifact { readonly kind:SpecializedArtifactKind; readonly fileName:string; readonly mimeType:string; readonly bytesBase64:string; readonly byteLength:number; readonly sha256:string; readonly pageCount?:number; readonly sourceDocumentIds:readonly string[]; }

export class SpecializedCreationProductionEngine {
  preflight(project:SpecializedOfficeProject, profile:SpecializedProductionProfile, now=new Date().toISOString()):SpecializedPreflightReport {
    validateProductionProfile(profile);
    const issues:SpecializedPreflightIssue[]=[];
    if(!project.documents.length) issues.push(issue("NO_DOCUMENTS","error","No specialized creation documents exist."));
    for(const document of project.documents){
      validateSpecializedDocument(document,project);
      if(!document.surfaces.length)issues.push(issue("NO_SURFACES","error",`Document ${document.title} has no surfaces.`,document.id));
      for(const surface of document.surfaces){
        if(Math.abs(surface.widthInches-profile.widthInches)>0.01||Math.abs(surface.heightInches-profile.heightInches)>0.01)issues.push(issue("PROFILE_SIZE_MISMATCH","warning",`Surface ${surface.label} differs from production profile size.`,document.id,surface.id));
        for(const element of surface.elements){
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
    this.modePreflight(project,issues);
    const blocking=issues.filter(item=>item.severity==="error").length,warnings=issues.filter(item=>item.severity==="warning").length;
    return Object.freeze({projectId:project.id,profileId:profile.id,generatedAt:now,issues:Object.freeze(issues),blocking,warnings,ready:blocking===0});
  }

  render(project:SpecializedOfficeProject,profile:SpecializedProductionProfile,kind:SpecializedArtifactKind):SpecializedRenderedArtifact {
    const report=this.preflight(project,profile);
    if(!profile.artifactKinds.includes(kind))throw new Error(`${kind} is not enabled by production profile ${profile.id}.`);
    if(report.blocking)throw new Error(`Specialized production is blocked by ${report.blocking} preflight error(s).`);
    if(kind==="svg")return artifact(kind,`${safeName(project.title)}.svg`,"image/svg+xml",Buffer.from(renderSvgDocument(project.documents[0],project),"utf8"),project.documents.map(d=>d.id),1);
    if(kind==="pdf")return artifact(kind,`${safeName(project.title)}.pdf`,"application/pdf",renderPdf(project),project.documents.map(d=>d.id),project.documents.reduce((sum,d)=>sum+d.surfaces.length,0));
    if(kind==="png")return artifact(kind,`${safeName(project.title)}.png`,"image/png",renderPng(project.documents[0]?.surfaces[0],profile),project.documents.map(d=>d.id),1);
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

function renderSvgDocument(document:SpecializedDocument|undefined,project:SpecializedOfficeProject):string {
  if(!document||!document.surfaces[0])throw new Error("SVG rendering requires a document surface.");
  const surface=document.surfaces[0],w=surface.widthInches*96,h=surface.heightInches*96;
  const body=[...surface.elements].sort((a,b)=>a.zIndex-b.zIndex).map(element=>svgElement(element,project,96)).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${xml(document.title)}"><rect width="100%" height="100%" fill="white"/>${body}</svg>`;
}
function svgElement(element:SpecializedElement,project:SpecializedOfficeProject,scale:number):string {const {x,y,width,height}=element.box;const tx=x*scale,ty=y*scale,w=width*scale,h=height*scale;const fill=element.style.fill??(element.kind==="shape"?"#dddddd":"#111111");if(element.kind==="text")return `<text x="${tx}" y="${ty+(element.style.fontSizePt??12)*1.3}" font-family="${xml(element.style.fontFamily??"sans-serif")}" font-size="${(element.style.fontSizePt??12)*96/72}" font-weight="${element.style.fontWeight??"normal"}" fill="${xml(fill)}">${xml(element.text??"")}</text>`;if(element.kind==="image")return `<rect x="${tx}" y="${ty}" width="${w}" height="${h}" fill="#e9e9e9" stroke="#888"/><text x="${tx+6}" y="${ty+18}" font-size="12">${xml(project.assets.find(a=>a.id===element.assetId)?.name??"image")}</text>`;if(element.kind==="qr")return `<rect x="${tx}" y="${ty}" width="${w}" height="${h}" fill="white" stroke="black"/><text x="${tx+4}" y="${ty+h/2}" font-size="10">QR: ${xml(String(element.metadata.destination??""))}</text>`;return `<rect x="${tx}" y="${ty}" width="${w}" height="${h}" fill="${xml(fill)}" stroke="${xml(element.style.stroke??"none")}" opacity="${element.style.opacity??1}"/>`;}

function renderPdf(project:SpecializedOfficeProject):Buffer {
  const surfaces=project.documents.flatMap(d=>d.surfaces);if(!surfaces.length)throw new Error("PDF rendering requires surfaces.");
  const objects:string[]=[];const pageIds:number[]=[];const fontId=3;objects[fontId-1]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  let nextId=4;
  for(const surface of surfaces){const content=pdfSurface(surface,project);const contentId=nextId++;objects[contentId-1]=`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`;const pageId=nextId++;pageIds.push(pageId);objects[pageId-1]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${(surface.widthInches*72).toFixed(2)} ${(surface.heightInches*72).toFixed(2)}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;}
  objects[0]="<< /Type /Catalog /Pages 2 0 R >>";objects[1]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>`${id} 0 R`).join(" ")}] >>`;
  let out="%PDF-1.4\n%\xE2\xE3\xCF\xD3\n",offsets=[0];for(let i=0;i<objects.length;i++){offsets[i+1]=Buffer.byteLength(out,"binary");out+=`${i+1} 0 obj\n${objects[i]??"<<>>"}\nendobj\n`;}const xref=Buffer.byteLength(out,"binary");out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;for(let i=1;i<=objects.length;i++)out+=`${String(offsets[i]).padStart(10,"0")} 00000 n \n`;out+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(out,"binary");
}
function pdfSurface(surface:SpecializedSurface,project:SpecializedOfficeProject):string {const H=surface.heightInches*72;const commands=["q","1 1 1 rg",`0 0 ${(surface.widthInches*72).toFixed(2)} ${H.toFixed(2)} re f`];for(const e of [...surface.elements].sort((a,b)=>a.zIndex-b.zIndex)){const x=e.box.x*72,y=H-(e.box.y+e.box.height)*72,w=e.box.width*72,h=e.box.height*72;if(e.kind==="text"){const text=pdfText(e.text??"");const size=e.style.fontSizePt??12;commands.push("0 0 0 rg","BT",`/F1 ${size} Tf`,`${x.toFixed(2)} ${(y+h-size*1.2).toFixed(2)} Td`,`(${text}) Tj`,`ET`);}else{commands.push("0.92 0.92 0.92 rg",`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`,`0 0 0 RG`,`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);if(e.kind==="image"){const label=pdfText(project.assets.find(a=>a.id===e.assetId)?.name??"image");commands.push("BT","/F1 8 Tf",`${(x+4).toFixed(2)} ${(y+h-12).toFixed(2)} Td`,`(${label}) Tj`,`ET`);}}}commands.push("Q");return commands.join("\n");}

function renderPng(surface:SpecializedSurface|undefined,profile:SpecializedProductionProfile):Buffer {if(!surface)throw new Error("PNG rendering requires a surface.");const max=1800;const targetW=Math.min(max,Math.max(64,Math.round(surface.widthInches*profile.dpi))),targetH=Math.min(max,Math.max(64,Math.round(surface.heightInches*profile.dpi)));const raw=Buffer.alloc((targetW*4+1)*targetH);for(let y=0;y<targetH;y++){const row=y*(targetW*4+1);raw[row]=0;for(let x=0;x<targetW;x++){const i=row+1+x*4;raw[i]=255;raw[i+1]=255;raw[i+2]=255;raw[i+3]=255;}}for(const e of surface.elements){const x0=Math.max(0,Math.floor(e.box.x/surface.widthInches*targetW)),y0=Math.max(0,Math.floor(e.box.y/surface.heightInches*targetH)),x1=Math.min(targetW,Math.ceil((e.box.x+e.box.width)/surface.widthInches*targetW)),y1=Math.min(targetH,Math.ceil((e.box.y+e.box.height)/surface.heightInches*targetH));const dark=e.kind==="text"||e.kind==="qr";for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){if(!dark&&x>x0+2&&x<x1-2&&y>y0+2&&y<y1-2)continue;const i=y*(targetW*4+1)+1+x*4;raw[i]=dark?25:150;raw[i+1]=dark?25:150;raw[i+2]=dark?25:150;}}return pngEncode(targetW,targetH,raw);}
function pngEncode(width:number,height:number,raw:Buffer):Buffer {const signature=Buffer.from([137,80,78,71,13,10,26,10]);const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;const chunks=[pngChunk("IHDR",ihdr),pngChunk("IDAT",deflateSync(raw)),pngChunk("IEND",Buffer.alloc(0))];return Buffer.concat([signature,...chunks]);}
function pngChunk(type:string,data:Buffer):Buffer {const t=Buffer.from(type);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([t,data]))>>>0);return Buffer.concat([len,t,data,crc]);}

function renderCbz(project:SpecializedOfficeProject,profile:SpecializedProductionProfile):Buffer {if(project.mode!=="comic-book")throw new Error("CBZ is only available for comic-book mode.");const entries=project.documents.flatMap(d=>d.surfaces).map((surface,index)=>({name:`${String(index+1).padStart(3,"0")}.png`,data:renderPng(surface,profile)}));return zipStored(entries);}
function zipStored(entries:readonly {name:string;data:Buffer}[]):Buffer {const local:Buffer[]=[];const central:Buffer[]=[];let offset=0;for(const entry of entries){const name=Buffer.from(entry.name),crc=crc32(entry.data);const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0,6);lh.writeUInt16LE(0,8);lh.writeUInt32LE(crc>>>0,14);lh.writeUInt32LE(entry.data.length,18);lh.writeUInt32LE(entry.data.length,22);lh.writeUInt16LE(name.length,26);local.push(lh,name,entry.data);const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt32LE(crc>>>0,16);ch.writeUInt32LE(entry.data.length,20);ch.writeUInt32LE(entry.data.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);central.push(ch,name);offset+=lh.length+name.length+entry.data.length;}const centralBuf=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBuf.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,centralBuf,end]);}

function renderTcgCsv(project:SpecializedOfficeProject):string {if(project.mode!=="trading-card-game")throw new Error("CSV export is only available for TCG mode.");const data=project.modeData as TcgData;const fields=["id","collectorNumber","templateId",...data.fields.map(f=>f.key)];return [fields,...data.cards.map(card=>[card.id,card.collectorNumber,card.templateId,...data.fields.map(f=>card.fields[f.key]??"")])].map(row=>row.map(csv).join(",")).join("\n")+"\n";}
function csv(value:unknown):string {const s=String(value??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function artifact(kind:SpecializedArtifactKind,fileName:string,mimeType:string,bytes:Buffer,sourceDocumentIds:readonly string[],pageCount?:number):SpecializedRenderedArtifact {return Object.freeze({kind,fileName,mimeType,bytesBase64:bytes.toString("base64"),byteLength:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex"),...(pageCount?{pageCount}:{}),sourceDocumentIds:Object.freeze([...sourceDocumentIds])});}
function issue(code:string,severity:SpecializedPreflightSeverity,message:string,documentId?:string,surfaceId?:string,elementId?:string):SpecializedPreflightIssue{return {code,severity,message,...(documentId?{documentId}:{}),...(surfaceId?{surfaceId}:{}),...(elementId?{elementId}:{})};}
function estimatedTextHeight(text:string,fontSize:number,widthInches:number):number {const charsPerLine=Math.max(1,Math.floor(widthInches*72/(fontSize*0.55))),lines=text.split(/\n/).reduce((sum,line)=>sum+Math.max(1,Math.ceil(line.length/charsPerLine)),0);return lines*fontSize*1.25;}
function xml(value:string):string{return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));}function pdfText(value:string):string{return value.replace(/[^\x20-\x7E]/g,"?").replace(/([\\()])/g,"\\$1");}function safeName(value:string):string{return value.trim().replace(/[^A-Za-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"specialized-creation";}
function crc32(data:Buffer):number {let crc=0xffffffff;for(const byte of data){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
