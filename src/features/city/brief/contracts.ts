import {z} from 'zod';
import {evidenceLinkSchema} from '../ai-contracts';
import type {RevisionSnapshot,StressView} from '../workshop-contracts';
export const briefSectionKinds=['goal','benefits','tradeoffs','risks','assumptions','rationale','limits'] as const;
export const briefDraftSchema=z.object({id:z.enum(briefSectionKinds),text:z.string().trim().min(10).max(2500),refs:z.array(evidenceLinkSchema).max(12)}).strict();
export interface BriefSection extends z.infer<typeof briefDraftSchema>{userEdited:boolean;stale:boolean;generatedText:string|null;}
export interface BriefRecord {
 id:string;scenarioId:string;sourceRevisionId:string;stressId:string|null;comparisonRevisionIds:string[];
 version:number;title:string;locale:'ru'|'kk'|'en';sections:BriefSection[];sourceHash:string;
 status:'pending'|'ready'|'needs_review';lastRunId:string|null;createdAt:string;updatedAt:string;
}
export interface BriefView {brief:BriefRecord;source:RevisionSnapshot;stress:StressView|null;comparisons:RevisionSnapshot[];stale:boolean;versions:number[];}
export const createBriefSchema=z.object({sourceRevisionId:z.string().uuid(),stressId:z.string().uuid().optional(),comparisonRevisionIds:z.array(z.string().uuid()).max(2).default([]),locale:z.enum(['ru','kk','en']).default('ru'),clientMutationId:z.string().uuid()}).strict();
export const editBriefSchema=z.object({expectedVersion:z.number().int().positive(),title:z.string().trim().min(1).max(160).optional(),sectionEdits:z.array(z.object({id:z.enum(briefSectionKinds),text:z.string().max(2500),acceptGenerated:z.boolean().optional()}).strict()).max(7).default([])}).strict();
export const refreshBriefSchema=z.object({expectedVersion:z.number().int().positive(),targetRevisionId:z.string().uuid(),sectionIds:z.array(z.enum(briefSectionKinds)).max(7).optional(),clientRequestId:z.string().uuid()}).strict();
