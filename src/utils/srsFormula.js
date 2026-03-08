import dayjs from 'dayjs';
import { extractIllnessSignals } from './keywords.js';

/**
 * Compute Inspection Risk Score (IRS)
 * IRS = 100 - Score_1
 */
export function computeIRS(score) {
  const s = parseFloat(score);
  if (isNaN(s) || s <= 1) return 100; // anomaly scores treated as max risk
  return Math.max(0, Math.min(100, 100 - s));
}

/**
 * Compute Review Risk Score (RRS)
 * RRS = min(100, sum(weight * count * recency) / sqrt(total+1) * 25)
 */
export function computeRRS(reviews) {
  if (!reviews || reviews.length === 0) return 0;

  let weightedSum = 0;
  const now = dayjs();

  for (const review of reviews) {
    const signals = review.illnessSignals || extractIllnessSignals(review.text);
    if (signals.length === 0) continue;

    // Recency factor: more recent = higher weight
    let recency = 0.5;
    if (review.date) {
      const reviewDate = dayjs(review.date);
      if (reviewDate.isValid()) {
        const monthsAgo = now.diff(reviewDate, 'month');
        if (monthsAgo <= 1) recency = 1.0;
        else if (monthsAgo <= 3) recency = 0.9;
        else if (monthsAgo <= 6) recency = 0.7;
        else if (monthsAgo <= 12) recency = 0.5;
        else recency = 0.3;
      }
    }

    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    weightedSum += totalWeight * recency;
  }

  const total = reviews.length;
  const rrs = Math.min(100, (weightedSum / Math.sqrt(total + 1)) * 25);
  return Math.round(rrs * 10) / 10;
}

/**
 * Compute Recency Risk Score (RecRS)
 * RecRS = min(100, months_since_inspection * 4)
 */
export function computeRecRS(inspectionDate) {
  if (!inspectionDate) return 100;
  const d = dayjs(inspectionDate);
  if (!d.isValid()) return 100;

  const months = dayjs().diff(d, 'month');
  return Math.min(100, months * 4);
}

/**
 * Compute full Sentinel Risk Score
 * SRS = (0.40 × IRS) + (0.45 × RRS) + (0.15 × RecRS)
 */
export function computeSRS(establishment, reviews) {
  const irs = computeIRS(establishment.score);
  const rrs = computeRRS(reviews);
  const recrs = computeRecRS(establishment.date);

  const srs = (0.40 * irs) + (0.45 * rrs) + (0.15 * recrs);
  return {
    srs: Math.round(srs * 10) / 10,
    irs: Math.round(irs * 10) / 10,
    rrs: Math.round(rrs * 10) / 10,
    recrs: Math.round(recrs * 10) / 10
  };
}

/**
 * Determine SRS tier
 */
export function getSRSTier(srs) {
  if (srs >= 70) return { label: 'Critical', color: '#C0392B', badge: 'red' };
  if (srs >= 50) return { label: 'High Risk', color: '#E67E22', badge: 'orange' };
  if (srs >= 30) return { label: 'Elevated', color: '#E8950A', badge: 'yellow-orange' };
  return { label: 'Normal', color: '#27AE60', badge: 'green' };
}

/**
 * Check Priority Inspection Trigger (PIT)
 * PIT fires when ALL conditions are true:
 *  - Official score >= 85
 *  - At least one illness-related review
 *  - SRS < 50
 */
export function checkPIT(establishment, reviews, srs) {
  const score = parseFloat(establishment.score);
  if (isNaN(score) || score < 85) return false;

  const hasIllness = reviews && reviews.some(r => {
    const signals = r.illnessSignals || extractIllnessSignals(r.text);
    return signals.length > 0;
  });
  if (!hasIllness) return false;

  return srs < 50;
}

/**
 * Get marker style based on SRS and PIT status
 */
export function getMarkerStyle(srs, pit) {
  if (pit) return { color: '#8E44AD', radius: 11 };
  if (srs >= 70) return { color: '#C0392B', radius: 10 };
  if (srs >= 50) return { color: '#E67E22', radius: 8 };
  return { color: '#27AE60', radius: 5 };
}

/**
 * Get official score tier
 */
export function getScoreTier(score) {
  const s = parseFloat(score);
  if (isNaN(s) || s <= 1) return { label: 'Anomaly', color: '#E67E22' };
  if (s >= 85) return { label: 'Good', color: '#27AE60' };
  if (s >= 70) return { label: 'High Risk', color: '#E67E22' };
  return { label: 'Critical', color: '#C0392B' };
}
