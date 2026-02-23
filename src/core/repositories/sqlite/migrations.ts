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
];
