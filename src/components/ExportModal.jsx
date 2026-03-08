import React, { useState, useMemo } from 'react';
import { FileText, X, AlertTriangle, Download, Star } from 'lucide-react';
import { useSentinel } from '../context/SentinelContext.jsx';

export default function ExportModal({ isOpen, onClose, onExport }) {
  const { state } = useSentinel();

  const [includeCritical, setIncludeCritical] = useState(true);
  const [includeHighRisk, setIncludeHighRisk] = useState(true);
  const [includePIT, setIncludePIT] = useState(true);
  const [reviewDetail, setReviewDetail] = useState('illness'); // 'illness' | 'all' | 'summary'
  const [preparedBy, setPreparedBy] = useState('');
  const [department, setDepartment] = useState('Montgomery County Health Department');

  const counts = useMemo(() => {
    const ests = state.establishments;
    return {
      critical: ests.filter(e => e.srs >= 70).length,
      highRisk: ests.filter(e => e.srs >= 50 && e.srs < 70).length,
      pit: ests.filter(e => e.pit).length
    };
  }, [state.establishments]);

  const unscrapedCount = useMemo(() => {
    const flagged = state.establishments.filter(e => {
      if (includeCritical && e.srs >= 70) return true;
      if (includeHighRisk && e.srs >= 50 && e.srs < 70) return true;
      if (includePIT && e.pit) return true;
      return false;
    });
    return flagged.filter(e => !state.reviews[e.id] || state.reviews[e.id].length === 0).length;
  }, [state.establishments, state.reviews, includeCritical, includeHighRisk, includePIT]);

  const totalFlagged = useMemo(() => {
    let count = 0;
    if (includeCritical) count += counts.critical;
    if (includeHighRisk) count += counts.highRisk;
    if (includePIT) count += counts.pit;
    return count;
  }, [counts, includeCritical, includeHighRisk, includePIT]);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport({
      includeCritical,
      includeHighRisk,
      includePIT,
      reviewDetail,
      preparedBy: preparedBy.trim(),
      department: department.trim()
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="export-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <FileText size={20} className="modal-icon" />
            <h2>Export Priority Inspection Report</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          {/* Include Establishments */}
          <div className="modal-section">
            <label className="modal-section-title">INCLUDE ESTABLISHMENTS</label>

            <label className="modal-checkbox-row">
              <input type="checkbox" checked={includeCritical} onChange={e => setIncludeCritical(e.target.checked)} />
              <span className="modal-dot critical" />
              <span className="modal-checkbox-label">Critical establishments</span>
              <span className="modal-count">{counts.critical}</span>
            </label>

            <label className="modal-checkbox-row">
              <input type="checkbox" checked={includeHighRisk} onChange={e => setIncludeHighRisk(e.target.checked)} />
              <span className="modal-dot high-risk" />
              <span className="modal-checkbox-label">High Risk establishments</span>
              <span className="modal-count">{counts.highRisk}</span>
            </label>

            <label className="modal-checkbox-row">
              <input type="checkbox" checked={includePIT} onChange={e => setIncludePIT(e.target.checked)} />
              <Star size={12} className="modal-pit-star" fill="#F1C40F" color="#F1C40F" />
              <span className="modal-checkbox-label">Priority Inspection Triggered</span>
              <span className="modal-count">{counts.pit}</span>
            </label>
          </div>

          {/* Review Evidence Detail */}
          <div className="modal-section">
            <label className="modal-section-title">REVIEW EVIDENCE DETAIL</label>

            <label className="modal-radio-row">
              <input type="radio" name="reviewDetail" value="illness"
                checked={reviewDetail === 'illness'} onChange={() => setReviewDetail('illness')} />
              <span>Illness reviews only (recommended)</span>
            </label>

            <label className="modal-radio-row">
              <input type="radio" name="reviewDetail" value="all"
                checked={reviewDetail === 'all'} onChange={() => setReviewDetail('all')} />
              <span>All scraped reviews</span>
            </label>

            <label className="modal-radio-row">
              <input type="radio" name="reviewDetail" value="summary"
                checked={reviewDetail === 'summary'} onChange={() => setReviewDetail('summary')} />
              <span>Summary counts only (shorter report)</span>
            </label>
          </div>

          {/* Report Metadata */}
          <div className="modal-section">
            <label className="modal-section-title">REPORT METADATA</label>

            <div className="modal-field">
              <label className="modal-field-label">Prepared by</label>
              <input
                type="text"
                className="modal-input"
                placeholder="Inspector name (optional)"
                value={preparedBy}
                onChange={e => setPreparedBy(e.target.value)}
              />
            </div>

            <div className="modal-field">
              <label className="modal-field-label">Department</label>
              <input
                type="text"
                className="modal-input"
                value={department}
                onChange={e => setDepartment(e.target.value)}
              />
            </div>
          </div>

          {/* Warning */}
          {unscrapedCount > 0 && (
            <div className="modal-warning">
              <AlertTriangle size={16} />
              <span>
                {unscrapedCount} of {totalFlagged} flagged establishment{totalFlagged !== 1 ? 's' : ''} have
                not had reviews scraped yet. Their report sections will show "Reviews not yet scraped."
              </span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
          <button className="modal-btn export" onClick={handleExport} disabled={totalFlagged === 0}>
            <Download size={16} />
            Export PDF ({totalFlagged} establishment{totalFlagged !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
