import { z } from "zod";

export const DiscoverSlice = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  coreModules: z.array(z.string()),
  requiredTests: z.array(z.string()),
});

export const DiscoverOutput = z.object({
  productSummary: z.string(),
  assumptions: z.array(z.string()),
  prioritizedSlices: z.array(DiscoverSlice).min(1),
  suggestedFirstSliceId: z.string(),
});

export type DiscoverOutput = z.infer<typeof DiscoverOutput>;
