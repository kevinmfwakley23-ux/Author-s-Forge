export const SPECIALIZED_QR_QUIET_ZONE_MODULES = 4 as const;
export const SPECIALIZED_QR_ECC = "L" as const;

export interface SpecializedQrMatrix {
  readonly version:number;
  readonly size:number;
  readonly quietZoneModules:typeof SPECIALIZED_QR_QUIET_ZONE_MODULES;
  readonly errorCorrection:typeof SPECIALIZED_QR_ECC;
  readonly modules:readonly (readonly boolean[])[];
}

const DATA_CODEWORDS_L=[0,19,34,55,80,108,136,156,194,232] as const;
const ECC_CODEWORDS_PER_BLOCK_L=[0,7,10,15,20,26,18,20,24,30] as const;
const BLOCKS_L=[0,1,1,1,1,1,2,2,2,2] as const;
const ALIGNMENT_POSITIONS:readonly (readonly number[])[]=[[],[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46]];

export function createSpecializedQrMatrix(value:string):SpecializedQrMatrix {
  const text=value.trim();
  if(!text)throw new Error("QR destination is required.");
  const bytes=Uint8Array.from(new TextEncoder().encode(text));
  if(bytes.length>255)throw new Error("QR destination is too long for the built-in production encoder. Shorten the visible destination to 255 UTF-8 bytes or fewer.");
  const version=selectVersion(bytes);
  const dataCodewords=encodeDataCodewords(bytes,version);
  const allCodewords=addErrorCorrection(dataCodewords,version);
  const base=createBaseMatrix(version);
  let best:MutableQr|undefined,bestPenalty=Number.POSITIVE_INFINITY;
  for(let mask=0;mask<8;mask++){
    const candidate=cloneQr(base);
    drawCodewords(candidate,allCodewords,mask);
    drawFormatBits(candidate,mask);
    const penalty=penaltyScore(candidate.modules);
    if(penalty<bestPenalty){bestPenalty=penalty;best=candidate;}
  }
  if(!best)throw new Error("QR matrix generation failed.");
  return Object.freeze({version,size:best.size,quietZoneModules:SPECIALIZED_QR_QUIET_ZONE_MODULES,errorCorrection:SPECIALIZED_QR_ECC,modules:Object.freeze(best.modules.map(row=>Object.freeze([...row])))});
}

export function specializedQrModuleSizeInches(value:string,boxWidthInches:number,boxHeightInches=boxWidthInches):number {
  if(!Number.isFinite(boxWidthInches)||boxWidthInches<=0||!Number.isFinite(boxHeightInches)||boxHeightInches<=0)throw new Error("QR physical size must be positive.");
  const qr=createSpecializedQrMatrix(value),total=qr.size+SPECIALIZED_QR_QUIET_ZONE_MODULES*2;
  return Math.min(boxWidthInches,boxHeightInches)/total;
}

export function specializedQrSvg(value:string,x:number,y:number,width:number,height:number,dark="#111111",light="#ffffff"):string {
  const qr=createSpecializedQrMatrix(value),quiet=SPECIALIZED_QR_QUIET_ZONE_MODULES,total=qr.size+quiet*2,module=Math.min(width,height)/total,drawW=module*total,drawH=drawW,ox=x+(width-drawW)/2,oy=y+(height-drawH)/2;
  const rects:string[]=[`<rect x="${num(ox)}" y="${num(oy)}" width="${num(drawW)}" height="${num(drawH)}" fill="${escapeXml(light)}"/>`];
  for(let row=0;row<qr.size;row++)for(let col=0;col<qr.size;col++)if(qr.modules[row][col])rects.push(`<rect x="${num(ox+(col+quiet)*module)}" y="${num(oy+(row+quiet)*module)}" width="${num(module)}" height="${num(module)}" fill="${escapeXml(dark)}"/>`);
  return `<g role="img" aria-label="QR code for ${escapeXml(value)}">${rects.join("")}</g>`;
}

type MutableQr={size:number;modules:boolean[][];isFunction:boolean[][]};

function selectVersion(bytes:Uint8Array):number {
  for(let version=1;version<=9;version++)if(4+8+bytes.length*8<=DATA_CODEWORDS_L[version]*8)return version;
  throw new Error("QR destination exceeds the supported Version 9-L production capacity. Use a shorter destination URL.");
}

