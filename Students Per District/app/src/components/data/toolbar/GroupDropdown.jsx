import ToolbarButton from './ToolbarButton'

export default function GroupDropdown({ groupBy, onGroupByChange, groupByOptions }) {
  if (!groupByOptions || groupByOptions.length === 0) return null

  const activeLabel = groupByOptions.find(o => o.value === groupBy)?.label

  return (
    <ToolbarButton
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
      label={activeLabel ? `Group: ${activeLabel}` : 'Group'}
      active={!!groupBy}
    >
      {({ close }) => (
        <div className="toolbar-dropdown-list">
          <label className="toolbar-dropdown-item">
            <input
              type="radio"
              name="groupBy"
              checked={!groupBy}
              onChange={() => { onGroupByChange(''); close() }}
            />
            <span>None</span>
          </label>
          {groupByOptions.map(({ value, label }) => (
            <label key={value} className="toolbar-dropdown-item">
              <input
                type="radio"
                name="groupBy"
                checked={groupBy === value}
                onChange={() => { onGroupByChange(value); close() }}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </ToolbarButton>
  )
}
