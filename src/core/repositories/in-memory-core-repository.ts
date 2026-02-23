import { Effect } from "effect";

import { AuditTransition } from "../domain/audit-transition";
import { EntityType } from "../domain/common";
import {
  AuditTrailFilter,
  CoreRepository,
  JobRunHistoryQuery,
} from "./core-repository";

const clone = <T>(value: T): T => structuredClone(value);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const makeInMemoryCoreRepository = (): CoreRepository => {
  const entities = new Map<string, Map<string, unknown>>();
  const auditTrail: Array<AuditTransition> = [];

  const getBucket = (entityType: EntityType | string): Map<string, unknown> => {
    const key = entityType.toString();
    let bucket = entities.get(key);
    if (!bucket) {
      bucket = new Map();
      entities.set(key, bucket);
    }
    return bucket;
  };

  return {
    saveEntity: (entityType, entityId, entity) =>
      Effect.sync(() => {
        getBucket(entityType).set(entityId, clone(entity));
      }),
    deleteEntity: (entityType, entityId) =>
      Effect.sync(() => {
        getBucket(entityType).delete(entityId);
      }),
    getEntity: <T>(entityType: EntityType | string, entityId: string) =>
      Effect.sync(() => {
        const value = getBucket(entityType).get(entityId);
        if (value === undefined) {
          return undefined;
        }

        return clone(value as T);
      }),
    listEntities: <T>(entityType: EntityType | string) =>
      Effect.sync(() => {
        const values = Array.from(getBucket(entityType).values());
        return values.map((value) => clone(value as T));
      }),
    listJobRunHistory: (query: JobRunHistoryQuery) =>
      Effect.sync(() => {
        const beforeAtIso = query.beforeAt?.toISOString();
        const rows = Array.from(getBucket("job_run_history").values())
          .map((value) => clone(value))
          .filter(isRecord)
          .filter((row) => row.jobId === query.jobId)
          .filter(
            (row) =>
              beforeAtIso === undefined ||
              (typeof row.at === "string" && row.at < beforeAtIso),
          )
          .sort((left, right) => {
            const leftAt = typeof left.at === "string" ? left.at : "";
            const rightAt = typeof right.at === "string" ? right.at : "";
            const leftCreatedAt =
              typeof left.createdAt === "string" ? left.createdAt : "";
            const rightCreatedAt =
              typeof right.createdAt === "string" ? right.createdAt : "";
            const leftId = typeof left.id === "string" ? left.id : "";
            const rightId = typeof right.id === "string" ? right.id : "";

            return (
              rightAt.localeCompare(leftAt) ||
              rightCreatedAt.localeCompare(leftCreatedAt) ||
              rightId.localeCompare(leftId)
            );
          });

        if (query.limit === undefined) {
          return rows;
        }

        return rows.slice(0, query.limit);
      }),
    appendAuditTransition: (transition) =>
      Effect.sync(() => {
        auditTrail.push(clone(transition));
      }),
    listAuditTrail: (filter?: AuditTrailFilter) =>
      Effect.sync(() => {
        const filtered = auditTrail.filter((transition) => {
          if (
            filter?.entityType &&
            transition.entityType !== filter.entityType
          ) {
            return false;
          }

          if (filter?.entityId && transition.entityId !== filter.entityId) {
            return false;
          }

          return true;
        });

        return filtered.map((transition) => clone(transition));
      }),
    withTransaction: (effect) => effect,
  };
};
