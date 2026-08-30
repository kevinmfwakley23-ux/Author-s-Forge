import assert from "node:assert/strict";
import test from "node:test";
import { approveMarketingAsset, createMarketingCampaign, scheduleMarketingAsset } from "../src/domain/marketing-campaign";
const campaign=createMarketingCampaign({id:"c",projectId:"p",bookId:"b",objective:"launch",audience:"readers",readerPromise:"promise",assets:[{id:"a",channel:"social",title:"Launch",body:"New book",status:"draft",evidence:[{source:"positioning",claim:"supported",confidence:"source-supported"}]}]});
test("approval gates scheduling",()=>{assert.throws(()=>scheduleMarketingAsset(campaign,"a","2030-01-01T00:00:00Z"),/Only approved/);const approved=approveMarketingAsset(campaign,"a");assert.equal(scheduleMarketingAsset(approved,"a","2030-01-01T00:00:00Z").assets[0].status,"scheduled")});
test("inference claims cannot schedule",()=>{const c=createMarketingCampaign({...campaign,assets:[{...campaign.assets[0],evidence:[{source:"model",claim:"likely bestseller",confidence:"inference"}]}]});assert.throws(()=>scheduleMarketingAsset(approveMarketingAsset(c,"a"),"a","2030-01-01T00:00:00Z"),/Inference-only/)})
