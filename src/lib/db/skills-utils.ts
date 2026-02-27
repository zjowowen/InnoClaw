/**
 * Shared utilities for parsing skill database rows.
 */

export function parseSkillRow(row: Record<string, unknown>) {
  return {
    ...row,
    steps: typeof row.steps === "string" ? JSON.parse(row.steps) : null,
    allowedTools:
      typeof row.allowedTools === "string"
        ? JSON.parse(row.allowedTools)
        : null,
    parameters:
      typeof row.parameters === "string"
        ? JSON.parse(row.parameters)
        : null,
  };
}
