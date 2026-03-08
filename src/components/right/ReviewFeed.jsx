import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { useSentinel } from '../../context/SentinelContext.jsx';
import { useBrightData } from '../../hooks/useBrightData.js';
import ReviewCard from './ReviewCard.jsx';
import { RefreshCw, MessageSquare } from 'lucide-react';

export default function ReviewFeed({ establishment }) {
  const { state } = useSentinel();
  const { scrapeReviews } = useBrightData();
  const [userView, setUserView] = useState(null); // null = auto

  const reviews = state.reviews[establishment?.id] || [];

  // Scrape reviews when a new establishment is selected
  useEffect(() => {
    if (establishment && establishment.id != null) {
      console.log(`[ReviewFeed] Establishment selected: "${establishment.name}" — triggering scrape`);
      setUserView(null); // Reset tab to auto
      scrapeReviews(establishment);
    }
  }, [establishment?.id, scrapeReviews]);

  const illnessReviews = useMemo(() =>
    reviews.filter(r => r.illnessSignals?.length > 0),
    [reviews]
  );

  const pastMonthReviews = useMemo(() =>
    reviews.filter(r => r.date && dayjs().diff(dayjs(r.date), 'day') <= 30),
    [reviews]
  );

  const recentReviews = useMemo(() =>
    [...reviews].sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return dayjs(b.date).valueOf() - dayjs(a.date).valueOf();
    }).slice(0, 5),
    [reviews]
  );

  // Auto-select tab: illness if signals exist, otherwise recent
  const activeView = userView || (illnessReviews.length > 0 ? 'illness' : 'recent');

  const displayReviews = useMemo(() => {
    switch (activeView) {
      case 'illness': return illnessReviews;
      case 'month': return pastMonthReviews;
      case 'all': return reviews;
      case 'recent':
      default: return recentReviews;
    }
  }, [activeView, reviews, illnessReviews, pastMonthReviews, recentReviews]);

  const tabs = [
    { id: 'recent', label: '5 Recent', color: '#3498DB', count: null },
    { id: 'illness', label: 'Illness', color: '#C0392B', count: illnessReviews.length },
    { id: 'month', label: 'Past Month', color: '#8E44AD', count: pastMonthReviews.length },
    { id: 'all', label: 'All', color: '#7F8C8D', count: reviews.length }
  ];

  if (!establishment) return null;

  const handleRefresh = () => {
    // Clear session cache for this establishment to force re-scrape
    try { sessionStorage.removeItem(`sentinel_reviews_${establishment.id}`); } catch {}
    scrapeReviews(establishment);
  };

  return (
    <div className="review-feed">
      <div className="review-feed-header">
        <div className="rf-title-row">
          <MessageSquare size={16} />
          <span className="rf-title">Reviews</span>
          <span className="rf-counts">
            {reviews.length} total · {pastMonthReviews.length} past 30d
          </span>
        </div>
        <button
          className="rf-refresh-btn"
          onClick={handleRefresh}
          disabled={state.reviewLoading}
          title="Refresh reviews"
        >
          <RefreshCw size={14} className={state.reviewLoading ? 'spinning' : ''} />
        </button>
      </div>

      <div className="review-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`review-tab ${activeView === tab.id ? 'active' : ''}`}
            style={{
              '--tab-color': tab.color,
              borderBottomColor: activeView === tab.id ? tab.color : 'transparent',
              color: activeView === tab.id ? tab.color : '#94A3B8'
            }}
            onClick={() => setUserView(tab.id)}
          >
            {tab.label}
            {tab.count !== null && (
              <span className="tab-count" style={{ background: tab.color }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {state.reviewLoading ? (
        <div className="review-loading">
          <div className="spinner" />
          <span>{state.demoMode ? 'Generating reviews...' : 'Scraping reviews...'}</span>
        </div>
      ) : displayReviews.length === 0 ? (
        <div className="review-empty">
          {activeView === 'month' ? 'No reviews in the past 30 days' :
           activeView === 'illness' ? 'No illness signals detected' :
           reviews.length === 0 ? 'No Reviews Found — click refresh to retry' :
           'No reviews match this filter'}
        </div>
      ) : (
        <div className="review-list">
          {activeView === 'recent' && reviews.length > 5 && (
            <div className="review-banner">
              Showing 5 most recent of {reviews.length} reviews
            </div>
          )}
          {displayReviews.map((review, i) => (
            <ReviewCard key={`${review.author}-${review.date}-${i}`} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
