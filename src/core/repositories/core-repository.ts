import { Effect } from "effect";

import { AuditTransition } from "../domain/audit-transition";
import { EntityType } from "../domain/common";

export interface AuditTrailFilter {
  entityType?: EntityType | string;
  entityId?: string;
}

export interface CoreRepository {
  saveEntity: <T>(
    entityType: EntityType | string,
    entityId: string,
    entity: T,
  ) => Effect.Effect<void>;
  getEntity: <T>(
    entityType: EntityType | string,
    entityId: string,
  ) => Effect.Effect<T | undefined>;
  listEntities: <T>(
    entityType: EntityType | string,
  ) => Effect.Effect<ReadonlyArray<T>>;
  appendAuditTransition: (transition: AuditTransition) => Effect.Effect<void>;
  listAuditTrail: (
    filter?: AuditTrailFilter,
  ) => Effect.Effect<ReadonlyArray<AuditTransition>>;
  persistSnapshot?: (path: string) => Effect.Effect<void, Error>;
  loadSnapshot?: (path: string) => Effect.Effect<void, Error>;
}
