import { z } from "zod";

export const CoreImplementOutput = z.object({
  summary: z.string(),
  skillsApplied: z.array(z.string()).min(1),
  filesChanged: z.array(z.string()),
  commandsExecuted: z.array(z.string()),
  testsAttempted: z.array(z.string()),
  coreCriteriaImplemented: z.boolean(),
  blockers: z.array(z.string()),
});

export type CoreImplementOutput = z.infer<typeof CoreImplementOutput>;
