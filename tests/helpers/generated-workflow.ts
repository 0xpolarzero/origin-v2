import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";

import {
  normalizeAgentSafetyPolicy,
  normalizeCommitPolicy,
  type AgentSafetyPolicy,
} from "super-ralph/components";

const generatedWorkflowPath = resolve(
  process.cwd(),
  ".super-ralph/generated/workflow.tsx",
);

export function readGeneratedWorkflowSource(): string {
  return readFileSync(generatedWorkflowPath, "utf8");
}

function extractNamedFunctionSource(source: string, name: string): string {
  const sourceFile = ts.createSourceFile(
    "generated-workflow.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );

  if (!declaration) {
    throw new Error(`Missing function declaration: ${name}`);
  }

  const start = declaration.getStart(sourceFile);
  return source.slice(start, declaration.end);
}

function transpileToCommonJs(source: string): string {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
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
  const typedResolver = extractNamedFunctionSource(
    source,
    "resolveAgentSafetyPolicy",
  );
  const runnableResolver = toRunnableResolver(typedResolver);
  const compiledResolver = transpileToCommonJs(runnableResolver);

  const resolvePolicy = new Function(
    "normalizeAgentSafetyPolicy",
    `${compiledResolver}
	return resolveAgentSafetyPolicy;`,
  )(normalizeAgentSafetyPolicy) as unknown;

  if (typeof resolvePolicy !== "function") {
    throw new Error("resolveAgentSafetyPolicy evaluation did not return a function");
  }

  return resolvePolicy as (input: unknown) => AgentSafetyPolicy;
}

function extractConstJson<T = unknown>(source: string, constName: string): T {
  const marker = `const ${constName} =`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Missing const declaration: ${constName}`);
  }

  const valueStart = source.indexOf("=", markerIndex) + 1;
  let semicolonIndex = source.indexOf(";", valueStart);
  while (semicolonIndex >= 0) {
    const candidate = source.slice(valueStart, semicolonIndex).trim();
    try {
      return JSON.parse(candidate) as T;
    } catch {
      semicolonIndex = source.indexOf(";", semicolonIndex + 1);
    }
  }

  throw new Error(`Could not parse const value as JSON: ${constName}`);
}

export type RuntimeConfigHelpers = {
  mergeCommandMap: (
    fallback: Record<string, string>,
    candidate: unknown,
  ) => Record<string, string>;
  resolveRuntimeConfig: (ctx: {
    outputMaybe: (schema: string, outputKey: unknown) => unknown;
  }) => {
    buildCmds: Record<string, string>;
    testCmds: Record<string, string>;
    commitPolicy: {
      allowedTypes: string[];
      requireAtomicChecks: boolean;
    };
    preLandChecks: string[];
    postLandChecks: string[];
  };
  fallbackConfig: {
    buildCmds: Record<string, string>;
    testCmds: Record<string, string>;
    commitPolicy: {
      allowedTypes: string[];
      requireAtomicChecks: boolean;
    };
    preLandChecks: string[];
    postLandChecks: string[];
  };
};

export function loadRuntimeConfigHelpers(
  source: string = readGeneratedWorkflowSource(),
): RuntimeConfigHelpers {
  const mergeSource = extractNamedFunctionSource(source, "mergeCommandMap");
  const commitPolicySource = extractNamedFunctionSource(
    source,
    "resolveCommitPolicy",
  );
  const resolveSource = extractNamedFunctionSource(source, "resolveRuntimeConfig");
  const fallbackConfig = extractConstJson<RuntimeConfigHelpers["fallbackConfig"]>(
    source,
    "FALLBACK_CONFIG",
  );

  const executableSource = transpileToCommonJs(
    `
${mergeSource}

${commitPolicySource}

${resolveSource}

module.exports = { mergeCommandMap, resolveRuntimeConfig };
`,
  );

  const module = { exports: {} as Record<string, unknown> };
  const outputs = { interpret_config: "interpret-config" };
  new Function(
    "module",
    "exports",
    "FALLBACK_CONFIG",
    "outputs",
    "normalizeCommitPolicy",
    executableSource,
  )(module, module.exports, fallbackConfig, outputs, normalizeCommitPolicy);

  const mergeCommandMap = module.exports.mergeCommandMap;
  const resolveRuntimeConfig = module.exports.resolveRuntimeConfig;
  if (
    typeof mergeCommandMap !== "function" ||
    typeof resolveRuntimeConfig !== "function"
  ) {
    throw new Error("Failed to load generated runtime config helpers");
  }

  return {
    mergeCommandMap:
      mergeCommandMap as RuntimeConfigHelpers["mergeCommandMap"],
    resolveRuntimeConfig:
      resolveRuntimeConfig as RuntimeConfigHelpers["resolveRuntimeConfig"],
    fallbackConfig,
  };
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
