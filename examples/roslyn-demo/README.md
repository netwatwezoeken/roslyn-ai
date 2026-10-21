Demo the following:

Analyze: `dotnet format --verify-no-changes --diagnostics CA1822 --severity hidden`
Fix: `dotnet format --diagnostics CA1822 --severity hidden`

Then `copilot` and in copilot `run dotnet build`