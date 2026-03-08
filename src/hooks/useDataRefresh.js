import { useCallback } from 'react';
import dayjs from 'dayjs';
import { useSentinel } from '../context/SentinelContext.jsx';
import { computeSRS } from '../utils/srsFormula.js';

// Proxied through Vite dev server to avoid CORS
const PRIMARY_PATH = '/api/arcgis/xNUwUjOJqYE54USz/arcgis/rest/services/Food_Scoring/FeatureServer/0/query';
const FALLBACK_PATH = '/api/arcgis/xNUwUjOJqYE54USz/arcgis/rest/services/Food/FeatureServer/0/query';

// Direct URLs for production builds (outside Vite dev proxy)
const PRIMARY_DIRECT = 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Food_Scoring/FeatureServer/0/query';
const FALLBACK_DIRECT = 'https://services7.arcgis.com/xNUwUjOJqYE54USz/arcgis/rest/services/Food/FeatureServer/0/query';

const QUERY_PARAMS = '?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&resultRecordCount=2000&f=json';

function getUrls() {
  const isDev = import.meta.env.DEV;
  return {
    primary: (isDev ? PRIMARY_PATH : PRIMARY_DIRECT) + QUERY_PARAMS,
    fallback: (isDev ? FALLBACK_PATH : FALLBACK_DIRECT) + QUERY_PARAMS,
  };
}

export function useDataRefresh() {
  const { state, dispatch } = useSentinel();

  const refreshData = useCallback(async () => {
    dispatch({ type: 'SET_REFRESH_STATUS', payload: { type: 'loading', message: 'Fetching food scores from Montgomery Open Data Portal...' } });

    const urls = getUrls();
    let data = null;
    let source = '';

    // Try primary endpoint
    try {
      console.log('[Sentinel] Trying primary endpoint (Montgomery Open Data Portal)...');
      data = await fetchEndpoint(urls.primary);
      source = 'Food_Scoring';
    } catch (err) {
      console.warn('[Sentinel] Primary failed:', err.message);
      // Try fallback
      try {
        console.log('[Sentinel] Trying fallback endpoint...');
        data = await fetchEndpoint(urls.fallback);
        source = 'Food (fallback)';
      } catch (err2) {
        console.error('[Sentinel] Fallback failed:', err2.message);
        dispatch({
          type: 'SET_REFRESH_STATUS',
          payload: {
            type: 'error',
            message: `Could not fetch data from Montgomery Open Data Portal — ${err2.message}. Displaying previously loaded data.`,
            timestamp: new Date().toISOString()
          }
        });
        setTimeout(() => dispatch({ type: 'SET_REFRESH_STATUS', payload: null }), 10000);
        return;
      }
    }

    if (!data?.features?.length) {
      dispatch({
        type: 'SET_REFRESH_STATUS',
        payload: {
          type: 'error',
          message: 'Montgomery Open Data Portal returned no records. Displaying previously loaded data.',
          timestamp: new Date().toISOString()
        }
      });
      setTimeout(() => dispatch({ type: 'SET_REFRESH_STATUS', payload: null }), 10000);
      return;
    }

    // outSR=4326 means coords are already WGS84
    const refreshed = data.features
      .map(f => {
        const a = f.attributes || {};
        const g = f.geometry;
        if (!g) return null;

        const score = parseFloat(a.Score_1);
        let dateStr = null;
        if (a.Date) {
          const d = typeof a.Date === 'number' ? dayjs(a.Date) : dayjs(a.Date);
          if (d.isValid()) dateStr = d.format('YYYY-MM-DD');
        }

        const srsData = computeSRS({ score, date: dateStr }, []);

        return {
          id: a.OBJECTID,
          name: (a.Establishment || 'Unknown').trim(),
          address: (a.Address || '').trim(),
          date: dateStr,
          score: isNaN(score) ? null : score,
          lat: g.y,
          lng: g.x,
          srs: srsData.srs,
          irs: srsData.irs,
          rrs: srsData.rrs,
          recrs: srsData.recrs,
          pit: false,
          scoreAnomaly: score <= 1
        };
      })
      .filter(Boolean);

    const ts = new Date().toISOString();

    // Check if data has actually changed by comparing record counts and a sample of scores
    const existingIds = new Set(state.establishments.map(e => e.id));
    const newIds = new Set(refreshed.map(e => e.id));
    const sameCount = refreshed.length === state.establishments.length;
    const noNewIds = refreshed.every(e => existingIds.has(e.id));
    const scoresUnchanged = refreshed.every(r => {
      const existing = state.establishments.find(e => e.id === r.id);
      return existing && existing.score === r.score && existing.date === r.date;
    });

    if (sameCount && noNewIds && scoresUnchanged && state.establishments.length > 0) {
      // Data is already up to date
      try { localStorage.setItem('sentinel_last_refresh', ts); } catch {}
      dispatch({
        type: 'SET_REFRESH_STATUS',
        payload: {
          type: 'success',
          message: `Food scores are up to date — ${refreshed.length} records from Montgomery Open Data Portal`,
          timestamp: ts
        }
      });
      setTimeout(() => dispatch({ type: 'SET_REFRESH_STATUS', payload: null }), 6000);
      return;
    }

    // Merge: refreshed replaces existing by ID, keep extras
    const refreshedIds = new Set(refreshed.map(e => e.id));
    const kept = state.establishments.filter(e => !refreshedIds.has(e.id));
    const merged = [...refreshed, ...kept];

    dispatch({ type: 'MERGE_REFRESHED', payload: merged });

    try { localStorage.setItem('sentinel_last_refresh', ts); } catch {}

    const newCount = refreshed.filter(e => !existingIds.has(e.id)).length;
    const updatedCount = refreshed.filter(e => {
      const ex = state.establishments.find(x => x.id === e.id);
      return ex && (ex.score !== e.score || ex.date !== e.date);
    }).length;

    let msg = `Refreshed ${refreshed.length} records from Montgomery Open Data Portal`;
    if (newCount > 0) msg += ` · ${newCount} new`;
    if (updatedCount > 0) msg += ` · ${updatedCount} updated`;

    dispatch({
      type: 'SET_REFRESH_STATUS',
      payload: { type: 'success', message: msg, timestamp: ts }
    });

    setTimeout(() => dispatch({ type: 'SET_REFRESH_STATUS', payload: null }), 6000);
  }, [state.establishments, dispatch]);

  return { refreshData };
}

async function fetchEndpoint(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Request timed out (15s)');
    throw err;
  }
}
