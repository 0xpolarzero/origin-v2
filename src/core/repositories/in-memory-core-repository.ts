import { Effect } from "effect";

import { AuditTransition } from "../domain/audit-transition";
import { EntityType } from "../domain/common";
import { AuditTrailFilter, CoreRepository } from "./core-repository";

const clone = <T>(value: T): T => structuredClone(value);

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
  };
};
