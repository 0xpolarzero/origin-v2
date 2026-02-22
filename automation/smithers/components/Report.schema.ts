import { z } from "zod";

export const ReportOutput = z.object({
  status: z.enum(["completed", "needs-human"]),
  runSummary: z.string(),
  skillsApplied: z.array(z.string()),
  skillGaps: z.array(z.string()),
  checkpointSummary: z.array(z.string()),
  validationSummary: z.array(z.string()),
  readyForNextChunk: z.boolean(),
  deliveredCoreFeatures: z.array(z.string()),
  remainingRisks: z.array(z.string()),
  nextActions: z.array(z.string()),
});

export type ReportOutput = z.infer<typeof ReportOutput>;
