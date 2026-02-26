export type DependencySection = "dependencies" | "devDependencies";

export type PackageJsonLike = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type MandatedStackItem =
  | "electron"
  | "typescript"
  | "vite"
  | "react"
  | "shadcn"
  | "effect"
  | "pi-mono";

export type MandatedDependencySpec = {
  stackItem: MandatedStackItem;
  packageName: string;
  expectedSection: DependencySection;
  expectedVersion: string;
};

export type MandatedVersionSnapshot = {
  electron: string;
  typescript: string;
  vite: string;
  react: string;
  reactDom: string;
  shadcn: string;
  effect: string;
  piAi: string;
};

export type ManifestDependencyViolation = {
  packageName: string;
  issue: "missing" | "wrong-section" | "not-pinned" | "version-mismatch";
  expectedSection: DependencySection;
  expectedVersion: string;
  actualSection?: DependencySection;
  actualVersion?: string;
};

export const MANDATED_VERSION_SNAPSHOT: MandatedVersionSnapshot = {
  electron: "40.6.0",
  typescript: "5.9.3",
  vite: "7.3.1",
  react: "19.2.4",
  reactDom: "19.2.4",
  shadcn: "3.8.5",
  effect: "3.19.19",
  piAi: "0.54.2",
};

const EXACT_VERSION_PATTERN =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?(?:\+[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)*)?$/;

const flipSection = (section: DependencySection): DependencySection =>
  section === "dependencies" ? "devDependencies" : "dependencies";

export const isExactVersionPin = (version: string): boolean =>
  EXACT_VERSION_PATTERN.test(version);

export const buildMandatedDependencySpecs = (
  versions: MandatedVersionSnapshot,
): readonly MandatedDependencySpec[] => [
  {
    stackItem: "electron",
    packageName: "electron",
    expectedSection: "devDependencies",
    expectedVersion: versions.electron,
  },
  {
    stackItem: "typescript",
    packageName: "typescript",
    expectedSection: "devDependencies",
    expectedVersion: versions.typescript,
  },
  {
    stackItem: "vite",
    packageName: "vite",
    expectedSection: "devDependencies",
    expectedVersion: versions.vite,
  },
  {
    stackItem: "react",
    packageName: "react",
    expectedSection: "dependencies",
    expectedVersion: versions.react,
  },
  {
    stackItem: "react",
    packageName: "react-dom",
    expectedSection: "dependencies",
    expectedVersion: versions.reactDom,
  },
  {
    stackItem: "shadcn",
    packageName: "shadcn",
    expectedSection: "devDependencies",
    expectedVersion: versions.shadcn,
  },
  {
    stackItem: "effect",
    packageName: "effect",
    expectedSection: "dependencies",
    expectedVersion: versions.effect,
  },
  {
    // pi-mono is published as scoped packages; pi-ai is the mandated integration package here.
    stackItem: "pi-mono",
    packageName: "@mariozechner/pi-ai",
    expectedSection: "dependencies",
    expectedVersion: versions.piAi,
  },
];

export const findManifestDependencyViolations = (
  manifest: PackageJsonLike,
  specs: readonly MandatedDependencySpec[],
): ManifestDependencyViolation[] => {
  const violations: ManifestDependencyViolation[] = [];

  for (const spec of specs) {
    const actualSection = flipSection(spec.expectedSection);
    const inExpectedSection =
      manifest[spec.expectedSection]?.[spec.packageName] ?? null;
    const inOtherSection = manifest[actualSection]?.[spec.packageName] ?? null;

    if (inExpectedSection === null) {
      if (inOtherSection === null) {
        violations.push({
          packageName: spec.packageName,
          issue: "missing",
          expectedSection: spec.expectedSection,
          expectedVersion: spec.expectedVersion,
        });
      } else {
        violations.push({
          packageName: spec.packageName,
          issue: "wrong-section",
          expectedSection: spec.expectedSection,
          expectedVersion: spec.expectedVersion,
          actualSection,
          actualVersion: inOtherSection,
        });
      }
      continue;
    }

    if (inOtherSection !== null) {
      violations.push({
        packageName: spec.packageName,
        issue: "wrong-section",
        expectedSection: spec.expectedSection,
        expectedVersion: spec.expectedVersion,
        actualSection,
        actualVersion: inOtherSection,
      });
    }

    if (!isExactVersionPin(inExpectedSection)) {
      violations.push({
        packageName: spec.packageName,
        issue: "not-pinned",
        expectedSection: spec.expectedSection,
        expectedVersion: spec.expectedVersion,
        actualSection: spec.expectedSection,
        actualVersion: inExpectedSection,
      });
      continue;
    }

    if (inExpectedSection !== spec.expectedVersion) {
      violations.push({
        packageName: spec.packageName,
        issue: "version-mismatch",
        expectedSection: spec.expectedSection,
        expectedVersion: spec.expectedVersion,
        actualSection: spec.expectedSection,
        actualVersion: inExpectedSection,
      });
    }
  }

  return violations;
};
