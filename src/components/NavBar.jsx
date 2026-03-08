import React, { useState } from 'react';
import { Database, FileText, Shield, AlertTriangle, Loader } from 'lucide-react';
import { useSentinel } from '../context/SentinelContext.jsx';
import { useDataRefresh } from '../hooks/useDataRefresh.js';
import { useReportExport } from '../hooks/useReportExport.js';
import ExportModal from './ExportModal.jsx';

export default function NavBar() {
  const { state } = useSentinel();
  const { refreshData } = useDataRefresh();
  const { exportPDF } = useReportExport();
  const [showExport, setShowExport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const pitCount = state.establishments.filter(e => e.pit).length;
  const critCount = state.establishments.filter(e => e.srs >= 70).length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  return (
    <>
      <nav className="sentinel-nav">
        <div className="nav-left">
          <Shield size={22} className="nav-logo-icon" />
          <span className="nav-title">SENTINEL</span>
          <span className="nav-subtitle">Food-Borne Illness Risk Intelligence</span>
          {state.demoMode && <span className="nav-demo-badge">DEMO MODE</span>}
        </div>

        <div className="nav-stats">
          {pitCount > 0 && (
            <span className="nav-stat pit">
              <AlertTriangle size={14} />
              {pitCount} PIT{pitCount !== 1 ? 's' : ''}
            </span>
          )}
          {critCount > 0 && (
            <span className="nav-stat critical">
              {critCount} Critical
            </span>
          )}
          <span className="nav-stat total">
            {state.establishments.length} Establishments
          </span>
        </div>

        <div className="nav-right">
          <button
            className="nav-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh Data from ArcGIS"
          >
            {refreshing ? <Loader size={16} className="spinning" /> : <Database size={16} />}
            <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>
          <button className="nav-btn export-btn" onClick={() => setShowExport(true)} title="Export PDF Report">
            <FileText size={16} />
            <span>Export PDF</span>
          </button>
        </div>

        {state.refreshStatus && (
          <div className={`refresh-banner ${state.refreshStatus.type}`}>
            {state.refreshStatus.message}
            {state.refreshStatus.timestamp && (
              <span className="refresh-ts"> — {new Date(state.refreshStatus.timestamp).toLocaleTimeString()}</span>
            )}
          </div>
        )}
      </nav>

      <ExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        onExport={(opts) => exportPDF(opts)}
      />
    </>
  );
}
