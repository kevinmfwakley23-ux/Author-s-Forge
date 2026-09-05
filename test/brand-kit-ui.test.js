"use strict";

const test=require("node:test");
const assert=require("node:assert/strict");
const {readFile}=require("node:fs/promises");
const {join}=require("node:path");
const vm=require("node:vm");
const root=join(__dirname,"..");
const text=path=>readFile(join(root,path),"utf8");

test("Specialized Brand Kit browser extension parses",async()=>{const source=await text("public/specialized-brand-kit.js");assert.doesNotThrow(()=>new vm.Script(source,{filename:"specialized-brand-kit.js"}));});
test("Specialized state sync loads Brand Kit extension",async()=>{const source=await text("public/specialized-creation-api-state-sync.js");assert.match(source,/specialized-brand-kit\.js/);assert.match(source,/data-forge-extension="brand-kit"/);});
test("Brand Kit UI keeps brand application proposal-only until explicit approval",async()=>{const source=await text("public/specialized-brand-kit.js");assert.match(source,/Propose on-brand revision/);assert.match(source,/persisted: no/);assert.match(source,/Approve \+ save branded revision/);assert.match(source,/confirm\(`Save this branded candidate as a new revision/);assert.match(source,/\/documents`/);});
test("Brand Kit multi-target resize previews before separate profile and document persistence",async()=>{const source=await text("public/specialized-brand-kit.js");assert.match(source,/Multi-target safe resize/);assert.match(source,/Preview selected campaign variants/);assert.match(source,/multi-target-reflow/);assert.match(source,/persisted: no/);assert.match(source,/Approve \+ save this target/);assert.match(source,/confirm\(`Save \$\{variant\.target\.label\} as an editable document and production profile/);assert.match(source,/\/profiles`/);assert.match(source,/\/documents`/);});
test("Specialized server wires durable Brand Kit routes",async()=>{const source=await text("src/specialized-creation-server.ts");assert.match(source,/FileBrandKitStore/);assert.match(source,/createSpecializedBrandKitRoutes/);assert.match(source,/brand-kits\.json/);assert.match(source,/brandKitRoutes\(req,res,url,forgeProjectId\)/);});
test("Brand Kit route exposes review-only creative target proposals",async()=>{const source=await text("src/application/specialized-brand-kit-routes.ts");assert.match(source,/CREATIVE_TARGET_PRESETS/);assert.match(source,/multi-target-reflow/);assert.match(source,/createMultiTargetReflowProposal/);assert.match(source,/persisted: false/);assert.match(source,/Review each candidate and its safe-zone\/Brand Kit evidence/);});
