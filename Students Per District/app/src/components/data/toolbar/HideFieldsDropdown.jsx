import ToolbarButton from './ToolbarButton'

export default function HideFieldsDropdown({ columns }) {
  const hiddenCount = columns.filter(c => !c.getIsVisible()).length

  return (
    <ToolbarButton
      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
      label="Hide fields"
      active={hiddenCount > 0}
      count={hiddenCount}
    >
      <div className="toolbar-dropdown-list">
        {columns.map(column => (
          <label key={column.id} className="toolbar-dropdown-item">
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              onChange={column.getToggleVisibilityHandler()}
            />
            <span>{typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}</span>
          </label>
        ))}
      </div>
    </ToolbarButton>
  )
}
