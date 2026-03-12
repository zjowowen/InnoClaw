import { tool } from "ai";
import { z } from "zod";
import { execInWorkspace } from "@/lib/utils/shell";
import { TRUNCATE, BUFFER } from "@/lib/constants";
import type { ToolContext } from "./types";

export function createShellTools(ctx: ToolContext) {
  return {
    bash: tool({
      description:
        "Execute a shell command in the workspace directory. Use for running builds, tests, git operations, package management, etc. For long-running scientific computations, you can set a longer timeout (default: 30s, max: 300s).",
      inputSchema: z.object({
        command: z.string().describe("The shell command to execute"),
        timeout: z
          .number()
          .optional()
          .describe(
            "Timeout in seconds for the command (default: 30, max: 300). Use a higher value for long-running computations like ADMET prediction, molecular docking, etc."
          ),
      }),
      execute: async ({ command, timeout }) => {
        const timeoutMs = Math.max(1000, Math.min((timeout ?? 30) * 1000, 300_000));
        return execInWorkspace(command, ctx.validatedCwd, { timeout: timeoutMs });
      },
    }),

    grep: tool({
      description:
        "Search for a regex pattern in files. Returns matching lines with file paths and line numbers.",
      inputSchema: z.object({
        pattern: z.string().describe("Regex pattern to search for"),
        path: z
          .string()
          .optional()
          .describe(
            "Directory or file to search in (defaults to workspace root)"
          ),
        include: z
          .string()
          .optional()
          .describe("File glob pattern to include, e.g. '*.ts'"),
      }),
      execute: async ({ pattern, path: searchPath, include }) => {
        const target = searchPath ? ctx.resolvePath(searchPath) : ctx.validatedCwd;

        let cmd = `grep -rn --max-count=50`;
        if (include) cmd += ` --include='${include.replace(/'/g, "'\\''")}'`;
        cmd += ` -- '${pattern.replace(/'/g, "'\\''")}' '${target.replace(/'/g, "'\\''")}'`;

        const result = await execInWorkspace(cmd, ctx.validatedCwd, {
          timeout: 15_000,
          maxBuffer: BUFFER.SMALL,
        });
        return {
          matches: result.stdout.slice(0, TRUNCATE.STDOUT_LARGE) || result.stderr.slice(0, TRUNCATE.STDERR),
          exitCode: result.exitCode,
        };
      },
    }),
  };
}
