using System.Collections.Immutable;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Diagnostics;
using Microsoft.CodeAnalysis.Operations;

namespace AsyncResult
{
    [DiagnosticAnalyzer(LanguageNames.CSharp)]
    public class AsyncResultAnalyzer : DiagnosticAnalyzer
    {
        public static readonly DiagnosticDescriptor AsyncResultRule = new DiagnosticDescriptor(
            "ASY001",
            "Avoid synchronous access to asynchronous results",
            "Avoid accessing Result on an asynchronous operation; use await instead",
            "Reliability",
            DiagnosticSeverity.Warning,
            isEnabledByDefault: true,
            description: "Accessing Task<T>.Result or ValueTask<T>.Result can block execution and cause deadlocks. Use await instead.");

        public override ImmutableArray<DiagnosticDescriptor> SupportedDiagnostics =>
            ImmutableArray.Create(AsyncResultRule);

        public override void Initialize(AnalysisContext context)
        {
            context.EnableConcurrentExecution();
            context.ConfigureGeneratedCodeAnalysis(GeneratedCodeAnalysisFlags.None);
            context.RegisterCompilationStartAction(startContext =>
            {
                var taskType = startContext.Compilation.GetTypeByMetadataName("System.Threading.Tasks.Task`1");
                var valueTaskType = startContext.Compilation.GetTypeByMetadataName("System.Threading.Tasks.ValueTask`1");

                startContext.RegisterOperationAction(operationContext =>
                {
                    var reference = (IPropertyReferenceOperation)operationContext.Operation;
                    if (reference.Property.Name != "Result" || reference.Parent is INameOfOperation)
                        return;

                    var declaringType = reference.Property.ContainingType.OriginalDefinition;
                    if (!SymbolEqualityComparer.Default.Equals(declaringType, taskType) &&
                        !SymbolEqualityComparer.Default.Equals(declaringType, valueTaskType))
                        return;

                    var location = reference.Syntax switch
                    {
                        MemberAccessExpressionSyntax memberAccess => memberAccess.Name.GetLocation(),
                        MemberBindingExpressionSyntax memberBinding => memberBinding.Name.GetLocation(),
                        _ => reference.Syntax.GetLocation()
                    };

                    operationContext.ReportDiagnostic(Diagnostic.Create(AsyncResultRule, location));
                }, OperationKind.PropertyReference);
            });
        }
    }
}