function encodeDataCodewords(bytes:Uint8Array,version:number):Uint8Array {
  const capacity=DATA_CODEWORDS_L[version]*8,bits:number[]=[];
  appendBits(bits,0b0100,4);appendBits(bits,bytes.length,8);for(const byte of bytes)appendBits(bits,byte,8);
  appendBits(bits,0,Math.min(4,capacity-bits.length));while(bits.length%8)bits.push(0);
  const data:number[]=[];for(let i=0;i<bits.length;i+=8){let value=0;for(let j=0;j<8;j++)value=(value<<1)|bits[i+j];data.push(value);}
  for(let pad=0;data.length<DATA_CODEWORDS_L[version];pad++)data.push(pad%2===0?0xec:0x11);
  return Uint8Array.from(data);
}

function addErrorCorrection(data:Uint8Array,version:number):Uint8Array {
  const blockCount=BLOCKS_L[version],eccLength=ECC_CODEWORDS_PER_BLOCK_L[version];
  if(data.length%blockCount!==0)throw new Error("Unsupported QR block distribution.");
  const blockLength=data.length/blockCount,divisor=reedSolomonDivisor(eccLength),blocks:Uint8Array[]=[],eccBlocks:Uint8Array[]=[];
  for(let block=0;block<blockCount;block++){const part=data.slice(block*blockLength,(block+1)*blockLength);blocks.push(part);eccBlocks.push(reedSolomonRemainder(part,divisor));}
  const out:number[]=[];for(let i=0;i<blockLength;i++)for(const block of blocks)out.push(block[i]);for(let i=0;i<eccLength;i++)for(const ecc of eccBlocks)out.push(ecc[i]);return Uint8Array.from(out);
}

function createBaseMatrix(version:number):MutableQr {
  const size=version*4+17,qr:MutableQr={size,modules:Array.from({length:size},()=>Array(size).fill(false)),isFunction:Array.from({length:size},()=>Array(size).fill(false))};
  drawFinder(qr,3,3);drawFinder(qr,size-4,3);drawFinder(qr,3,size-4);
  for(const row of ALIGNMENT_POSITIONS[version])for(const col of ALIGNMENT_POSITIONS[version])if(!qr.isFunction[row][col])drawAlignment(qr,col,row);
  for(let i=0;i<size;i++){if(!qr.isFunction[6][i])setFunction(qr,i,6,i%2===0);if(!qr.isFunction[i][6])setFunction(qr,6,i,i%2===0);}
  drawFormatBits(qr,0);if(version>=7)drawVersion(qr,version);
  return qr;
}

function cloneQr(source:MutableQr):MutableQr{return{size:source.size,modules:source.modules.map(row=>[...row]),isFunction:source.isFunction.map(row=>[...row])};}
function setFunction(qr:MutableQr,x:number,y:number,dark:boolean):void{if(x<0||y<0||x>=qr.size||y>=qr.size)return;qr.modules[y][x]=dark;qr.isFunction[y][x]=true;}
function drawFinder(qr:MutableQr,cx:number,cy:number):void{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const distance=Math.max(Math.abs(dx),Math.abs(dy));setFunction(qr,cx+dx,cy+dy,distance!==2&&distance!==4);}}
function drawAlignment(qr:MutableQr,cx:number,cy:number):void{for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)setFunction(qr,cx+dx,cy+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);}

function drawFormatBits(qr:MutableQr,mask:number):void {
  const data=(1<<3)|mask;let rem=data;for(let i=0;i<10;i++)rem=(rem<<1)^(((rem>>>9)&1)*0x537);const bits=((data<<10)|rem)^0x5412,bit=(i:number)=>((bits>>>i)&1)!==0,size=qr.size;
  for(let i=0;i<=5;i++)setFunction(qr,8,i,bit(i));setFunction(qr,8,7,bit(6));setFunction(qr,8,8,bit(7));setFunction(qr,7,8,bit(8));for(let i=9;i<15;i++)setFunction(qr,14-i,8,bit(i));
  for(let i=0;i<8;i++)setFunction(qr,size-1-i,8,bit(i));for(let i=8;i<15;i++)setFunction(qr,8,size-15+i,bit(i));setFunction(qr,8,size-8,true);
}

