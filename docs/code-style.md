# Code style

How code in this repo should read, beyond what Biome and the .editorconfig enforce. Where this file and the repo's own config disagree, the config wins.

## Structure

- One class per concept, with dependencies passed into the constructor and kept in private read-only fields. No module-level singletons or service locators.
- Give a service an interface when it has several implementations or tests need a seam. Don't add one for a single implementation.
- Order members: fields, constructor, public properties, public methods, then private helpers in the order they're first called.
- When several public methods share an implementation, put it in a private `…Core` method rather than having one public method call another with special arguments.
- Mappers that convert between shapes are named `to<Target>`.
- Organize by feature (vertical slices), with models, services and UI beside the feature that uses them. The public API sits at the top of a feature, its implementation details below it.

## Names

- Spell out names of fields, parameters, properties, methods and variables: `eventStateRepository`, `optionsAccessor`, `lockSemaphore`. No abbreviations.
- A lambda parameter can be a single letter when the collection names what it holds: `accounts.map(a => a.id)`, `groups.SelectMany(g => g.Rules)`. A lambda longer than a line gets a full name.
- Booleans read as questions: `isEnabled`, `hasChosenBusinesses`, `canPay`.
- Methods are verbs that say what they return or change. `tryGetUser` returns null when the user is missing; `getUser` throws.
- Name literal arguments. Never pass a bare `0`, `true` or `null` whose meaning isn't obvious at the call site.

## Control flow

- Guard clauses first: validate inputs and return early, then do the work without nesting.
- Short guards and early returns go on one line with no braces.
- Plain `if`/`else` blocks over nested ternaries or clever one-liners. One ternary for a simple choice is fine.
- Run a multi-step operation as a sequence of steps, each checking its result and returning early on failure.
- Break long call chains one call per line.
- Update immutable data by copying it with a change, not by mutating what was passed in.

## Errors

- Expected failures, like a missing record or a rejected request, are returned as results, not thrown.
- Throw only for programmer errors and broken invariants, with a full-sentence message that names the value: `Account 'acc-1' has no balance.`
- Catch only to add context, clean up, or turn an error into a result. Never swallow one silently. If ignoring it is correct, a comment says why.
- Log messages are full sentences ending in a period, with structured placeholders rather than string building.

## Comments

- The public API of a package or library others consume gets a doc comment on every public type and member: one sentence, two at most, saying what it is or why it exists.
- Elsewhere, including internal and private code, add a doc comment only when the code can't explain itself. Those comments are welcome when they earn their place.
- Implementations inherit their interface's doc comment instead of repeating it.
- Inside code, comment only what isn't clear from reading it. Explain why, often in a few words.
- A short label can head a block of steps in a long method, but splitting the method is usually better.
- No comments that restate the code, narrate a change, or mention how it used to work.

## Tests

- Prefer end-to-end and system tests. Unit-test complicated logic, invariants and edge-case bug fixes.
- Name tests after the behavior: what's done, under what condition, and what happens.
- No arrange, act or assert comments. Blank lines separate the phases.

## Scope

- Greenfield code has no compatibility shims or leftovers from earlier iterations.
- Handle what users can actually hit. No speculative guards, options or abstractions "for later".
- Don't do work that isn't needed, and prune unused code and dependencies.

## TypeScript and Svelte

- Classes for services, stores and features, with constructor parameter properties: `public constructor(private readonly store: Store) {}`.
- Write `public` and `private` on every class member, constructors included.
- `const` by default, `let` only when the value is reassigned. Let types be inferred inside functions. Annotate public signatures.
- `strict` on. No `any`. Parse unknown data with a schema or type guards at the boundary, then trust the types inside.
- Use `undefined` or `null` for missing values consistently within a module. A `tryGet…` method returns one of them; a `get…` method throws.
- Represent results as discriminated unions (`{ status: 'ready', data } | { status: 'failed' }`) and switch on the tag.
- Name literal arguments with an options object or a named constant: `wait({ timeoutMs: 0 })`, not `wait(0)`.
- Constants are `UPPER_SNAKE_CASE` at the top of the file.
- Release resources with `using`, `DisposableStack` or `finally`.
- When an operation can be cancelled, pass its `AbortSignal` down to the I/O.
- Doc comments are `/** … */` on exported and public members. Private members only when they're hard to follow.
- One exported class or main function per file, with the file named after it in camelCase.
- Import types with `import type`.
- Svelte: version 5 runes (`$state`, `$derived`, `$props`), not legacy `export let`, `$:` or stores.

