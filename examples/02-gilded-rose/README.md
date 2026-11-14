Demo commands in https://espanso.org/ config format:

```
  - trigger: ":df4"
    replace: "dotnet format --diagnostics CA1508 --severity hidden"

  - trigger: ":gr1"
    replace: "dotnet format --verify-no-changes --severity info --report"
```

This example is based on https://github.com/emilybache/GildedRose-Refactoring-Kata/tree/main/csharp.xUnit