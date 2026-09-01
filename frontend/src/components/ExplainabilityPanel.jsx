export default function ExplainabilityPanel({ reasons }) {
  if (!reasons || reasons.length === 0) {
    return (
      <div className="panel">
        <h3 className="panel-title">Model Explainability</h3>
        <p className="muted">No SHAP explanation available for this transaction.</p>
      </div>
    )
  }

  return (
    <div className="panel">
      <h3 className="panel-title">Why did the model flag this?</h3>
      <p className="panel-desc">
        Top factors that pushed this transaction toward the risk score, in plain terms.
      </p>
      <div className="reasons-list">
        {reasons.map((reason, i) => {
          const increased = reason.direction === 'increased'
          return (
            <div className="reason-row" key={`${reason.feature}-${i}`}>
              <div className="reason-rank">{i + 1}</div>
              <div className="reason-body">
                <div className="reason-label">{reason.label}</div>
                <div className="reason-value">
                  {typeof reason.value === 'number'
                    ? reason.value.toFixed(2)
                    : String(reason.value)}
                </div>
              </div>
              <div className={`reason-direction reason-${increased ? 'up' : 'down'}`}>
                <span className="direction-arrow">{increased ? '▲' : '▼'}</span>
                {increased ? 'Increased risk' : 'Reduced risk'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
