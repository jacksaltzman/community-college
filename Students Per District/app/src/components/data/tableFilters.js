/* Shared filter functions for TanStack Table instances */

/** Column-level filter for numeric min/max range */
export function numericRangeFilter(row, columnId, filterValue) {
  if (!filterValue) return true
  const [min, max] = filterValue
  const hasMin = min !== '' && min != null
  const hasMax = max !== '' && max != null
  if (!hasMin && !hasMax) return true
  const val = row.getValue(columnId)
  if (val == null) return false
  if (hasMin && val < Number(min)) return false
  if (hasMax && val > Number(max)) return false
  return true
}

/** Global multi-word search filter — searches across a row's searchable fields */
export function makeGlobalSearchFilter(fields) {
  return function globalSearchFilter(row, _columnId, filterValue) {
    if (!filterValue) return true
    const words = filterValue.toLowerCase().split(/\s+/).filter(Boolean)
    const searchable = fields
      .map((f) => row.original[f])
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return words.every((w) => searchable.includes(w))
  }
}
