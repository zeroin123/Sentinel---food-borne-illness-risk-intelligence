import { useEffect } from 'react';
import Papa from 'papaparse';
import dayjs from 'dayjs';
import { useSentinel } from '../context/SentinelContext.jsx';
import { convertToWGS84, detectProjection } from '../utils/coordConvert.js';
import { computeSRS } from '../utils/srsFormula.js';

export function useCSVData() {
  const { dispatch } = useSentinel();

  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: true });

    fetch('/food_scores.csv')
      .then(res => res.text())
      .then(csvText => {
        const result = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: false,
          transformHeader: h => h.trim()
        });

        if (!result.data || result.data.length === 0) {
          console.error('No data parsed from CSV');
          dispatch({ type: 'SET_LOADING', payload: false });
          return;
        }

        // Detect projection from first record with valid coords
        const first = result.data.find(r => r.Lat && r.Long);
        const projection = first ? detectProjection(first.Lat, first.Long) : 'state_plane';
        console.log(`[Sentinel] Loaded ${result.data.length} records, projection: ${projection}`);

        let validCount = 0;
        let skippedCount = 0;

        const establishments = result.data
          .map(row => {
            const rawLat = row.Lat?.trim();
            const rawLong = row.Long?.trim();
            if (!rawLat || !rawLong) { skippedCount++; return null; }

            let coords;
            if (projection === 'state_plane') {
              coords = convertToWGS84(rawLat, rawLong);
            } else {
              coords = { lat: parseFloat(rawLat), lng: parseFloat(rawLong) };
            }

            if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) { skippedCount++; return null; }

            // Validate coords are in Alabama area
            if (coords.lat < 30 || coords.lat > 35.5 || coords.lng < -89 || coords.lng > -84) {
              skippedCount++;
              return null;
            }

            const score = parseFloat(row.Score_1);
            
            // Parse date: "2024/12/26 00:00:00+00" or "2024-12-26" etc.
            let dateStr = null;
            if (row.Date) {
              const cleaned = row.Date.trim().split(' ')[0]; // take just date part
              const parsed = dayjs(cleaned);
              if (parsed.isValid()) {
                dateStr = parsed.format('YYYY-MM-DD');
              }
            }

            const srsData = computeSRS({ score, date: dateStr }, []);

            validCount++;
            return {
              id: parseInt(row.OBJECTID) || validCount,
              name: (row.Establishment || 'Unknown').trim(),
              address: (row.Address || '').trim(),
              date: dateStr,
              score: isNaN(score) ? null : score,
              lat: coords.lat,
              lng: coords.lng,
              srs: srsData.srs,
              irs: srsData.irs,
              rrs: srsData.rrs,
              recrs: srsData.recrs,
              pit: false,
              scoreAnomaly: score <= 1
            };
          })
          .filter(Boolean);

        console.log(`[Sentinel] ${validCount} valid, ${skippedCount} skipped`);
        dispatch({ type: 'SET_ESTABLISHMENTS', payload: establishments });

        // Auto-detect demo mode based on API key presence
        const apiKey = import.meta.env.VITE_BRIGHTDATA_API_KEY;
        dispatch({ type: 'SET_DEMO_MODE', payload: !apiKey });
      })
      .catch(err => {
        console.error('Failed to load CSV:', err);
        dispatch({ type: 'SET_LOADING', payload: false });
      });
  }, [dispatch]);
}
