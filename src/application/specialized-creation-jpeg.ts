import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import jpeg from "jpeg-js";
import type { SpecializedRenderedArtifact } from "./specialized-creation-production-engine";

const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_JPEG_QUALITY=95;
const MIN_JPEG_QUALITY=50;

/**
 * Converts Forge's deterministic RGBA PNG production artifact into a real JPEG.
 * The PNG parser intentionally accepts only the exact non-interlaced RGBA format
 * emitted by SpecializedCreationProductionEngine; arbitrary uploaded PNGs are not
 * decoded here.
 */
export function renderSpecializedJpegFromPng(png:SpecializedRenderedArtifact,quality=90):SpecializedRenderedArtifact {
  if(png.kind!=="png"||png.mimeType!=="image/png")throw new Error("JPEG production requires a Forge PNG production artifact.");
  if(!Number.isInteger(quality)||quality<MIN_JPEG_QUALITY||quality>MAX_JPEG_QUALITY)throw new Error(`JPEG quality must be an integer from ${MIN_JPEG_QUALITY} to ${MAX_JPEG_QUALITY}.`);
  const decoded=decodeForgeRgbaPng(Buffer.from(png.bytesBase64,"base64"));
  if(png.widthPixels!==undefined&&png.widthPixels!==decoded.width)throw new Error("Forge PNG width metadata does not match encoded pixels.");
  if(png.heightPixels!==undefined&&png.heightPixels!==decoded.height)throw new Error("Forge PNG height metadata does not match encoded pixels.");
  const encoded=jpeg.encode({data:decoded.rgba,width:decoded.width,height:decoded.height},quality);
  const bytes=Buffer.from(encoded.data);
  if(bytes.length<4||bytes[0]!==0xff||bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)throw new Error("JPEG encoder did not return a valid JPEG byte stream.");
  const fileName=/\.png$/i.test(png.fileName)?png.fileName.replace(/\.png$/i,".jpg"):`${png.fileName}.jpg`;
  return Object.freeze({
    kind:"jpeg",
    fileName,
    mimeType:"image/jpeg",
    bytesBase64:bytes.toString("base64"),
    byteLength:bytes.length,
    sha256:createHash("sha256").update(bytes).digest("hex"),
    ...(png.pageCount===undefined?{}:{pageCount:png.pageCount}),
    widthPixels:decoded.width,
    heightPixels:decoded.height,
    ...(png.dpi===undefined?{}:{dpi:png.dpi}),
    sourceDocumentIds:Object.freeze([...png.sourceDocumentIds]),
  });
}

export function decodeForgeRgbaPng(bytes:Buffer):{readonly width:number;readonly height:number;readonly rgba:Buffer}{
  if(bytes.length<PNG_SIGNATURE.length+12||!bytes.subarray(0,PNG_SIGNATURE.length).equals(PNG_SIGNATURE))throw new Error("Invalid Forge PNG signature.");
  let offset=PNG_SIGNATURE.length,width=0,height=0,seenHeader=false,seenEnd=false;const idat:Buffer[]=[];
  while(offset+12<=bytes.length){
    const length=bytes.readUInt32BE(offset);offset+=4;if(length<0||offset+4+length+4>bytes.length)throw new Error("Invalid Forge PNG chunk length.");
    const type=bytes.subarray(offset,offset+4).toString("ascii");offset+=4;const data=bytes.subarray(offset,offset+length);offset+=length;offset+=4;
    if(type==="IHDR"){
      if(length!==13||seenHeader)throw new Error("Invalid Forge PNG header.");seenHeader=true;width=data.readUInt32BE(0);height=data.readUInt32BE(4);
      if(!width||!height||data[8]!==8||data[9]!==6||data[10]!==0||data[11]!==0||data[12]!==0)throw new Error("JPEG conversion supports only Forge 8-bit non-interlaced RGBA PNG output.");
    }else if(type==="IDAT")idat.push(Buffer.from(data));else if(type==="IEND"){seenEnd=true;break;}
  }
  if(!seenHeader||!seenEnd||!idat.length)throw new Error("Forge PNG is incomplete.");
  const stride=width*4,raw=inflateSync(Buffer.concat(idat)),expected=(stride+1)*height;if(raw.length!==expected)throw new Error("Forge PNG raster length is invalid.");
  const rgba=Buffer.allocUnsafe(stride*height);
  for(let y=0;y<height;y++){const source=y*(stride+1);if(raw[source]!==0)throw new Error("JPEG conversion encountered an unsupported Forge PNG row filter.");raw.copy(rgba,y*stride,source+1,source+1+stride);}
  return Object.freeze({width,height,rgba});
}
