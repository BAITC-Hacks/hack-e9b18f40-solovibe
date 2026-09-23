import {z} from 'zod';
import type {Constraints,Decision,Evaluation,StressAssumption} from './contracts';
import type {BriefRecord} from './brief/contracts';
import type {ArtifactRecord} from './artifact-contracts';
export const createShareSchema=z.object({revisionId:z.string().uuid(),briefId:z.string().uuid().optional(),briefVersion:z.number().int().positive().optional(),artifactIds:z.array(z.string().uuid()).max(10).default([]),teamName:z.string().trim().max(80).default(''),clientMutationId:z.string().uuid()}).strict();
export interface ShareRecord {id:string;scenarioId:string;revisionId:string;briefId:string|null;briefVersion:number|null;artifactIds:string[];teamName:string;expiresAt:string;revokedAt:string|null;createdAt:string;}
export interface PublicSnapshot {title:string;teamName:string;revisionId:string;decisions:Decision[];constraints:Constraints;evaluation:Evaluation;stress:{assumption:StressAssumption;stressed:Evaluation}|null;brief:Pick<BriefRecord,'title'|'sections'|'locale'|'version'|'sourceHash'|'status'>|null;artifacts:ArtifactRecord[];expiresAt:string;}
export interface SharedComparison {snapshots:PublicSnapshot[];}
