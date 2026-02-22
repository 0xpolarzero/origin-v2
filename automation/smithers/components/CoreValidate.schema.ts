import { z } from "zod";

export const ValidationResult = z.object({
  command: z.string(),
  passed: z.boolean(),
  summary: z.string(),
});

export const CoreValidateOutput = z.object({
  passed: z.boolean(),
  commands: z.array(z.string()),
  results: z.array(ValidationResult),
  failures: z.array(z.string()),
  notes: z.array(z.string()),
});

export type CoreValidateOutput = z.infer<typeof CoreValidateOutput>;
