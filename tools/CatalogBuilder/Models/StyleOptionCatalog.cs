namespace CatalogBuilder.Models;

internal sealed record StyleOptionCatalog(IReadOnlyList<OptionEntry> Options, IReadOnlyList<RuleDoc> Rules);
