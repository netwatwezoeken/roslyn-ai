# AI writes the code, Roslyn guards the rules

Prepared for [GitHub Copilot Dev Days | Utrecht, Netherlands](https://luma.com/yc7wvcxn) 

## Description
Coding agents can implement a feature quickly, but they can also satisfy a complexity warning with a worse refactoring or cross an architectural boundary documented only in prose. Better prompts help, but they do not provide deterministic enforcement.

In this session, I'll demonstrate a feedback loop I use in day-to-day .NET development: Roslyn analyzers detect violations, and a GitHub Copilot hook adds rule-specific remediation guidance, and the build refuses to accept the change until the diagnostics are resolved.

We'll examine two implementation cases. First, an agent "fixes" a maintainability warning while making the design worse. We'll improve the analyzer feedback so that it produces a useful refactoring instead of merely satisfying the metric. Next, we'll use a custom analyzer to enforce the permitted dependency directions in a Clean Architecture-style solution, preventing domain and application code from referencing infrastructure implementations.

Along the way, I'll show how diagnostics reach the agent, how the analyzers and their guidance are tested, and what happens when the agent cannot find a valid solution. We'll look at practical escape routes: retrying with a more capable model, improving the remediation guidance, or treating selected diagnostics as warnings rather than blocking the build.

This session is for .NET developers, architects, and technical leads who use coding agents and want enforceable engineering constraints instead of relying exclusively on prompts and documentation.
