import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createSmithers } from "smithers-orchestrator";
import { DiscoverOutput } from "./components/Discover.schema";
import { PlanOutput } from "./components/Plan.schema";
import { CoreImplementOutput } from "./components/CoreImplement.schema";
import { CoreValidateOutput } from "./components/CoreValidate.schema";
import { ReviewOutput } from "./components/Review.schema";
import { ReviewFixOutput } from "./components/ReviewFix.schema";
import { ReportOutput } from "./components/Report.schema";

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(HERE, ".state", "origin-v2-smithers.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

export const { Workflow, Task, useCtx, smithers, tables, outputs } = createSmithers(
  {
    discover: DiscoverOutput,
    plan: PlanOutput,
    coreImplement: CoreImplementOutput,
    coreValidate: CoreValidateOutput,
    review: ReviewOutput,
    reviewFix: ReviewFixOutput,
    report: ReportOutput,
  },
  {
    dbPath: DB_PATH,
    journalMode: "DELETE",
  },
);
