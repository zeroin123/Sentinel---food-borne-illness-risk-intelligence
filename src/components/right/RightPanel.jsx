import React from 'react';
import { MapPin, Calendar, Award, AlertTriangle } from 'lucide-react';
import { useSentinel } from '../../context/SentinelContext.jsx';
import { getScoreTier } from '../../utils/srsFormula.js';
import PITAlert from './PITAlert.jsx';
import SRSGauge from './SRSGauge.jsx';
import RecommendedAction from './RecommendedAction.jsx';
import ReviewFeed from './ReviewFeed.jsx';

export default function RightPanel() {
  const { state } = useSentinel();
  const est = state.selected;

  if (!est) {
    return (
      <div className="right-panel">
        <div className="right-empty">
          <MapPin size={32} className="empty-icon" />
          <h3>Select an Establishment</h3>
          <p>Click on a marker on the map or select from the list to view detailed risk intelligence.</p>
        </div>
      </div>
    );
  }

  const scoreTier = getScoreTier(est.score);
  const reviews = state.reviews[est.id] || [];

  return (
    <div className="right-panel">
      <div className="est-detail">
        {/* Header */}
        <div className="est-header">
          <h2 className="est-name">{est.name}</h2>
          <div className="est-meta">
            <span className="est-meta-item">
              <MapPin size={13} />
              {est.address}
            </span>
            <span className="est-meta-item">
              <Calendar size={13} />
              Last Inspection: {est.date || 'Unknown'}
            </span>
          </div>

          <div className="est-score-row">
            <div className="est-score-block">
              <Award size={16} />
              <span className="est-score-value">{est.score ?? 'N/A'}</span>
              <span className="est-score-tier" style={{ background: scoreTier.color + '20', color: scoreTier.color }}>
                {scoreTier.label}
              </span>
            </div>
          </div>
        </div>

        {/* Score anomaly warning */}
        {est.scoreAnomaly && (
          <div className="anomaly-banner">
            <AlertTriangle size={16} />
            <span>Score anomaly detected (Score &le; 1). This may indicate a data error or pending review.</span>
          </div>
        )}

        {/* PIT Alert */}
        <PITAlert establishment={est} />

        {/* SRS Gauge */}
        <SRSGauge establishment={est} />

        {/* Recommended Action */}
        <RecommendedAction establishment={est} reviews={reviews} />

        {/* Review Feed */}
        <ReviewFeed establishment={est} />
      </div>
    </div>
  );
}
