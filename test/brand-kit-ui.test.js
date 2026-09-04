"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {readFile}=require("node:fs/promises");
const {join}=require("node:path");
const vm=require("node:vm");
const root=join(__dirname,"..");
const text=path=>readFile(join(root,path),"utf8");

test("Specialized Brand Kit browser extension parses",async()=>{assert.doesNotThrow(()=>new vm.Script(await text("public/specialized-brand-kit.js"),{filename:"specialized-brand-kit.js"}));});
test("Specialized state sync loads Brand Kit extension",async()=>{const source=await text("public/specialized-creation-api-state-sync.js");assert.match(source,/specialized-brand-kit\.js/);assert.match(source,/data-forge-extension="brand-kit"/);});
test("Brand Kit UI keeps brand application proposal-only until explicit approval",async()=>{const source=await text("public/specialized-brand-kit.js");assert.match(source,/Propose on-brand revision/);assert.match(source,/persisted: no/);assert.match(source,/Approve \+ save branded revision/);assert.match(source,/confirm\(`Save this branded candidate as a new revision/);assert.match(source,/\/documents`/);});
test("Specialized server wires durable Brand Kit routes",async()=>{const source=await text("src/specialized-creation-server.ts");assert.match(source,/FileBrandKitStore/);assert.match(source,/createSpecializedBrandKitRoutes/);assert.match(source,/brand-kits\.json/);assert.match(source,/brandKitRoutes\(req,res,url,forgeProjectId\)/);});