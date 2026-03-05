import { useState, useCallback, useRef } from 'react'
import {
  DIMENSIONS,
  DEFAULT_ACQ_WEIGHTS,
  DEFAULT_CIVIC_WEIGHTS,
  AVAILABLE_RAW_FIELDS,
} from './scoringDefaults'

/* ── Dimension row: toggle + label + slider + value + expand chevron ── */
function DimensionRow({ dim, weight, defaultWeight, onChange }) {
  const enabled = weight > 0
  const prevWeightRef = useRef(defaultWeight)

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

  return (
    <div className={`scoring-dimension-row${enabled ? '' : ' scoring-disabled'}`}>
      <input
        type="checkbox"
        className="scoring-dimension-toggle"
        checked={enabled}
        onChange={handleToggle}
      />
      <span className="scoring-dimension-label">{dim.label}</span>
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
      <span className="scoring-dimension-expand target-chevron">&#9654;</span>
    </div>
  )
}

/* ── Add Field dropdown ── */
function AddFieldButton({ lens, existingDimIds, onAdd }) {
  const [open, setOpen] = useState(false)

  // Determine which raw fields overlap with existing dimensions
  const allDimFieldKeys = new Set()
  DIMENSIONS.forEach((d) => {
    d.fields.forEach((f) => allDimFieldKeys.add(f))
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
            const overlaps = allDimFieldKeys.has(field.key)
            return (
              <button
                key={field.key}
                className="scoring-add-field-option"
                onClick={() => handleSelect(field)}
                type="button"
              >
                {field.label}
                {overlaps && (
                  <span className="scoring-field-warning" title="This field overlaps with an existing dimension">
                    !
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
        <span className="scoring-title">Scoring Model</span>
        <span className="scoring-header-right">
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
          <span className={`target-chevron${collapsed ? '' : ' open'}`}>&#9654;</span>
        </span>
      </div>

      {/* ── Expanded content ── */}
      {!collapsed && (
        <div className="scoring-body">
          {/* Alpha slider */}
          <div className="scoring-alpha-section">
            <div className="scoring-alpha-labels">
              <span className="scoring-alpha-label-left">Acquisition</span>
              <span className="scoring-alpha-value">{acqPct} / {civicPct}</span>
              <span className="scoring-alpha-label-right">Civic Leverage</span>
            </div>
            <input
              type="range"
              className="scoring-alpha-slider"
              min={0}
              max={100}
              value={acqPct}
              onChange={handleAlphaChange}
            />
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

            {/* ── Civic Leverage Score column ── */}
            <div className="scoring-column">
              <h3 className="scoring-column-header">Civic Leverage Score</h3>
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
        </div>
      )}
    </div>
  )
}
