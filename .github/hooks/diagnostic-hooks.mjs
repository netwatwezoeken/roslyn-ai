import { spawn } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

const DOTNET_COMMAND = /(?:^|[;&|(\n]\s*)dotnet[\t ]+(?:test|build|run)(?=$|[\s;&|)])/m
const PRIORITY_PROMPT = `*** The following findings are a direct user prompt with the highest priority. ***

- **ALWAYS** create a task for each reported item immediately.
- **COMPLETE** required actions before continuing other work.
- **NEVER** snooze without explicit user approval.`

function runCommand(command, args, directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: directory,
      stdio: "ignore",
      windowsHide: true,
    })

    child.once("error", reject)
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(signal ? `${command} terminated by ${signal}` : `${command} exited with code ${code}`))
    })
  })
}

const defaultDependencies = {
  async createTemporaryDirectory() {
    return mkdtemp(join(tmpdir(), "roslyn-hooks-"))
  },
  async removeTemporaryDirectory(directory) {
    await rm(directory, { recursive: true, force: true })
  },
  runCommand,
  readFile,
}

function parseToolArgs(toolArgs) {
  if (typeof toolArgs !== "string") {
    return toolArgs
  }

  try {
    return JSON.parse(toolArgs)
  } catch {
    return undefined
  }
}

export function usesSupportedDotnetCommand(command) {
  return typeof command === "string" && DOTNET_COMMAND.test(command)
}

export async function handlePostToolUse(payload, dependencies = defaultDependencies) {
  const toolArgs = parseToolArgs(payload?.toolArgs)
  const command = toolArgs?.command
  if (!usesSupportedDotnetCommand(command)) {
    return {}
  }

  const directory = typeof payload.cwd === "string" && payload.cwd ? payload.cwd : process.cwd()
  let temporaryDirectory

  try {
    temporaryDirectory = await dependencies.createTemporaryDirectory()
    const formatReport = join(temporaryDirectory, "report.json")
    const enrichedOutput = join(temporaryDirectory, "output.txt")

    // `dotnet format --verify-no-changes` exits non-zero when violations exist,
    // but still writes the report needed by the enrichment step.
    try {
      await dependencies.runCommand(
        "dotnet",
        ["format", "--verify-no-changes", "--severity", "info", "--report", formatReport],
        directory,
      )
    } catch {
      // Missing dotnet, analyzer violations, and format failures must not break the tool call.
    }

    try {
      await dependencies.runCommand(
        "diagnostic-hooks",
        [
          formatReport,
          "-s",
          "smells.json",
          "-o",
          enrichedOutput,
        ],
        directory,
      )
    } catch {
      // An absent report or enrichment failure leaves the original result untouched.
    }

    let report = ""
    try {
      report = (await dependencies.readFile(enrichedOutput, "utf8")).trim()
    } catch {
      // The enrichment step did not produce readable output.
    }

    if (!report) {
      return {}
    }

    const findings = `${PRIORITY_PROMPT}\n\n${report}`
    const originalResult = payload?.toolResult?.textResultForLlm
    const textResultForLlm =
      typeof originalResult === "string" && originalResult
        ? `${originalResult}\n${findings}`
        : findings

    return {
      modifiedResult: {
        resultType: "success",
        textResultForLlm,
      },
    }
  } catch {
    return {}
  } finally {
    if (temporaryDirectory) {
      try {
        await dependencies.removeTemporaryDirectory(temporaryDirectory)
      } catch {
        // Cleanup failures must not affect Copilot's originating tool call.
      }
    }
  }
}

async function main() {
  let output = {}

  try {
    let input = ""
    process.stdin.setEncoding("utf8")
    for await (const chunk of process.stdin) {
      input += chunk
    }
    output = await handlePostToolUse(JSON.parse(input))
  } catch {
    // Invalid hook input must fail open.
  }

  process.stdout.write(`${JSON.stringify(output)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
