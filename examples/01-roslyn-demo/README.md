Demo commands in https://espanso.org/ config format:
```aiignore
  - trigger: ":df1"
    replace: "dotnet format --verify-no-changes --diagnostics CA1822 --severity hidden"

  - trigger: ":df2"
    replace: "dotnet format --diagnostics CA1822 --severity hidden"

  - trigger: ":df3"
    replace: "dotnet format --verify-no-changes --diagnostics CA1508 --severity hidden"

  - trigger: ":df4"
    replace: "dotnet format --diagnostics CA1508 --severity hidden"
```