const SUB_VIEWS = [
  { key: 'states', label: 'States' },
  { key: 'districts', label: 'Districts' },
  { key: 'campuses', label: 'Campuses' },
]

export default function SubNav({ subView, page, navigate }) {
  return (
    <div className="sub-nav">
      {SUB_VIEWS.map(({ key, label }) => (
        <button
          key={key}
          className={`sub-nav-btn${subView === key ? ' active' : ''}`}
          onClick={() => navigate(page, key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
