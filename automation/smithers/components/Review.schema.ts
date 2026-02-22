import { z } from "zod";

export const ReviewIssue = z.object({
  severity: z.enum(["low", "medium", "high", "critical"]),
  file: z.string(),
  line: z.number().nullable(),
  description: z.string(),
  requiredFix: z.string(),
});

export const ReviewOutput = z.object({
  approved: z.boolean(),
  score: z.number().int().min(0).max(100),
  feedback: z.string(),
  issues: z.array(ReviewIssue),
});

export type ReviewOutput = z.infer<typeof ReviewOutput>;
