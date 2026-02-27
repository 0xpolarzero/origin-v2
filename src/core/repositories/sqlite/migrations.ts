import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface SqliteMigration {
  id: string;
  name: string;
  sql: string;
  checksum: string;
}

const checksumFor = (sql: string): string =>
  createHash("sha256").update(sql).digest("hex");

const readMigrationSql = (relativePath: string): string =>
  readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url).toString()),
    "utf8",
  );

const defineMigration = (
  id: string,
  name: string,
  relativePath: string,
): SqliteMigration => {
  const sql = readMigrationSql(relativePath);
  return {
    id,
    name,
    sql,
    checksum: checksumFor(sql),
  };
};

export const CORE_DB_MIGRATIONS: ReadonlyArray<SqliteMigration> = [
  defineMigration(
    "001_core_schema",
    "Create baseline tables for core entities and audit storage",
    "../../database/migrations/001_core_schema.sql",
  ),
  defineMigration(
    "002_core_constraints_indexes",
    "Enforce lifecycle constraints and add core lookup indexes",
    "../../database/migrations/002_core_constraints_indexes.sql",
  ),
  defineMigration(
    "003_relation_integrity",
    "Enforce relation integrity and add relation-focused indexes",
    "../../database/migrations/003_relation_integrity.sql",
  ),
  defineMigration(
    "004_audit_entity_versions",
    "Track per-entity audit versions with backfill and monotonic updates",
    "../../database/migrations/004_audit_entity_versions.sql",
  ),
  defineMigration(
    "005_job_run_history",
    "Add explicit job run history table, constraints, indexes, and backfill",
    "../../database/migrations/005_job_run_history.sql",
  ),
  defineMigration(
    "006_checkpoint_audit_cursor_integer",
    "Enforce integer-only checkpoint audit_cursor writes",
    "../../database/migrations/006_checkpoint_audit_cursor_integer.sql",
  ),
];
