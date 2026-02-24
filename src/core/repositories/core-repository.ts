import { Effect } from "effect";

import { AuditTransition } from "../domain/audit-transition";
import { EntityType } from "../domain/common";

export interface AuditTrailFilter {
  entityType?: EntityType | string;
  entityId?: string;
}

export interface JobRunHistoryQuery {
  jobId: string;
  limit?: number;
  beforeAt?: Date;
}

export interface ListJobsQuery {
  runState?: "idle" | "running" | "succeeded" | "failed" | "retrying";
  limit?: number;
  beforeUpdatedAt?: Date;
}

export interface ActivityFeedQuery {
  entityType?: EntityType | string;
  entityId?: string;
  actorKind?: "user" | "system" | "ai";
  aiOnly?: boolean;
  limit?: number;
  beforeAt?: Date;
}

export interface CoreRepository {
  saveEntity: <T>(
    entityType: EntityType | string,
    entityId: string,
    entity: T,
  ) => Effect.Effect<void>;
  deleteEntity: (
    entityType: EntityType | string,
    entityId: string,
  ) => Effect.Effect<void>;
  getEntity: <T>(
    entityType: EntityType | string,
    entityId: string,
  ) => Effect.Effect<T | undefined>;
  listEntities: <T>(
    entityType: EntityType | string,
  ) => Effect.Effect<ReadonlyArray<T>>;
  listJobRunHistory?: (
    query: JobRunHistoryQuery,
  ) => Effect.Effect<ReadonlyArray<unknown>>;
  listJobs?: (query: ListJobsQuery) => Effect.Effect<ReadonlyArray<unknown>>;
  listActivityFeed?: (
    query: ActivityFeedQuery,
  ) => Effect.Effect<ReadonlyArray<unknown>>;
  appendAuditTransition: (transition: AuditTransition) => Effect.Effect<void>;
  listAuditTrail: (
    filter?: AuditTrailFilter,
  ) => Effect.Effect<ReadonlyArray<AuditTransition>>;
  withTransaction: <A, E>(
    effect: Effect.Effect<A, E>,
  ) => Effect.Effect<A, E>;
  persistSnapshot?: (path: string) => Effect.Effect<void, Error>;
  loadSnapshot?: (path: string) => Effect.Effect<void, Error>;
  close?: () => Effect.Effect<void, Error>;
}
