import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function PITAlert({ establishment }) {
  if (!establishment?.pit) return null;

  return (
    <div className="pit-alert">
      <div className="pit-alert-header">
        <AlertTriangle size={18} />
        <span>Priority Inspection Trigger</span>
      </div>
      <p className="pit-alert-text">
        This establishment has an official score of <strong>{establishment.score}</strong> (classified as "Good") 
        but has illness-related reviews detected in online sources. This gap between official records and 
        crowd-sourced signals warrants an unannounced follow-up inspection within 72 hours.
      </p>
    </div>
  );
}
