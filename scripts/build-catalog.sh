#!/usr/bin/env bash
# Regenerates catalog/generated from the SDK that global.json selects and a sparse clone of dotnet/docs.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
docs_dir="$repo_root/.cache/dotnet-docs"

sdk_version="$(cd "$repo_root" && dotnet --version)"
sdk_dir="$(dotnet --list-sdks | awk -v version="$sdk_version" '$1 == version { gsub(/[][]/, "", $2); print $2 "/" $1 }')"

if [ ! -d "$docs_dir/.git" ]; then
	git clone --quiet --depth 1 --filter=blob:none --sparse https://github.com/dotnet/docs.git "$docs_dir"
	git -C "$docs_dir" sparse-checkout set docs/fundamentals/code-analysis/style-rules
else
	git -C "$docs_dir" pull --quiet --depth 1
fi

dotnet run --project "$repo_root/tools/CatalogBuilder" -- --sdk "$sdk_dir" --docs "$docs_dir" --out "$repo_root/catalog/generated"
