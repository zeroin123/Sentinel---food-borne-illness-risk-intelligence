import React from 'react';
import { getSRSTier } from '../../utils/srsFormula.js';

export default function SRSGauge({ establishment }) {
  if (!establishment) return null;

  const tier = getSRSTier(establishment.srs);
  const components = [
    { label: 'IRS', sublabel: 'Inspection Risk', value: establishment.irs, weight: 40, color: '#3498DB' },
    { label: 'RRS', sublabel: 'Review Risk', value: establishment.rrs, weight: 45, color: '#E74C3C' },
    { label: 'RecRS', sublabel: 'Recency Risk', value: establishment.recrs, weight: 15, color: '#F39C12' }
  ];

  return (
    <div className="srs-gauge">
      <div className="srs-gauge-header">
        <span className="srs-label">Sentinel Risk Score</span>
        <div className="srs-value" style={{ background: tier.color }}>
          {establishment.srs.toFixed(1)}
        </div>
      </div>

      <div className="srs-tier-label" style={{ color: tier.color }}>{tier.label}</div>

      <div className="srs-bar-track">
        <div
          className="srs-bar-fill"
          style={{ width: `${Math.min(100, establishment.srs)}%`, background: tier.color }}
        />
        <div className="srs-bar-markers">
          <span style={{ left: '30%' }} />
          <span style={{ left: '50%' }} />
          <span style={{ left: '70%' }} />
        </div>
      </div>

      <div className="srs-components">
        {components.map(c => (
          <div key={c.label} className="srs-component">
            <div className="srs-comp-header">
              <span className="srs-comp-label">{c.label}</span>
              <span className="srs-comp-sublabel">{c.sublabel}</span>
              <span className="srs-comp-value">{c.value.toFixed(1)}</span>
            </div>
            <div className="srs-comp-bar-track">
              <div
                className="srs-comp-bar-fill"
                style={{ width: `${Math.min(100, c.value)}%`, background: c.color }}
              />
            </div>
            <span className="srs-comp-weight">{c.weight}% weight</span>
          </div>
        ))}
      </div>
    </div>
  );
}