function drawVersion(qr:MutableQr,version:number):void {let rem=version;for(let i=0;i<12;i++)rem=(rem<<1)^(((rem>>>11)&1)*0x1f25);const bits=(version<<12)|rem;for(let i=0;i<18;i++){const dark=((bits>>>i)&1)!==0,a=qr.size-11+(i%3),b=Math.floor(i/3);setFunction(qr,a,b,dark);setFunction(qr,b,a,dark);}}

function drawCodewords(qr:MutableQr,data:Uint8Array,mask:number):void {let bitIndex=0,upward=true;for(let right=qr.size-1;right>=1;right-=2){if(right===6)right--;for(let vert=0;vert<qr.size;vert++){const y=upward?qr.size-1-vert:vert;for(let j=0;j<2;j++){const x=right-j;if(qr.isFunction[y][x])continue;let dark=false;if(bitIndex<data.length*8)dark=((data[bitIndex>>>3]>>>(7-(bitIndex&7)))&1)!==0;bitIndex++;if(maskBit(mask,x,y))dark=!dark;qr.modules[y][x]=dark;}}upward=!upward;}}
function maskBit(mask:number,x:number,y:number):boolean{switch(mask){case 0:return(x+y)%2===0;case 1:return y%2===0;case 2:return x%3===0;case 3:return(x+y)%3===0;case 4:return(Math.floor(y/2)+Math.floor(x/3))%2===0;case 5:return(x*y)%2+(x*y)%3===0;case 6:return((x*y)%2+(x*y)%3)%2===0;case 7:return((x+y)%2+(x*y)%3)%2===0;default:throw new Error("Invalid QR mask.");}}

function penaltyScore(modules:boolean[][]):number {const size=modules.length;let score=0;for(let y=0;y<size;y++)score+=linePenalty(modules[y]);for(let x=0;x<size;x++)score+=linePenalty(modules.map(row=>row[x]));for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=modules[y][x];if(modules[y][x+1]===c&&modules[y+1][x]===c&&modules[y+1][x+1]===c)score+=3;}let dark=0;for(const row of modules)for(const value of row)if(value)dark++;score+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;return score;}
function linePenalty(line:boolean[]):number {let score=0,run=1;for(let i=1;i<line.length;i++){if(line[i]===line[i-1])run++;else{if(run>=5)score+=3+run-5;run=1;}}if(run>=5)score+=3+run-5;for(let i=0;i<=line.length-7;i++){if(line[i]&&!line[i+1]&&line[i+2]&&line[i+3]&&line[i+4]&&!line[i+5]&&line[i+6]){const before=i>=4&&!line[i-1]&&!line[i-2]&&!line[i-3]&&!line[i-4],after=i+10<line.length&&!line[i+7]&&!line[i+8]&&!line[i+9]&&!line[i+10];if(before||after)score+=40;}}return score;}

function reedSolomonDivisor(degree:number):Uint8Array {const result=new Uint8Array(degree);result[degree-1]=1;let root=1;for(let i=0;i<degree;i++){for(let j=0;j<degree;j++){result[j]=gfMultiply(result[j],root);if(j+1<degree)result[j]^=result[j+1];}root=gfMultiply(root,0x02);}return result;}
function reedSolomonRemainder(data:Uint8Array,divisor:Uint8Array):Uint8Array {const result=new Uint8Array(divisor.length);for(const value of data){const factor=value^result[0];result.copyWithin(0,1);result[result.length-1]=0;for(let i=0;i<result.length;i++)result[i]^=gfMultiply(divisor[i],factor);}return result;}
function gfMultiply(x:number,y:number):number {let z=0;for(let i=7;i>=0;i--){z=(z<<1)^(((z>>>7)&1)*0x11d);if(((y>>>i)&1)!==0)z^=x;}return z;}
function appendBits(target:number[],value:number,count:number):void{if(count<0||count>31||value>>>count!==0)throw new Error("Invalid QR bit append.");for(let i=count-1;i>=0;i--)target.push((value>>>i)&1);}
function num(value:number):string{return Number(value.toFixed(5)).toString();}
function escapeXml(value:string):string{return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[char]!));}
