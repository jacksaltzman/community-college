import { useState, useCallback, useRef } from 'react'
import {
  DIMENSIONS,
  DEFAULT_ACQ_WEIGHTS,
  DEFAULT_CIVIC_WEIGHTS,
  AVAILABLE_RAW_FIELDS,
  FIELD_LABELS,
} from './scoringDefaults'

/* ── Dimension row: toggle + label + info tooltip + subfield count + slider + value ── */
function DimensionRow({ dim, weight, defaultWeight, onChange }) {
  const enabled = weight > 0
  const prevWeightRef = useRef(defaultWeight)
  const [showFields, setShowFields] = useState(false)

  // Track the last non-zero weight so we can restore it on re-toggle
  if (weight > 0) {
    prevWeightRef.current = weight
  }

  const handleToggle = useCallback(() => {
    if (enabled) {
      onChange(dim.id, 0)
    } else {
      onChange(dim.id, prevWeightRef.current || defaultWeight)
    }
  }, [enabled, dim.id, defaultWeight, onChange])

  const handleSlider = useCallback(
    (e) => {
      onChange(dim.id, Number(e.target.value))
    },
    [dim.id, onChange]
  )

  const hasFields = dim.fields && dim.fields.length > 0
  const expandable = hasFields || dim.formula

  return (
    <div className="scoring-dimension-wrap">
      <div className={`scoring-dimension-row${enabled ? '' : ' scoring-disabled'}`}>
        <input
          type="checkbox"
          className="scoring-dimension-toggle"
          checked={enabled}
          onChange={handleToggle}
        />
        <span className="scoring-dimension-label">
          {dim.label}
          {dim.desc && (
            <span className="scoring-info-tip" data-tip={dim.desc}>
              &#9432;
            </span>
          )}
          {expandable && (
            <button
              className={`scoring-subfield-count${showFields ? ' active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                setShowFields((s) => !s)
              }}
              type="button"
              title={hasFields ? `${dim.fields.length} component fields` : 'View formula'}
            >
              {hasFields ? dim.fields.length : 'ƒ'}
            </button>
          )}
        </span>
        <input
          type="range"
          className="scoring-dimension-slider"
          min={0}
          max={100}
          value={weight}
          onChange={handleSlider}
          disabled={!enabled}
        />
        <span className="scoring-dimension-value">{weight}</span>
      </div>
      {showFields && (hasFields || dim.formula) && (
        <div className="scoring-field-detail">
          {hasFields && dim.fields.map((f) => (
            <span key={f} className="scoring-field-detail-tag">
              {FIELD_LABELS[f] || f}
            </span>
          ))}
          {dim.formula && (
            <span className="scoring-field-formula">
              ƒ&ensp;{dim.formula}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Add Field dropdown ── */
function AddFieldButton({ lens, existingDimIds, onAdd }) {
  const [open, setOpen] = useState(false)

  // Map each raw field key to the dimension that already includes it (if any)
  const fieldToDimLabel = {}
  DIMENSIONS.forEach((d) => {
    d.fields.forEach((f) => {
      fieldToDimLabel[f] = d.label
    })
  })

  const handleSelect = useCallback(
    (field) => {
      onAdd(lens, field)
      setOpen(false)
    },
    [lens, onAdd]
  )

  return (
    <div className="scoring-add-field-wrap">
      <button
        className="scoring-add-field-btn"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        + Add field
      </button>
      {open && (
        <div className="scoring-add-field-dropdown">
          {AVAILABLE_RAW_FIELDS.map((field) => {
            const parentDim = fieldToDimLabel[field.key]
            return (
              <button
                key={field.key}
                className="scoring-add-field-option"
                onClick={() => handleSelect(field)}
                type="button"
              >
                {field.label}
                {parentDim && (
                  <span className="scoring-field-note">
                    in {parentDim}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Main ScoringPanel component ── */
export default function ScoringPanel({ config, onConfigChange, collapsed, onToggleCollapsed }) {
  const {
    alpha = 0.5,
    acquisitionWeights = {},
    civicWeights = {},
    customFields = [],
  } = config || {}

  const acqPct = Math.round(alpha * 100)
  const civicPct = 100 - acqPct

  /* ── Alpha slider handler ── */
  const handleAlphaChange = useCallback(
    (e) => {
      onConfigChange({ ...config, alpha: Number(e.target.value) / 100 })
    },
    [config, onConfigChange]
  )

  /* ── Weight change handlers ── */
  const handleAcqWeightChange = useCallback(
    (dimId, value) => {
      onConfigChange({
        ...config,
        acquisitionWeights: { ...acquisitionWeights, [dimId]: value },
      })
    },
    [config, acquisitionWeights, onConfigChange]
  )

  const handleCivicWeightChange = useCallback(
    (dimId, value) => {
      onConfigChange({
        ...config,
        civicWeights: { ...civicWeights, [dimId]: value },
      })
    },
    [config, civicWeights, onConfigChange]
  )

  /* ── Add custom field handler ── */
  const handleAddField = useCallback(
    (lens, field) => {
      const newCustom = [
        ...customFields,
        { fieldKey: field.key, label: field.label, lens, weight: 10 },
      ]
      onConfigChange({ ...config, customFields: newCustom })
    },
    [config, customFields, onConfigChange]
  )

  /* ── Reset to defaults ── */
  const handleReset = useCallback(() => {
    onConfigChange({
      alpha: 0.5,
      acquisitionWeights: { ...DEFAULT_ACQ_WEIGHTS },
      civicWeights: { ...DEFAULT_CIVIC_WEIGHTS },
      customFields: [],
    })
  }, [onConfigChange])

  return (
    <div className={`scoring-panel${collapsed ? '' : ' open'}`}>
      {/* ── Header bar ── */}
      <div className="scoring-header" onClick={onToggleCollapsed}>
        <span className="scoring-title">
          <span className={`target-chevron${collapsed ? '' : ' open'}`}>&#9654;</span>
          Scoring Model
        </span>
        <span className="scoring-header-right">
          {!collapsed && (
            <button
              className="scoring-reset-link"
              onClick={(e) => {
                e.stopPropagation()
                handleReset()
              }}
              type="button"
            >
              Reset to defaults
            </button>
          )}
          <button
            className="scoring-collapse-btn"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapsed()
            }}
            type="button"
          >
            {collapsed ? 'Show Model' : 'Hide Model'}
          </button>
        </span>
      </div>

      {/* ── Expanded content ── */}
      {!collapsed && (
        <div className="scoring-body">
          {/* Alpha slider */}
          <div className="scoring-alpha-section">
            <div className="scoring-alpha-labels">
              <span className="scoring-alpha-label-left">Acquisition</span>
              <span className="scoring-alpha-label-right">Make Political Change</span>
            </div>
            <div className="scoring-alpha-slider-wrap">
              <span
                className="scoring-alpha-value"
                style={{ left: `${acqPct}%` }}
              >
                {acqPct} / {civicPct}
              </span>
              <input
                type="range"
                className="scoring-alpha-slider"
                min={0}
                max={100}
                value={acqPct}
                onChange={handleAlphaChange}
              />
            </div>
          </div>

          {/* Two-column lens layout */}
          <div className="scoring-columns">
            {/* ── Acquisition Score column ── */}
            <div className="scoring-column">
              <h3 className="scoring-column-header">Acquisition Score</h3>
              {DIMENSIONS.map((dim) => (
                <DimensionRow
                  key={dim.id}
                  dim={dim}
                  weight={acquisitionWeights[dim.id] ?? 0}
                  defaultWeight={DEFAULT_ACQ_WEIGHTS[dim.id] ?? 10}
                  onChange={handleAcqWeightChange}
                />
              ))}
              <AddFieldButton
                lens="acquisition"
                existingDimIds={DIMENSIONS.map((d) => d.id)}
                onAdd={handleAddField}
              />
            </div>

            {/* ── Political Change Score column ── */}
            <div className="scoring-column">
              <h3 className="scoring-column-header">Political Change Score</h3>
              {DIMENSIONS.map((dim) => (
                <DimensionRow
                  key={dim.id}
                  dim={dim}
                  weight={civicWeights[dim.id] ?? 0}
                  defaultWeight={DEFAULT_CIVIC_WEIGHTS[dim.id] ?? 10}
                  onChange={handleCivicWeightChange}
                />
              ))}
              <AddFieldButton
                lens="civic"
                existingDimIds={DIMENSIONS.map((d) => d.id)}
                onAdd={handleAddField}
              />
            </div>
          </div>

          {/* ── Collapse bar at bottom ── */}
          <button
            className="scoring-collapse-bar"
            onClick={onToggleCollapsed}
            type="button"
            title="Collapse scoring model"
          >
            <span className="scoring-collapse-chevrons">
              <span>&#x2303;</span>
              <span>&#x2303;</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
