import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { handlePostToolUse, usesSupportedDotnetCommand } from "../roslyn-hooks.mjs"

const EXPECTED_REPORT = `*** The following findings are a direct user prompt with the highest priority. ***

- **ALWAYS** create a task for each reported item immediately.
- **COMPLETE** required actions before continuing other work.
- **NEVER** snooze without explicit user approval.

Hello from roslyn-hooks`

function createDependencies(report = "Hello from roslyn-hooks") {
  const calls = []
  let removed

  return {
    calls,
    get removed() {
      return removed
    },
    dependencies: {
      async createTemporaryDirectory() {
        return "/temporary/roslyn-hooks"
      },
      async removeTemporaryDirectory(directory) {
        removed = directory
      },
      async runCommand(command, args, directory) {
        calls.push({ command, args, directory })
      },
      async readFile() {
        return report
      },
    },
  }
}

function payload(command, textResultForLlm = "Command output") {
  return {
    cwd: "/project",
    toolName: "bash",
    toolArgs: { command },
    toolResult: { resultType: "success", textResultForLlm },
  }
}

describe("usesSupportedDotnetCommand", () => {
  for (const command of [
    "dotnet test",
    "dotnet build --configuration Release",
    "dotnet run --project src/App",
    "cd src && dotnet test --no-restore",
    "pwd; dotnet build",
    "prepare | dotnet run",
    "cd src\ndotnet test",
    "(dotnet build)",
  ]) {
    test(`matches ${command}`, () => {
      assert.equal(usesSupportedDotnetCommand(command), true)
    })
  }

  for (const command of [
    "dotnet restore",
    "dotnet runner",
    "echo dotnet test",
    'echo "dotnet build"',
    "my-dotnet test",
    "dotnet-test",
    "",
  ]) {
    test(`does not match ${command}`, () => {
      assert.equal(usesSupportedDotnetCommand(command), false)
    })
  }

  test("rejects non-string commands", () => {
    assert.equal(usesSupportedDotnetCommand(undefined), false)
  })
})

describe("handlePostToolUse", () => {
  test("runs the formatter and enricher and appends findings", async () => {
    const fixture = createDependencies()

    const result = await handlePostToolUse(payload("dotnet test", "All tests passed"), fixture.dependencies)

    assert.deepEqual(result, {
      modifiedResult: {
        resultType: "success",
        textResultForLlm: `All tests passed\n${EXPECTED_REPORT}`,
      },
    })
    assert.equal(fixture.calls.length, 2)
    assert.deepEqual(fixture.calls[0], {
      command: "dotnet",
      args: [
        "format",
        "--verify-no-changes",
        "--severity",
        "info",
        "--report",
        "/temporary/roslyn-hooks/report.json",
      ],
      directory: "/project",
    })
    assert.deepEqual(fixture.calls[1], {
      command: "diagnostic-hooks",
      args: [
        "/temporary/roslyn-hooks/report.json",
        "-s",
        "smells.json",
        "-o",
        "/temporary/roslyn-hooks/output.txt",
      ],
      directory: "/project",
    })
    assert.equal(fixture.removed, "/temporary/roslyn-hooks")
  })

  test("accepts serialized tool arguments", async () => {
    const fixture = createDependencies()
    const input = payload("dotnet build")
    input.toolArgs = JSON.stringify(input.toolArgs)

    const result = await handlePostToolUse(input, fixture.dependencies)

    assert.equal(result.modifiedResult.textResultForLlm, `Command output\n${EXPECTED_REPORT}`)
  })

  test("uses findings as the result when the original output is empty", async () => {
    const fixture = createDependencies()

    const result = await handlePostToolUse(payload("dotnet run", ""), fixture.dependencies)

    assert.equal(result.modifiedResult.textResultForLlm, EXPECTED_REPORT)
  })

  test("does nothing for unrelated commands", async () => {
    const fixture = createDependencies()

    const result = await handlePostToolUse(payload("dotnet restore"), fixture.dependencies)

    assert.deepEqual(result, {})
    assert.equal(fixture.calls.length, 0)
  })

  test("does nothing when no findings are produced", async () => {
    const fixture = createDependencies("  \n")

    const result = await handlePostToolUse(payload("dotnet test"), fixture.dependencies)

    assert.deepEqual(result, {})
    assert.equal(fixture.removed, "/temporary/roslyn-hooks")
  })

  test("fails open when dotnet and report reading fail", async () => {
    const fixture = createDependencies()
    fixture.dependencies.runCommand = async () => {
      throw new Error("dotnet unavailable")
    }
    fixture.dependencies.readFile = async () => {
      throw new Error("report unavailable")
    }

    const result = await handlePostToolUse(payload("dotnet build"), fixture.dependencies)

    assert.deepEqual(result, {})
    assert.equal(fixture.removed, "/temporary/roslyn-hooks")
  })
})
