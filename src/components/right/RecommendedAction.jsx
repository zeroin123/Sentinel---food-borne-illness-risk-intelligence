import React from 'react';
import dayjs from 'dayjs';
import { getSRSTier } from '../../utils/srsFormula.js';

/**
 * Get recommended action based on SRS, PIT, score, illness count, staleness, and keyword tiers.
 *
 * Priority table (per Sentinel spec):
 *   PIT-1  → Unannounced inspection within 72 hours   (PIT triggered)
 *   PIT-2  → Expedited inspection within 24 hours     (SRS ≥ 50 + illness reviews, no PIT)
 *   Critical (SRS ≥ 70) → Inspection within 48 hours
 *   High Risk (SRS 50–69) → Inspection within 2 weeks
 *   Elevated (SRS 30–49) → 60-day monitoring cycle
 *   Normal  (SRS < 30)   → Continue routine schedule
 */
export function getRecommendedAction(establishment, reviews) {
  if (!establishment) return { short: '', detail: '', level: 'normal' };

  const score = establishment.score;
  const srs   = establishment.srs;
  const pit   = establishment.pit;

  const allReviews     = reviews || [];
  const illnessReviews = allReviews.filter(r => r.illnessSignals?.length > 0);
  const illnessCount   = illnessReviews.length;

  // Aggregate unique keyword signals by tier across all illness reviews
  const t1Set = new Set(), t2Set = new Set(), t3Set = new Set();
  illnessReviews.forEach(r => {
    (r.illnessSignals || []).forEach(s => {
      if (s.tier === 'T1') t1Set.add(s.keyword);
      else if (s.tier === 'T2') t2Set.add(s.keyword);
      else t3Set.add(s.keyword);
    });
  });

  const monthsSince = establishment.date
    ? dayjs().diff(dayjs(establishment.date), 'month')
    : null;

  const staleness = monthsSince !== null
    ? `Last officially inspected ${monthsSince} month${monthsSince !== 1 ? 's' : ''} ago.`
    : 'Inspection date unknown.';

  const scoreLabel = score != null
    ? (score >= 90 ? `${score} (Excellent)` : score >= 85 ? `${score} (Good)` : score >= 70 ? `${score} (Fair)` : `${score} (Poor)`)
    : 'N/A';

  // Build keyword context sentence
  const kwContext = () => {
    const parts = [];
    if (t1Set.size > 0) parts.push(`Severe T1 signals: ${[...t1Set].join(', ')}`);
    if (t2Set.size > 0) parts.push(`moderate T2 signals: ${[...t2Set].join(', ')}`);
    if (t3Set.size > 0) parts.push(`low-severity T3 indicators: ${[...t3Set].join(', ')}`);
    return parts.length ? parts.join('; ') + '.' : '';
  };

  // Helper to build structured bullet points
  const bullets = (items) => items.filter(Boolean);

  // ── PIT-1 ────────────────────────────────────────────────────
  if (pit) {
    return {
      short: 'PIT-1: Unannounced inspection within 72 hours',
      points: bullets([
        `Official score: ${scoreLabel} — classified as compliant`,
        `${illnessCount} illness-flagged review${illnessCount !== 1 ? 's' : ''} from crowd-sourced data contradict this rating`,
        kwContext(),
        staleness,
        'A passing score masking public illness reports triggers a Priority Inspection (PIT)',
        'Conduct an unannounced inspection within 72 hours',
        'Cross-reference with prior violation history and verify current food-handling conditions'
      ]),
      level: 'pit'
    };
  }

  // ── PIT-2 ────────────────────────────────────────────────────
  if (srs >= 50 && illnessCount > 0) {
    return {
      short: 'PIT-2: Expedited inspection within 24 hours',
      points: bullets([
        `SRS: ${srs.toFixed(1)} (High Risk) · Official score: ${scoreLabel}`,
        `${illnessCount} illness-flagged review${illnessCount !== 1 ? 's' : ''} signal active food-safety risk`,
        kwContext(),
        staleness,
        'Expedited inspection required within 24 hours',
        'Cross-check temperature logs, food storage records, and employee hygiene practices on-site'
      ]),
      level: 'high'
    };
  }

  // ── Critical SRS ≥ 70 ────────────────────────────────────────
  if (srs >= 70) {
    return {
      short: 'Schedule inspection within 48 hours',
      points: bullets([
        `SRS: ${srs.toFixed(1)} (Critical) · Official score: ${scoreLabel}`,
        score != null && score <= 1
          ? 'Score of 1 is a data anomaly — may indicate unreported closure or data entry error'
          : null,
        illnessCount > 0
          ? `${illnessCount} illness review${illnessCount !== 1 ? 's' : ''} detected`
          : 'No illness reviews yet — risk driven by inspection score and recency',
        kwContext(),
        staleness,
        'Schedule formal inspection within 48 hours',
        'Review prior inspection reports and outstanding corrective action orders before visiting'
      ]),
      level: 'critical'
    };
  }

  // ── High Risk SRS 50–69 ──────────────────────────────────────
  if (srs >= 50) {
    return {
      short: 'Schedule inspection within 2 weeks',
      points: bullets([
        `SRS: ${srs.toFixed(1)} (High Risk) · Official score: ${scoreLabel}`,
        illnessCount > 0
          ? `${illnessCount} illness review${illnessCount !== 1 ? 's' : ''} detected`
          : 'No illness reviews detected at this time',
        kwContext(),
        staleness,
        'Priority inspection within 2 weeks',
        'Monitor review activity — new illness signals may escalate to PIT-2'
      ]),
      level: 'high'
    };
  }

  // ── Elevated SRS 30–49 ───────────────────────────────────────
  if (srs >= 30) {
    return {
      short: '60-day monitoring cycle',
      points: bullets([
        `SRS: ${srs.toFixed(1)} (Elevated) · Official score: ${scoreLabel}`,
        illnessCount > 0
          ? `${illnessCount} low-severity signal${illnessCount !== 1 ? 's' : ''} detected`
          : 'No illness signals detected',
        kwContext(),
        staleness,
        'Risk above baseline but below priority thresholds',
        'Place on 60-day monitoring cycle',
        'Re-evaluate after next inspection or if new illness reviews emerge'
      ]),
      level: 'elevated'
    };
  }

  // ── Normal SRS < 30 ──────────────────────────────────────────
  return {
    short: 'Continue routine inspection schedule',
    points: bullets([
      `SRS: ${srs.toFixed(1)} (Normal) · Official score: ${scoreLabel}`,
      illnessCount > 0
        ? `${illnessCount} illness review${illnessCount !== 1 ? 's' : ''} noted — below threshold to elevate risk`
        : 'No elevated illness signals detected',
      staleness,
      'No expedited action required',
      'Continue standard periodic inspection schedule'
    ]),
    level: 'normal'
  };
}

const LEVEL_COLORS = {
  pit: '#8E44AD',
  critical: '#C0392B',
  high: '#E67E22',
  elevated: '#E8950A',
  normal: '#27AE60'
};

export default function RecommendedAction({ establishment, reviews }) {
  const action = getRecommendedAction(establishment, reviews);
  if (!action.short) return null;

  const color = LEVEL_COLORS[action.level] || '#27AE60';

  return (
    <div className="recommended-action" style={{ borderLeftColor: color }}>
      <div className="ra-header">
        <span className="ra-label">Recommended Action</span>
      </div>
      <div className="ra-short" style={{ color }}>{action.short}</div>
      <ul className="ra-points">
        {(action.points || []).map((point, i) => (
          <li key={i}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
