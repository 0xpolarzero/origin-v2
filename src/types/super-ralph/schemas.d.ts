export type RalphSchema<T = unknown> = {
  parse: (input: unknown) => T;
};

export type RalphOutputSchemas = Record<string, RalphSchema> & {
  discover: RalphSchema;
  land: RalphSchema;
};

export const ralphOutputSchemas: RalphOutputSchemas;
