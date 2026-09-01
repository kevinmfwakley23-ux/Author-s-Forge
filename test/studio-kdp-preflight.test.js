import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StudioKdpPreflightService } from "../dist/application/studio-kdp-preflight.js";
import { KdpPreflightHistoryService } from "../dist/application/kdp-preflight-history.js";
import { BookCoverStudioService } from "../dist/application/book-cover-studio.js";
import { FileKdpPreflightStore } from "../dist/infrastructure/file-kdp-preflight-store.js";
import { calculateKdpCoverLayout } from "../dist/domain/book-cover-studio.js";
import { createProject, withProjectBookCoverPlans } from "../dist/domain/project.js";

const publishing = { platform:"kdp", binding:"paperback", interiorType:"black-white", paperType:"white", trimWidthInches:6, trimHeightInches:9, pageCount:120, bleedInches:0.125, readingDirection:"ltr" };

function projectWithPlan() {
  const project = createProject({ id:"project-1", title:"Production Book" });
  const plan = new BookCoverStudioService().create({ id:"cover-1", projectId:"project-1", bookId:"book-1", format:"paperback", publishing, title:"Production Book", author:"Author", frontPrompt:"Front", spineText:"Production Book", backText:"Back", outputFormat:"pdf", dpi:300, version:1, approvalStatus:"draft" });
  return withProjectBookCoverPlans(project,[plan]);
}

function facts() {
  const layout=calculateKdpCoverLayout(publishing);
  return {
    interior:{format:"pdf",sizeBytes:1_000_000,encrypted:false,fontsEmbedded:true,imagesEmbedded:true,minimumImageDpi:300,transparentObjectsFlattened:true,hasCropMarks:false,hasTrimMarks:false,hasBookmarks:false,hasComments:false,hasAnnotations:false,hasPlaceholderText:false,hasPdfCreationWatermark:false,pageWidthInches:6,pageHeightInches:9,insideMarginInches:0.375,outsideMarginInches:0.25,topMarginInches:0.25,bottomMarginInches:0.25},
    cover:{format:"pdf",sizeBytes:2_000_000,encrypted:false,fontsEmbedded:true,minimumImageDpi:300,transparentObjectsFlattened:true,hasCropMarks:false,hasTrimMarks:false,hasTemplateText:false,titleOnFront:true,widthInches:layout.dimensions.widthInches,heightInches:layout.dimensions.heightInches,spineTextPresent:true},
  };
}

async function service() {
  const dir=await mkdtemp(join(tmpdir(),"forge-studio-kdp-"));
  return new StudioKdpPreflightService(new KdpPreflightHistoryService(new FileKdpPreflightStore(join(dir,"preflight.json"))));
}

test("Studio KDP preflight uses authoritative durable cover geometry", async()=>{
  const studio=await service(); const project=projectWithPlan(); const f=facts();
  const result=await studio.audit({project,bookId:"book-1",interiorHasBleed:false,...f,reportId:"report-1",now:"2026-08-31T20:10:00.000Z"});
  assert.equal(result.coverPlanId,"cover-1");
  assert.equal(result.report.status,"ready");
  assert.equal((await studio.latest("project-1")).id,"report-1");
});

test("Studio KDP preflight cannot be tricked with caller publishing geometry", async()=>{
  const studio=await service(); const project=projectWithPlan(); const f=facts();
  const result=await studio.audit({project,coverPlanId:"cover-1",interiorHasBleed:false,interior:f.interior,cover:{...f.cover,widthInches:f.cover.widthInches+0.5},reportId:"report-2"});
  assert.equal(result.report.status,"blocked");
  assert.ok(result.report.findings.some((finding)=>finding.code==="COVER_DIMENSIONS"));
});

test("Studio KDP preflight requires an authoritative cover plan", async()=>{
  const studio=await service(); const project=createProject({id:"project-2",title:"No Cover"}); const f=facts();
  await assert.rejects(()=>studio.audit({project,interiorHasBleed:false,...f}),/Create a KDP cover plan before running production preflight/);
});
