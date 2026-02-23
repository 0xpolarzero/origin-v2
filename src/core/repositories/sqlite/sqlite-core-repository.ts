import { Database, type SQLQueryBindings } from "bun:sqlite";
import { Data, Effect, Exit, FiberId } from "effect";

import { AuditTransition } from "../../domain/audit-transition";
import { EntityType } from "../../domain/common";
import {
  AuditTrailFilter,
  CoreRepository,
  JobRunHistoryQuery,
} from "../core-repository";
import { runSqliteMigrations } from "./migration-runner";
import { CORE_DB_MIGRATIONS, SqliteMigration } from "./migrations";

export class SqliteCoreRepositoryError extends Data.TaggedError(
  "SqliteCoreRepositoryError",
)<{
  message: string;
}> {}

export interface SqliteCoreRepositoryOptions {
  databasePath: string;
  runMigrationsOnInit?: boolean;
  migrations?: ReadonlyArray<SqliteMigration>;
  openDatabase?: (databasePath: string) => Database;
}

interface TableConfig {
  tableName: string;
  columns: ReadonlyArray<string>;
  jsonColumns?: ReadonlySet<string>;
}

interface AuditRow {
  id: string;
  entity_type: string;
  entity_id: string;
  from_state: string;
  to_state: string;
  actor_id: string;
  actor_kind: "user" | "system" | "ai";
  reason: string;
  at: string;
  metadata: string | null;
}

type SqliteValue = SQLQueryBindings;
const LIST_ENTITIES_PAGE_SIZE = 500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toErrorMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const toSnakeCase = (value: string): string =>
  value.replace(/[A-Z]/g, (character) => `_${character.toLowerCase()}`);

const toCamelCase = (value: string): string =>
  value.replace(/_([a-z])/g, (_match, character: string) =>
    character.toUpperCase(),
  );

const TABLE_CONFIGS: Record<string, TableConfig> = {
  entry: {
    tableName: "entry",
    columns: [
      "id",
      "content",
      "source",
      "status",
      "captured_at",
      "created_at",
      "updated_at",
      "suggested_task_title",
      "suggestion_updated_at",
      "rejection_reason",
      "accepted_task_id",
    ],
  },
  task: {
    tableName: "task",
    columns: [
      "id",
      "title",
      "description",
      "status",
      "scheduled_for",
      "due_at",
      "project_id",
      "source_entry_id",
      "completed_at",
      "deferred_until",
      "created_at",
      "updated_at",
    ],
  },
  event: {
    tableName: "event",
    columns: [
      "id",
      "title",
      "start_at",
      "end_at",
      "sync_state",
      "created_at",
      "updated_at",
    ],
  },
  project: {
    tableName: "project",
    columns: [
      "id",
      "name",
      "description",
      "lifecycle",
      "created_at",
      "updated_at",
    ],
  },
  note: {
    tableName: "note",
    columns: ["id", "body", "linked_entity_refs", "created_at", "updated_at"],
    jsonColumns: new Set(["linked_entity_refs"]),
  },
  signal: {
    tableName: "signal",
    columns: [
      "id",
      "source",
      "payload",
      "triage_state",
      "triage_decision",
      "converted_entity_type",
      "converted_entity_id",
      "created_at",
      "updated_at",
    ],
  },
  job: {
    tableName: "job",
    columns: [
      "id",
      "name",
      "run_state",
      "retry_count",
      "last_run_at",
      "last_success_at",
      "last_failure_at",
      "last_failure_reason",
      "diagnostics",
      "created_at",
      "updated_at",
    ],
  },
  job_run_history: {
    tableName: "job_run_history",
    columns: [
      "id",
      "job_id",
      "outcome",
      "diagnostics",
      "retry_count",
      "actor_id",
      "actor_kind",
      "at",
      "created_at",
    ],
  },
  notification: {
    tableName: "notification",
    columns: [
      "id",
      "type",
      "message",
      "status",
      "related_entity_type",
      "related_entity_id",
      "created_at",
      "updated_at",
    ],
  },
  view: {
    tableName: '"view"',
    columns: ["id", "name", "query", "filters", "created_at", "updated_at"],
    jsonColumns: new Set(["filters"]),
  },
  memory: {
    tableName: "memory",
    columns: [
      "id",
      "key",
      "value",
      "source",
      "confidence",
      "created_at",
      "updated_at",
    ],
  },
  checkpoint: {
    tableName: "checkpoint",
    columns: [
      "id",
      "name",
      "snapshot_entity_refs",
      "snapshot_entities",
      "audit_cursor",
      "rollback_target",
      "status",
      "created_at",
      "updated_at",
      "recovered_at",
    ],
    jsonColumns: new Set(["snapshot_entity_refs", "snapshot_entities"]),
  },
  outbound_draft: {
    tableName: "outbound_draft",
    columns: [
      "id",
      "payload",
      "source_signal_id",
      "status",
      "execution_id",
      "created_at",
      "updated_at",
    ],
  },
  memory_key_index: {
    tableName: "memory_key_index",
    columns: ["id", "key", "memory_id", "updated_at"],
  },
};

