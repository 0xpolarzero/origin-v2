import { z } from "zod";

export const ReviewFixOutput = z.object({
  changesRequired: z.boolean(),
  fixPlan: z.array(z.string()),
  riskNotes: z.array(z.string()),
});

export type ReviewFixOutput = z.infer<typeof ReviewFixOutput>;
