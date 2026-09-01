import assert from "node:assert/strict";
import test from "node:test";
import {
  approveMarketingAsset,
  assessMarketingAssetCompliance,
  createMarketingCampaign,
  publishMarketingAsset,
  rejectMarketingAsset,
  scheduleMarketingAsset,
} from "../src/domain/marketing-campaign";

const campaign=createMarketingCampaign({
  id:"c",projectId:"p",bookId:"b",objective:"launch",audience:"readers",readerPromise:"promise",
  assets:[{id:"a",channel:"social",kind:"social-post",title:"Launch",body:"A gentle story about friendship.",status:"draft",evidence:[{source:"positioning",claim:"friendship is the central theme",confidence:"source-supported"}]}]
});

test("approval gates scheduling and publishing",()=>{
  assert.throws(()=>scheduleMarketingAsset(campaign,"a","2030-01-01T00:00:00Z"),/Only approved/);
  assert.throws(()=>publishMarketingAsset(campaign,"a"),/Only approved or scheduled/);
  const approved=approveMarketingAsset(campaign,"a","2026-09-01T12:00:00Z");
  assert.equal(approved.assets[0].status,"approved");
  assert.equal(approved.assets[0].approvedAt,"2026-09-01T12:00:00Z");
  const scheduled=scheduleMarketingAsset(approved,"a","2030-01-01T00:00:00Z","2026-09-01T12:01:00Z");
  assert.equal(scheduled.assets[0].status,"scheduled");
  const published=publishMarketingAsset(scheduled,"a",{now:"2030-01-01T00:05:00Z",externalReference:"campaign-post-44"});
  assert.equal(published.assets[0].status,"published");
  assert.equal(published.assets[0].publishedAt,"2030-01-01T00:05:00Z");
  assert.equal(published.assets[0].externalReference,"campaign-post-44");
});

test("inference claims cannot become scheduled or published",()=>{
  const c=createMarketingCampaign({...campaign,assets:[{...campaign.assets[0],evidence:[{source:"model",claim:"likely bestseller",confidence:"inference"}]}]});
  const approved=approveMarketingAsset(c,"a");
  assert.throws(()=>scheduleMarketingAsset(approved,"a","2030-01-01T00:00:00Z"),/Inference-only/);
  assert.throws(()=>publishMarketingAsset(approved,"a"),/Inference-only/);
});

test("Amazon Ads and A+ compliance blocks current policy violations",()=>{
  const ad={id:"ad",channel:"amazon-ads" as const,kind:"ad-copy" as const,title:"#1 bestseller",body:"Only $2.99 today",status:"draft" as const,evidence:[]};
  const adIssues=assessMarketingAssetCompliance(ad);
  assert.ok(adIssues.some((issue)=>issue.id==="amazon-ads-price"));
  assert.ok(adIssues.some((issue)=>issue.id==="amazon-ads-unsubstantiated"));
  const aplus={id:"aplus",channel:"a-plus" as const,kind:"a-plus-module" as const,title:"Buy now",body:"Free bonus at https://example.com — latest holiday release",status:"draft" as const,evidence:[]};
  const aPlusIssues=assessMarketingAssetCompliance(aplus);
  assert.ok(aPlusIssues.some((issue)=>issue.id==="a-plus-promotion"));
  assert.ok(aPlusIssues.some((issue)=>issue.id==="a-plus-time-sensitive"));
  assert.ok(aPlusIssues.some((issue)=>issue.id==="a-plus-contact"));
});

test("A+ plans reference real campaign assets and rejected assets cannot be approved",()=>{
  const withAPlus=createMarketingCampaign({...campaign,assets:[...campaign.assets,{id:"module-1",channel:"a-plus",kind:"a-plus-module",title:"Meet the world",body:"Explore the characters and setting.",status:"draft",evidence:[{source:"manuscript",claim:"characters and setting are in the book",confidence:"known"}]}],aPlusContentPlans:[{marketplace:"Amazon.com",language:"English",contentName:"Launch detail page",asinTargets:["B0TEST123"],moduleAssetIds:["module-1"]}]});
  assert.equal(withAPlus.aPlusContentPlans?.[0].moduleAssetIds[0],"module-1");
  assert.throws(()=>createMarketingCampaign({...withAPlus,aPlusContentPlans:[{...withAPlus.aPlusContentPlans![0],moduleAssetIds:["missing"]}]}),/missing marketing asset/);
  const rejected=rejectMarketingAsset(withAPlus,"module-1");
  assert.equal(rejected.assets.find((asset)=>asset.id==="module-1")?.status,"rejected");
  assert.throws(()=>approveMarketingAsset(rejected,"module-1"),/Rejected assets/);
});