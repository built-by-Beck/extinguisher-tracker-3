/**
 * Helpers for Custom Asset type tabs and grouping.
 */

export interface AssetTypeSource {
  assetType?: string | null;
  active?: boolean;
  status?: string;
}

/** Distinct active assetType values for in-page tabs (sorted). */
export function collectDistinctAssetTypes(assets: AssetTypeSource[]): string[] {
  const seen = new Set<string>();
  for (const asset of assets) {
    if (asset.active === false || asset.status !== 'active') continue;
    const type = asset.assetType?.trim();
    if (type) seen.add(type);
  }
  return Array.from(seen).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}