const resolveTableConfig = (
  entityType: EntityType | string,
): Effect.Effect<TableConfig, SqliteCoreRepositoryError> => {
  const config = TABLE_CONFIGS[entityType];
  if (!config) {
    return Effect.fail(
      new SqliteCoreRepositoryError({
        message: `unsupported entity type: ${entityType}`,
      }),
    );
  }
  return Effect.succeed(config);
};

const parseJson = (
  raw: string,
  column: string,
): Effect.Effect<unknown, SqliteCoreRepositoryError> =>
  Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) =>
      new SqliteCoreRepositoryError({
        message: `failed to parse JSON for column ${column}: ${toErrorMessage(cause)}`,
      }),
  });

const normalizeSqliteValue = (value: unknown): SqliteValue => {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return value as NodeJS.TypedArray;
  }

  return JSON.stringify(value);
};

const encodeEntity = (
  entity: unknown,
  entityId: string,
  config: TableConfig,
): Effect.Effect<Array<SqliteValue>, SqliteCoreRepositoryError> =>
  Effect.gen(function* () {
    if (!isRecord(entity)) {
      return yield* Effect.fail(
        new SqliteCoreRepositoryError({
          message: "entity payload must be an object",
        }),
      );
    }

    const bySnakeCase = new Map<string, unknown>();
    for (const [key, value] of Object.entries(entity)) {
      bySnakeCase.set(toSnakeCase(key), value);
    }

    const values: Array<SqliteValue> = [];
    for (const column of config.columns) {
      if (column === "id") {
        values.push(entityId);
        continue;
      }

      const rawValue = bySnakeCase.get(column);
      if (config.jsonColumns?.has(column)) {
        values.push(rawValue === undefined ? null : JSON.stringify(rawValue));
      } else {
        values.push(normalizeSqliteValue(rawValue));
      }
    }

    return values;
  });

const decodeEntity = <T>(
  row: Record<string, unknown>,
  config: TableConfig,
): Effect.Effect<T, SqliteCoreRepositoryError> =>
  Effect.gen(function* () {
    const decoded: Record<string, unknown> = {};

    for (const column of config.columns) {
      const camelKey = toCamelCase(column);
      const rawValue = row[column];

      if (rawValue === null || rawValue === undefined) {
        decoded[camelKey] = undefined;
        continue;
      }

      if (config.jsonColumns?.has(column)) {
        if (typeof rawValue !== "string") {
          return yield* Effect.fail(
            new SqliteCoreRepositoryError({
              message: `expected JSON text for column ${column}`,
            }),
          );
        }
        decoded[camelKey] = yield* parseJson(rawValue, column);
        continue;
      }

      decoded[camelKey] = rawValue;
    }

    return decoded as T;
  });

const toRepositoryError = (
  message: string,
  cause: unknown,
): SqliteCoreRepositoryError =>
  new SqliteCoreRepositoryError({
    message: `${message}: ${toErrorMessage(cause)}`,
  });

