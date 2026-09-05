import test from "node:test";
import assert from "node:assert/strict";
import { generateImage } from "../dist/infrastructure/image-provider.js";

const PNG_BASE64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl5ZVQAAAAASUVORK5CYII=";
const PNG_DATA_URI=`data:image/png;base64,${PNG_BASE64}`;
function successResponse(){return new Response(JSON.stringify({data:[{b64_json:PNG_BASE64}]}),{status:200,headers:{"content-type":"application/json","x-request-id":"req-image-1"}});}

test("image provider uses JSON generation endpoint and returns validated PNG bytes",async()=>{
  let call;const fetchImpl=async(url,init)=>{call={url:String(url),init};return successResponse();};
  const result=await generateImage({prompt:"Original forest guardian",size:"1024x1024"},{apiKey:"test-key",model:"gpt-image-2",fetchImpl});
  assert.equal(call.url,"https://api.openai.com/v1/images/generations");assert.equal(call.init.method,"POST");assert.equal(call.init.headers["content-type"],"application/json");assert.equal(JSON.parse(call.init.body).model,"gpt-image-2");assert.equal(result.dataUri,PNG_DATA_URI);assert.equal(Buffer.from(result.bytesBase64,"base64").subarray(0,8).toString("hex"),"89504e470d0a1a0a");
});

test("approved visual reference uses multipart image-edit path with actual validated image bytes",async()=>{
  let call;const fetchImpl=async(url,init)=>{call={url:String(url),init};return successResponse();};
  await generateImage({prompt:"Evolve this original guardian while preserving identity",size:"1024x1536",referenceImages:[{dataUri:PNG_DATA_URI,label:"Approved guardian design"}]},{apiKey:"test-key",model:"gpt-image-2",fetchImpl});
  assert.equal(call.url,"https://api.openai.com/v1/images/edits");assert.equal(call.init.method,"POST");assert.equal(call.init.headers.authorization,"Bearer test-key");assert.equal(call.init.headers["content-type"],undefined);
  assert.ok(call.init.body instanceof FormData);assert.equal(call.init.body.get("model"),"gpt-image-2");assert.equal(call.init.body.get("size"),"1024x1536");assert.equal(call.init.body.has("input_fidelity"),false);const images=call.init.body.getAll("image[]");assert.equal(images.length,1);assert.ok(images[0] instanceof Blob);assert.equal(images[0].type,"image/png");assert.equal(images[0].size,68);
});

test("image provider rejects URL references, malformed base64, and fake image bytes before network",async()=>{
  let calls=0;const fetchImpl=async()=>{calls++;return successResponse();};
  await assert.rejects(()=>generateImage({prompt:"x",referenceImages:[{dataUri:"https://example.com/character.png"}]},{apiKey:"test-key",fetchImpl}),/will not fetch arbitrary reference URLs/);
  await assert.rejects(()=>generateImage({prompt:"x",referenceImages:[{dataUri:"data:text/html;base64,QUJDRA=="}]},{apiKey:"test-key",fetchImpl}),/base64 PNG, JPEG, or WebP/);
  await assert.rejects(()=>generateImage({prompt:"x",referenceImages:[{dataUri:"data:image/png;base64,%%%%"}]},{apiKey:"test-key",fetchImpl}),/base64 PNG, JPEG, or WebP/);
  await assert.rejects(()=>generateImage({prompt:"x",referenceImages:[{dataUri:"data:image/png;base64,QUJDRA=="}]},{apiKey:"test-key",fetchImpl}),/not a valid PNG byte stream/);
  assert.equal(calls,0);
});

test("image provider rejects a successful HTTP response containing fake PNG bytes",async()=>{
  const fetchImpl=async()=>new Response(JSON.stringify({data:[{b64_json:"QUJDRA=="}]}),{status:200,headers:{"content-type":"application/json"}});
  await assert.rejects(()=>generateImage({prompt:"x"},{apiKey:"test-key",fetchImpl}),/not a valid PNG byte stream/);
});

test("image provider enforces reference count and byte limits before network",async()=>{
  const tiny={dataUri:PNG_DATA_URI};let calls=0;const fetchImpl=async()=>{calls++;return successResponse();};
  await assert.rejects(()=>generateImage({prompt:"x",referenceImages:[tiny,tiny,tiny,tiny,tiny]},{apiKey:"test-key",fetchImpl}),/at most 4 approved reference images/);
  const over=Buffer.alloc(10*1024*1024+1,7).toString("base64");await assert.rejects(()=>generateImage({prompt:"x",referenceImages:[{dataUri:`data:image/png;base64,${over}`}]},{apiKey:"test-key",fetchImpl}),/exceeds the 10 MiB per-image limit/);assert.equal(calls,0);
});

test("image provider fails honestly when no real provider key exists",async()=>{
  const previous=process.env.OPENAI_API_KEY;delete process.env.OPENAI_API_KEY;try{await assert.rejects(()=>generateImage({prompt:"x"}),/No real image provider is configured/);}finally{if(previous===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previous;}
});