## C#

### Formatting

- Tabs for indentation, Allman braces.
- `var` everywhere.
- Qualify fields, properties and events with `this.`, but not method calls.
- Predefined type names (`string`, `int`) over framework names (`String`, `Int32`).
- Sort `System` usings first. File-scoped namespaces.

### Language

- Target .NET 10 / C# 14 unless the project says otherwise. Flag anything that needs a preview or newer SDK.
- Nullable reference types on, never disabled. A `null!`, `!` or `#pragma warning disable` needs a comment saying why it's safe.
- Collection expressions (`[]`, `[..a, ..b]`) and records where they fit.
- `TryX(out T value)` methods use `[NotNullWhen(true)]`, or `[MaybeNullWhen(false)]` for unconstrained generics.
- Pattern matching (`is null`, `is not`, `is IDisposable disposable`) over casts and `== null`.
- Throw expressions guard constructor dependencies (see Structure). Use `ArgumentNullException.ThrowIfNull` in methods.
- `??=` for defaults and `with` for record updates.
- Expected failures come back as a `Result<TValue, TError>` with `Succeeded` and `Failed` (annotated with `MemberNotNullWhen`) and implicit conversions from the value and the error.
- Named arguments for literals: `WaitAsync(millisecondsTimeout: 0)`, `new HashSet<string>(capacity: 5)`.
- `private const` and `private static readonly` in PascalCase, declared near where they're used. Shared constants live in a nested static `Constants` class.

### Structure

- Primary constructors for injected dependencies, each assigned to a `private readonly` field of the same name with a guard: `private readonly ILogger<Worker> logger = logger ?? throw new ArgumentNullException(nameof(logger));`. Members use the field (`this.logger`), never the parameter, so it's captured once (CS9124).
- Internal implementations behind public interfaces. A small internal interface can sit in the same file as its class.
- Split large classes into partial files by verb or variant: `HttpClientExtensions.Get.cs`, `Repository.Memory.cs`.
- Folders: public API at the project root, implementation in `Internal/`, plus `Models/`, `Options/`, `Extensions/` and `Mappers/` as needed.
- `IServiceCollection` extensions are named `Add<Feature>` and return the collection for chaining.
- Options classes initialize collections (`= new();`), and their doc comments start with "(Required)" when a value must be set.
- Wrap dispose boilerplate in `#region IDisposable`, following the standard `Dispose(bool)` and `DisposeAsyncCore` pattern.

### Platform

- `TimeProvider`, never `DateTime.Now`/`UtcNow` directly.
- `IOptions<T>` with `ValidateOnStart`. `IHttpClientFactory` with typed clients.
- `ILogger` with `[LoggerMessage]` source generation. OpenTelemetry for traces and metrics.
- Minimal APIs with `TypedResults`, organized as vertical slices. No MediatR, repository or AutoMapper layers unless asked.
- Assume Central Package Management, `Directory.Build.props` and `TreatWarningsAsErrors`.
- Libraries: avoid reflection and runtime codegen that break trimming or Native AOT.

### Async

- Methods returning tasks end in `Async` and take a `CancellationToken`, passed down to every call.
- Libraries use `.ConfigureAwait(false)` on every await. No sync-over-async.
- Release locks in `finally`.

### Docs and tests

- XML doc comments on every public type and member of a packable library (`IsPackable`, NuGet). In apps and internal code, only where the code can't explain itself. Implementations use `<inheritdoc/>`.
- MSTest via `MSTest.Sdk`, Moq 4.20.2 or later. Integration tests use `WebApplicationFactory` or Testcontainers.
- Test names follow `Method_Condition_ExpectedResult`, with one test class per production class, named `<Class>Tests`.
- Test projects mirror source projects one to one.
