import { z } from "zod";

export const PlanOutput = z.object({
  targetSliceId: z.string(),
  objective: z.string(),
  acceptanceCriteria: z.array(z.string()).min(1),
  implementationPlan: z.array(z.string()).min(1),
  testMatrix: z.array(z.string()).min(1),
  workChunkPlan: z.array(z.string()).min(1),
  requiredValidationCommands: z.array(z.string()).min(1),
  checkpointPolicy: z.string(),
  requiredSkills: z.array(z.string()).min(1),
  skillSelectionRationale: z.string(),
  uiBlockedUntilCorePasses: z.boolean(),
});

export type PlanOutput = z.infer<typeof PlanOutput>;
