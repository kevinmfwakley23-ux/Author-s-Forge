import type { EducationalAssessmentRecord, EducationalMasteryBand, EducationalResponseMode, EducationalRubric } from "./educational-assessment";

export const EDUCATIONAL_PROGRESS_ANALYTICS_FORMAT_VERSION = 1 as const;
export interface EducationalCriterionProgress {
  readonly rubricId: string;
  readonly criterionId: string;
  readonly criterionName: string;
  readonly learningObjective: string;
  readonly evidenceCount: number;
  readonly averagePercent: number;
}
export interface EducationalRubricProgress {
  readonly rubricId: string;
  readonly rubricTitle: string;
  readonly evidenceCount: number;
  readonly averageWeightedPercent: number;
  readonly masteryCounts: Readonly<Record<EducationalMasteryBand, number>>;
  readonly criteria: readonly EducationalCriterionProgress[];
}
export interface EducationalProgressAnalyticsReport {
  readonly formatVersion: typeof EDUCATIONAL_PROGRESS_ANALYTICS_FORMAT_VERSION;
  readonly projectId: string;
  readonly generatedAt: string;
  readonly evidenceRecordCount: number;
  readonly averageWeightedPercent: number | null;
  readonly masteryCounts: Readonly<Record<EducationalMasteryBand, number>>;
  readonly responseModeCounts: Readonly<Record<EducationalResponseMode, number>>;
  readonly rubricProgress: readonly EducationalRubricProgress[];
  readonly evidenceWindow: { readonly firstRecordedAt: string | null; readonly lastRecordedAt: string | null };
}

export function buildEducationalProgressAnalytics(input: { readonly projectId: string; readonly rubrics: readonly EducationalRubric[]; readonly records: readonly EducationalAssessmentRecord[]; readonly now?: string }): EducationalProgressAnalyticsReport {
  const projectId = required(input.projectId, "Project id");
  const rubrics = input.rubrics.filter((rubric) => rubric.projectId === projectId);
  const rubricMap = new Map(rubrics.map((rubric) => [rubric.id, rubric]));
  const records = input.records.filter((record) => record.projectId === projectId).sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt)||a.id.localeCompare(b.id));
  for (const record of records) if (!rubricMap.has(record.rubricId)) throw new Error(`Progress analytics record "${record.id}" references missing rubric "${record.rubricId}".`);
  const masteryCounts = emptyMastery();
  const responseModeCounts = emptyResponseModes();
  for (const record of records) { masteryCounts[record.masteryBand] += 1; responseModeCounts[record.responseMode] += 1; }
  const rubricProgress = rubrics.map((rubric) => rubricProgressFor(rubric, records.filter((record) => record.rubricId === rubric.id))).sort((a,b)=>a.rubricTitle.localeCompare(b.rubricTitle)||a.rubricId.localeCompare(b.rubricId));
  return Object.freeze({
    formatVersion: EDUCATIONAL_PROGRESS_ANALYTICS_FORMAT_VERSION,
    projectId,
    generatedAt: iso(input.now ?? new Date().toISOString(), "Progress analytics generatedAt"),
    evidenceRecordCount: records.length,
    averageWeightedPercent: records.length ? round(records.reduce((sum,record)=>sum+record.weightedPercent,0)/records.length) : null,
    masteryCounts: Object.freeze(masteryCounts),
    responseModeCounts: Object.freeze(responseModeCounts),
    rubricProgress: Object.freeze(rubricProgress),
    evidenceWindow: Object.freeze({ firstRecordedAt: records[0]?.recordedAt ?? null, lastRecordedAt: records.at(-1)?.recordedAt ?? null }),
  });
}

function rubricProgressFor(rubric: EducationalRubric, records: readonly EducationalAssessmentRecord[]): EducationalRubricProgress {
  const masteryCounts = emptyMastery(); for (const record of records) masteryCounts[record.masteryBand] += 1;
  const levels = [...rubric.levels].sort((a,b)=>a.score-b.score||a.id.localeCompare(b.id)), min=levels[0].score, max=levels.at(-1)!.score;
  if (max <= min) throw new Error(`Rubric "${rubric.id}" performance levels do not span a score range.`);
  const criteria = rubric.criteria.map((criterion): EducationalCriterionProgress => {
    const values:number[]=[];
    for (const record of records) {
      const score=record.scores.find((item)=>item.criterionId===criterion.id); if(!score) throw new Error(`Assessment record "${record.id}" is missing criterion "${criterion.id}".`);
      const level=rubric.levels.find((item)=>item.id===score.levelId); if(!level) throw new Error(`Assessment record "${record.id}" references missing level "${score.levelId}".`);
      values.push(((level.score-min)/(max-min))*100);
    }
    return Object.freeze({rubricId:rubric.id,criterionId:criterion.id,criterionName:criterion.name,learningObjective:criterion.learningObjective,evidenceCount:values.length,averagePercent:values.length?round(values.reduce((a,b)=>a+b,0)/values.length):0});
  });
  return Object.freeze({rubricId:rubric.id,rubricTitle:rubric.title,evidenceCount:records.length,averageWeightedPercent:records.length?round(records.reduce((sum,r)=>sum+r.weightedPercent,0)/records.length):0,masteryCounts:Object.freeze(masteryCounts),criteria:Object.freeze(criteria)});
}
function emptyMastery():Record<EducationalMasteryBand,number>{return{emerging:0,developing:0,proficient:0,advanced:0};}
function emptyResponseModes():Record<EducationalResponseMode,number>{return{written:0,oral:0,drawing:0,diagram:0,model:0,demonstration:0,digital:0,other:0};}
function round(value:number):number{return Math.round(value*10)/10;}
function required(value:string,label:string):string{if(typeof value!=="string"||!value.trim())throw new Error(`${label} is required.`);return value.trim();}
function iso(value:string,label:string):string{const d=new Date(value);if(!Number.isFinite(d.getTime()))throw new Error(`${label} must be a valid timestamp.`);return d.toISOString();}
