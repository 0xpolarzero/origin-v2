import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  normalizeAgentSafetyPolicy,
  type AgentSafetyPolicy,
} from "super-ralph/components";

const generatedWorkflowPath = resolve(
  process.cwd(),
  ".super-ralph/generated/workflow.tsx",
);

const resolverFunctionSignature = "function resolveAgentSafetyPolicy(";

export function readGeneratedWorkflowSource(): string {
  return readFileSync(generatedWorkflowPath, "utf8");
}

function extractFunctionSource(source: string, signature: string): string {
  const signatureIndex = source.indexOf(signature);
  if (signatureIndex < 0) {
    throw new Error(`Missing function signature: ${signature}`);
  }

  const bodyStart = source.indexOf("{", signatureIndex);
  if (bodyStart < 0) {
    throw new Error(`Missing function body for: ${signature}`);
  }

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(signatureIndex, index + 1);
      }
    }
  }

  throw new Error(`Unterminated function body for: ${signature}`);
}

function toRunnableResolver(functionSource: string): string {
  const typedSignaturePattern =
    /function\s+resolveAgentSafetyPolicy\s*\(\s*input\s*:\s*unknown\s*\)\s*:\s*AgentSafetyPolicy/;
  const runnable = functionSource.replace(
    typedSignaturePattern,
    "function resolveAgentSafetyPolicy(input)",
  );

  if (runnable === functionSource) {
    throw new Error(
      "Could not convert resolveAgentSafetyPolicy signature to runnable JavaScript",
    );
  }

  return runnable;
}

export function loadResolveAgentSafetyPolicy(
  source: string = readGeneratedWorkflowSource(),
): (input: unknown) => AgentSafetyPolicy {
  const typedResolver = extractFunctionSource(source, resolverFunctionSignature);
  const runnableResolver = toRunnableResolver(typedResolver);

  const resolvePolicy = new Function(
    "normalizeAgentSafetyPolicy",
    `${runnableResolver}
return resolveAgentSafetyPolicy;`,
  )(normalizeAgentSafetyPolicy) as unknown;

  if (typeof resolvePolicy !== "function") {
    throw new Error("resolveAgentSafetyPolicy evaluation did not return a function");
  }

  return resolvePolicy as (input: unknown) => AgentSafetyPolicy;
}

export function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => void,
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
