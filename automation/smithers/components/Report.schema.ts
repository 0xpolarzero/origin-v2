import { z } from "zod";

export const ReportOutput = z.object({
  status: z.enum(["completed", "needs-human"]),
  runSummary: z.string(),
  skillsApplied: z.array(z.string()),
  skillGaps: z.array(z.string()),
  deliveredCoreFeatures: z.array(z.string()),
  remainingRisks: z.array(z.string()),
  nextActions: z.array(z.string()),
});

export type ReportOutput = z.infer<typeof ReportOutput>;
