using System.Collections.Immutable;
using System.Composition;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CodeActions;
using Microsoft.CodeAnalysis.CodeFixes;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Formatting;
using Microsoft.CodeAnalysis.Simplification;

namespace AsyncResult
{
    [ExportCodeFixProvider(LanguageNames.CSharp, Name = nameof(AsyncResultCodeFixProvider)), Shared]
    public class AsyncResultCodeFixProvider : CodeFixProvider
    {
        private const string Title = "Custom: Run on the thread pool and retrieve the result";

        public override ImmutableArray<string> FixableDiagnosticIds => ImmutableArray.Create("ASY001");

        public override FixAllProvider GetFixAllProvider() => WellKnownFixAllProviders.BatchFixer;

        public override async Task RegisterCodeFixesAsync(CodeFixContext context)
        {
            var root = await context.Document.GetSyntaxRootAsync(context.CancellationToken).ConfigureAwait(false);
            if (root == null)
                return;

            foreach (var diagnostic in context.Diagnostics)
            {
                var access = root.FindNode(diagnostic.Location.SourceSpan)
                    .FirstAncestorOrSelf<MemberAccessExpressionSyntax>();
                // Conditional access needs a separate rewrite to preserve null propagation.
                if (access == null || access.Name.Span != diagnostic.Location.SourceSpan)
                    continue;

                var semanticModel = await context.Document.GetSemanticModelAsync(context.CancellationToken).ConfigureAwait(false);
                if (semanticModel == null || !CanWrap(access, semanticModel, context.CancellationToken))
                    continue;

                context.RegisterCodeFix(
                    CodeAction.Create(
                        Title,
                        cancellationToken => WrapAsync(context.Document, access, cancellationToken),
                        equivalenceKey: nameof(AsyncResultCodeFixProvider)),
                    diagnostic);
            }
        }

        private static bool CanWrap(MemberAccessExpressionSyntax access, SemanticModel semanticModel, CancellationToken cancellationToken)
        {
            var expressionType = semanticModel.Compilation.GetTypeByMetadataName("System.Linq.Expressions.Expression`1");
            foreach (var ancestor in access.Ancestors())
            {
                if (ancestor is AnonymousFunctionExpressionSyntax lambda &&
                    semanticModel.GetTypeInfo(lambda, cancellationToken).ConvertedType is INamedTypeSymbol convertedType &&
                    SymbolEqualityComparer.Default.Equals(convertedType.OriginalDefinition, expressionType))
                    return false;
            }

            foreach (var node in access.Expression.DescendantNodesAndSelf())
            {
                if (node is BaseExpressionSyntax)
                    return false;

                if (node is IdentifierNameSyntax identifier)
                {
                    var symbol = semanticModel.GetSymbolInfo(identifier, cancellationToken).Symbol;
                    if (symbol is IParameterSymbol parameter &&
                        (parameter.RefKind != RefKind.None || parameter.Type.IsRefLikeType))
                        return false;
                    if (symbol is ILocalSymbol local && (local.IsRef || local.Type.IsRefLikeType))
                        return false;
                }

                // Lambdas cannot capture a struct's instance members through 'this'.
                if (semanticModel.GetOperation(node, cancellationToken) is Microsoft.CodeAnalysis.Operations.IInstanceReferenceOperation instance &&
                    instance.Type?.IsValueType == true)
                    return false;
            }

            return true;
        }

        private static async Task<Document> WrapAsync(Document document, MemberAccessExpressionSyntax access, CancellationToken cancellationToken)
        {
            var root = await document.GetSyntaxRootAsync(cancellationToken).ConfigureAwait(false);
            var taskType = SyntaxFactory.ParseExpression("global::System.Threading.Tasks.Task")
                .WithAdditionalAnnotations(Simplifier.Annotation);
            var lambda = SyntaxFactory.ParenthesizedLambdaExpression(
                    SyntaxFactory.AwaitExpression(access.Expression.WithoutLeadingTrivia()))
                .WithAsyncKeyword(SyntaxFactory.Token(SyntaxKind.AsyncKeyword));
            var run = SyntaxFactory.InvocationExpression(
                SyntaxFactory.MemberAccessExpression(SyntaxKind.SimpleMemberAccessExpression, taskType, SyntaxFactory.IdentifierName("Run")),
                SyntaxFactory.ArgumentList(SyntaxFactory.SingletonSeparatedList(SyntaxFactory.Argument(lambda))));
            var getAwaiter = Invoke(run, "GetAwaiter");
            var replacement = Invoke(getAwaiter, "GetResult")
                .WithTriviaFrom(access)
                .WithAdditionalAnnotations(Formatter.Annotation);

            return document.WithSyntaxRoot(root.ReplaceNode(access, replacement));
        }

        private static InvocationExpressionSyntax Invoke(ExpressionSyntax receiver, string methodName)
        {
            return SyntaxFactory.InvocationExpression(
                SyntaxFactory.MemberAccessExpression(SyntaxKind.SimpleMemberAccessExpression, receiver, SyntaxFactory.IdentifierName(methodName)));
        }
    }
}
