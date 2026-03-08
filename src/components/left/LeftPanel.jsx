import React from 'react';
import { Search, Filter } from 'lucide-react';
import { useSentinel } from '../../context/SentinelContext.jsx';
import RiskCard from './RiskCard.jsx';

const TIERS = [
  { value: 'all', label: 'All', color: '#94A3B8' },
  { value: 'pit', label: 'PIT', color: '#8E44AD' },
  { value: 'critical', label: 'Critical', color: '#C0392B' },
  { value: 'high', label: 'High Risk', color: '#E67E22' },
  { value: 'elevated', label: 'Elevated', color: '#E8950A' },
  { value: 'normal', label: 'Normal', color: '#27AE60' },
];

export default function LeftPanel() {
  const { state, dispatch, filteredEstablishments } = useSentinel();

  return (
    <div className="left-panel">
      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search establishments..."
            value={state.filters.search}
            onChange={e => dispatch({ type: 'SET_FILTER_SEARCH', payload: e.target.value })}
          />
        </div>

        <div className="tier-filters">
          {TIERS.map(tier => (
            <button
              key={tier.value}
              className={`tier-btn ${state.filters.tier === tier.value ? 'active' : ''}`}
              style={{
                '--tier-color': tier.color,
                borderColor: state.filters.tier === tier.value ? tier.color : 'transparent',
                color: state.filters.tier === tier.value ? tier.color : '#94A3B8',
                background: state.filters.tier === tier.value ? tier.color + '15' : 'transparent'
              }}
              onClick={() => dispatch({ type: 'SET_FILTER_TIER', payload: tier.value })}
            >
              {tier.label}
            </button>
          ))}
        </div>

        <div className="results-count">
          {filteredEstablishments.length} of {state.establishments.length} establishments
        </div>
      </div>

      <div className="risk-list">
        {state.loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading establishments...</span>
          </div>
        ) : filteredEstablishments.length === 0 ? (
          <div className="empty-state">No establishments match filters</div>
        ) : (
          filteredEstablishments.map(est => (
            <RiskCard key={est.id} establishment={est} />
          ))
        )}
      </div>
    </div>
  );
}