export const makeSqliteCoreRepository = (
  options: SqliteCoreRepositoryOptions,
): Effect.Effect<
  CoreRepository & {
    close: () => Effect.Effect<void, SqliteCoreRepositoryError>;
  },
  SqliteCoreRepositoryError
> =>
  Effect.gen(function* () {
    const openDatabase =
      options.openDatabase ??
      ((databasePath: string): Database => new Database(databasePath));

    const db = yield* Effect.try({
      try: () => openDatabase(options.databasePath),
      catch: (cause) =>
        new SqliteCoreRepositoryError({
          message: `failed to open sqlite database: ${toErrorMessage(cause)}`,
        }),
    });

    const failAfterInitClose = (
      initError: SqliteCoreRepositoryError,
    ): Effect.Effect<never, SqliteCoreRepositoryError> =>
      Effect.try({
        try: () => {
          db.close();
        },
        catch: (closeCause) =>
          new SqliteCoreRepositoryError({
            message: `${initError.message}; failed to close sqlite database after initialization failure: ${toErrorMessage(closeCause)}`,
          }),
      }).pipe(Effect.flatMap(() => Effect.fail(initError)));

    const shouldRunMigrations = options.runMigrationsOnInit ?? true;
    const migrations = options.migrations ?? CORE_DB_MIGRATIONS;

    if (shouldRunMigrations) {
      yield* runSqliteMigrations(db, migrations).pipe(
        Effect.mapError(
          (error) =>
            new SqliteCoreRepositoryError({
              message: `failed to run sqlite migrations: ${error.message}`,
            }),
        ),
        Effect.catchAll(failAfterInitClose),
      );
    }

    const saveEntity = (
      entityType: EntityType | string,
      entityId: string,
      entity: unknown,
    ): Effect.Effect<void, SqliteCoreRepositoryError> =>
      Effect.gen(function* () {
        const config = yield* resolveTableConfig(entityType);
        const values = yield* encodeEntity(entity, entityId, config);
        const insertColumns = config.columns.join(", ");
        const placeholders = config.columns.map(() => "?").join(", ");
        const updateColumns = config.columns
          .filter((column) => column !== "id")
          .map((column) => `${column} = excluded.${column}`)
          .join(", ");

        yield* Effect.try({
          try: () => {
            const params = values as [SqliteValue, ...Array<SqliteValue>];
            db.query(
              `
                INSERT INTO ${config.tableName} (${insertColumns})
                VALUES (${placeholders})
                ON CONFLICT(id) DO UPDATE SET ${updateColumns}
              `,
            ).run(...params);
          },
          catch: (cause) =>
            toRepositoryError(
              `failed to persist ${entityType}:${entityId}`,
              cause,
            ),
        });
      });

    const getEntity = <T>(
      entityType: EntityType | string,
      entityId: string,
    ): Effect.Effect<T | undefined, SqliteCoreRepositoryError> =>
      Effect.gen(function* () {
        const config = yield* resolveTableConfig(entityType);
        const row = yield* Effect.try({
          try: () =>
            db
              .query(`SELECT * FROM ${config.tableName} WHERE id = ?`)
              .get(entityId) as Record<string, unknown> | null,
          catch: (cause) =>
            toRepositoryError(
              `failed to load ${entityType}:${entityId}`,
              cause,
            ),
        });

        if (!row) {
          return undefined;
        }

        return yield* decodeEntity<T>(row, config);
      });

    const listEntities = <T>(
      entityType: EntityType | string,
    ): Effect.Effect<ReadonlyArray<T>, SqliteCoreRepositoryError> =>
      Effect.gen(function* () {
        const config = yield* resolveTableConfig(entityType);
        const entities: Array<T> = [];

        let offset = 0;
        while (true) {
          const rows = yield* Effect.try({
            try: () =>
              db
                .query(
                  `
                    SELECT ${config.columns.join(", ")}
                    FROM ${config.tableName}
                    ORDER BY id ASC
                    LIMIT ? OFFSET ?
                  `,
                )
                .all(LIST_ENTITIES_PAGE_SIZE, offset) as Array<
                Record<string, unknown>
              >,
            catch: (cause) =>
              toRepositoryError(`failed to list ${entityType} entities`, cause),
          });

          for (const row of rows) {
            entities.push(yield* decodeEntity<T>(row, config));
          }

          if (rows.length < LIST_ENTITIES_PAGE_SIZE) {
            break;
          }

          offset += rows.length;
        }

        return entities;
      });

    const listJobRunHistory = (
      query: JobRunHistoryQuery,
    ): Effect.Effect<ReadonlyArray<unknown>, SqliteCoreRepositoryError> =>
      Effect.gen(function* () {
        const historyConfig = TABLE_CONFIGS.job_run_history;
        const beforeAtIso = query.beforeAt?.toISOString();

        const sqlParts = [
          `
            SELECT ${historyConfig.columns.join(", ")}
            FROM ${historyConfig.tableName}
            WHERE job_id = ?
          `,
        ];
        const params: Array<SqliteValue> = [query.jobId];

        if (beforeAtIso !== undefined) {
          sqlParts.push("AND at < ?");
          params.push(beforeAtIso);
        }

        sqlParts.push("ORDER BY at DESC, created_at DESC, id DESC");

        if (query.limit !== undefined) {
          sqlParts.push("LIMIT ?");
          params.push(query.limit);
        }

        const rows = yield* Effect.try({
          try: () =>
            db.query(sqlParts.join("\n")).all(...params) as Array<
              Record<string, unknown>
            >,
          catch: (cause) =>
            toRepositoryError("failed to list job_run_history rows", cause),
        });

        const records: Array<unknown> = [];
        for (const row of rows) {
          records.push(yield* decodeEntity(row, historyConfig));
        }

        return records;
      });

    const deleteEntity = (
      entityType: EntityType | string,
      entityId: string,
    ): Effect.Effect<void, SqliteCoreRepositoryError> =>
      Effect.gen(function* () {
        const config = yield* resolveTableConfig(entityType);
        yield* Effect.try({
          try: () => {
            db.query(`DELETE FROM ${config.tableName} WHERE id = ?`).run(
              entityId,
            );
          },
          catch: (cause) =>
            toRepositoryError(
              `failed to delete ${entityType}:${entityId}`,
              cause,
            ),
        });
      });

    const appendAuditTransition = (
      transition: AuditTransition,
    ): Effect.Effect<void, SqliteCoreRepositoryError> =>
      Effect.try({
        try: () => {
          db.query(
            `
              INSERT INTO audit_transitions (
                id,
                entity_type,
                entity_id,
                from_state,
                to_state,
                actor_id,
                actor_kind,
                reason,
                at,
                metadata
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
          ).run(
            transition.id,
            transition.entityType,
            transition.entityId,
            transition.fromState,
            transition.toState,
            transition.actor.id,
            transition.actor.kind,
            transition.reason,
            transition.at,
            transition.metadata ? JSON.stringify(transition.metadata) : null,
          );
        },
        catch: (cause) =>
          toRepositoryError(
            `failed to append audit transition ${transition.id}`,
            cause,
          ),
      });

    const listAuditTrail = (
      filter?: AuditTrailFilter,
    ): Effect.Effect<
      ReadonlyArray<AuditTransition>,
      SqliteCoreRepositoryError
    > =>
      Effect.gen(function* () {
        const whereClauses: Array<string> = [];
        const args: Array<string> = [];

        if (filter?.entityType) {
          whereClauses.push("entity_type = ?");
          args.push(filter.entityType);
        }

        if (filter?.entityId) {
          whereClauses.push("entity_id = ?");
          args.push(filter.entityId);
        }

        const whereSql =
          whereClauses.length === 0
            ? ""
            : `WHERE ${whereClauses.join(" AND ")}`;

        const rows = yield* Effect.try({
          try: () =>
            db
              .query(
                `
                SELECT
                  id,
                  entity_type,
                  entity_id,
                  from_state,
                  to_state,
                  actor_id,
                  actor_kind,
                  reason,
                  at,
                  metadata
                FROM audit_transitions
                ${whereSql}
                ORDER BY rowid ASC
              `,
              )
              .all(...args) as Array<AuditRow>,
          catch: (cause) =>
            toRepositoryError("failed to list audit trail", cause),
        });

        const transitions: Array<AuditTransition> = [];
        for (const row of rows) {
          const metadata = row.metadata
            ? ((yield* parseJson(row.metadata, "metadata")) as Record<
                string,
                string
              >)
            : undefined;

          transitions.push({
            id: row.id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            fromState: row.from_state,
            toState: row.to_state,
            actor: {
              id: row.actor_id,
              kind: row.actor_kind,
            },
            reason: row.reason,
            at: row.at,
            metadata,
          });
        }

        return transitions;
      });

    const close = (): Effect.Effect<void, SqliteCoreRepositoryError> =>
      Effect.try({
        try: () => {
          db.close();
        },
        catch: (cause) =>
          toRepositoryError("failed to close sqlite database", cause),
      });
    const transactionMutex = yield* Effect.makeSemaphore(1);
    let transactionDepth = 0;
    let savepointCounter = 0;
    let transactionOwnerThreadName: string | undefined = undefined;

    const runTransaction = <A, E>(
      effect: Effect.Effect<A, E>,
      isNested: boolean,
    ): Effect.Effect<A, E | SqliteCoreRepositoryError> =>
      Effect.gen(function* () {
        const savepointName = isNested
          ? `origin_savepoint_${++savepointCounter}`
          : undefined;

        yield* Effect.try({
          try: () => {
            if (isNested) {
              db.exec(`SAVEPOINT ${savepointName!}`);
            } else {
              db.exec("BEGIN IMMEDIATE");
            }
            transactionDepth += 1;
          },
          catch: (cause) =>
            toRepositoryError(
              isNested
                ? "failed to start sqlite savepoint"
                : "failed to begin sqlite transaction",
              cause,
            ),
        });

        const exit = yield* Effect.exit(effect);
        transactionDepth -= 1;

        if (Exit.isSuccess(exit)) {
          return yield* Effect.try({
            try: () => {
              if (isNested) {
                db.exec(`RELEASE SAVEPOINT ${savepointName!}`);
              } else {
                db.exec("COMMIT");
              }
              return exit.value;
            },
            catch: (cause) =>
              toRepositoryError(
                isNested
                  ? "failed to release sqlite savepoint"
                  : "failed to commit sqlite transaction",
                cause,
              ),
          });
        }

        yield* Effect.try({
          try: () => {
            if (isNested) {
              db.exec(`ROLLBACK TO SAVEPOINT ${savepointName!}`);
              db.exec(`RELEASE SAVEPOINT ${savepointName!}`);
            } else {
              db.exec("ROLLBACK");
            }
          },
          catch: (cause) =>
            toRepositoryError(
              isNested
                ? "failed to rollback sqlite savepoint"
                : "failed to rollback sqlite transaction",
              cause,
            ),
        });

        return yield* Effect.failCause(exit.cause);
      });

    const withTransaction = <A, E>(
      effect: Effect.Effect<A, E>,
    ): Effect.Effect<A, E | SqliteCoreRepositoryError> =>
      Effect.fiberIdWith((fiberId) => {
        const threadName = FiberId.threadName(fiberId);
        const isNested =
          transactionDepth > 0 && transactionOwnerThreadName === threadName;

        if (isNested) {
          return runTransaction(effect, true);
        }

        return transactionMutex.withPermits(1)(
          Effect.gen(function* () {
            transactionOwnerThreadName = threadName;
            return yield* runTransaction(effect, false);
          }).pipe(
            Effect.ensuring(
              Effect.sync(() => {
                transactionOwnerThreadName = undefined;
              }),
            ),
          ),
        );
      });

    return {
      saveEntity,
      getEntity,
      listEntities,
      listJobRunHistory,
      deleteEntity,
      appendAuditTransition,
      listAuditTrail,
      withTransaction,
      close,
    } as unknown as CoreRepository & {
      close: () => Effect.Effect<void, SqliteCoreRepositoryError>;
    };
  });
