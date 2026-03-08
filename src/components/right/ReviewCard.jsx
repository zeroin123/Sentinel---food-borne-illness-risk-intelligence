import React from 'react';
import { KEYWORD_TIERS } from '../../utils/keywords.js';

export default function ReviewCard({ review }) {
  const stars = '★'.repeat(review.rating || 0) + '☆'.repeat(5 - (review.rating || 0));
  const hasIllness = review.illnessSignals?.length > 0;

  return (
    <div className={`review-card ${hasIllness ? 'illness' : ''}`}>
      <div className="review-header">
        <div className="review-source-badges">
          <span className={`source-badge ${review.source?.toLowerCase() || 'google'}`}>
            {review.source || 'Unknown'}
          </span>
          {review.demo && <span className="source-badge demo">DEMO</span>}
        </div>
        <span className="review-stars" title={`${review.rating}/5`}>{stars}</span>
      </div>

      <div className="review-meta">
        <span className="review-author">{review.author || 'Anonymous'}</span>
        {review.date && <span className="review-date">{review.date}</span>}
      </div>

      <p className="review-text">{review.text}</p>

      {hasIllness && (
        <div className="review-signals">
          {review.illnessSignals.map((signal, i) => (
            <span
              key={i}
              className="signal-chip"
              style={{ background: signal.color + '20', color: signal.color, borderColor: signal.color + '40' }}
            >
              {signal.keyword}
              <span className="signal-tier">{signal.tier}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
