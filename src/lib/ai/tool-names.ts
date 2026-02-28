/**
 * Canonical list of agent tool names.
 * Single source of truth used by skill forms, steps editors, and agent tools.
 */
export const ALL_TOOLS = [
  "bash",
  "readFile",
  "writeFile",
  "listDirectory",
  "grep",
] as const;

/**
 * High-privilege Kubernetes tools; must be explicitly opted into.
 */
export const K8S_TOOLS = [
  "kubectl",
  "submitK8sJob",
] as const;

export type ToolName =
  | (typeof ALL_TOOLS)[number]
  | (typeof K8S_TOOLS)[number];
