import React from 'react';
import { getSRSTier, getScoreTier } from '../../utils/srsFormula.js';
import { useSentinel } from '../../context/SentinelContext.jsx';

export default function RiskCard({ establishment }) {
  const { state, dispatch } = useSentinel();
  const isSelected = state.selected?.id === establishment.id;
  const srsTier = getSRSTier(establishment.srs);
  const scoreTier = getScoreTier(establishment.score);

  return (
    <div
      className={`risk-card ${isSelected ? 'selected' : ''}`}
      onClick={() => dispatch({ type: 'SELECT_ESTABLISHMENT', payload: establishment })}
      style={{ borderLeftColor: establishment.pit ? '#8E44AD' : srsTier.color }}
    >
      <div className="risk-card-header">
        <span className="risk-card-name">{establishment.name}</span>
        <span className="risk-card-srs" style={{ background: srsTier.color }}>
          {establishment.srs.toFixed(0)}
        </span>
      </div>
      
      <div className="risk-card-meta">
        <span className="risk-card-address">{establishment.address}</span>
      </div>
      
      <div className="risk-card-badges">
        <span className="badge score-badge" style={{ color: scoreTier.color }}>
          Score: {establishment.score ?? 'N/A'}
        </span>
        <span className="badge tier-badge" style={{ background: srsTier.color + '22', color: srsTier.color }}>
          {srsTier.label}
        </span>
        {establishment.pit && (
          <span className="badge pit-badge">PIT</span>
        )}
        {establishment.scoreAnomaly && (
          <span className="badge anomaly-badge">Anomaly</span>
        )}
      </div>
    </div>
  );
}
