import React from 'react';
import { SentinelProvider } from './context/SentinelContext.jsx';
import { useCSVData } from './hooks/useCSVData.js';
import NavBar from './components/NavBar.jsx';
import LeftPanel from './components/left/LeftPanel.jsx';
import SentinelMap from './components/map/SentinelMap.jsx';
import RightPanel from './components/right/RightPanel.jsx';
import './App.css';

function AppContent() {
  useCSVData();
  return (
    <div className="sentinel-app">
      <NavBar />
      <div className="sentinel-panels">
        <LeftPanel />
        <div className="center-panel">
          <SentinelMap />
        </div>
        <RightPanel />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SentinelProvider>
      <AppContent />
    </SentinelProvider>
  );
}
