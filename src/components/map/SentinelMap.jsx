import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { useSentinel } from '../../context/SentinelContext.jsx';
import { getMarkerStyle } from '../../utils/srsFormula.js';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';
const CENTER = [32.3668, -86.3000]; // Montgomery, AL
const ZOOM = 12;

export default function SentinelMap() {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const selectedRef = useRef(null);
  const { state, dispatch } = useSentinel();

  // Initialize map
  useEffect(() => {
    if (mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: CENTER,
      zoom: ZOOM,
      renderer: L.canvas(),
      zoomControl: true
    });

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map);

    // Legend
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div class="legend-title">Risk Level</div>
        <div class="legend-item"><span class="legend-dot" style="background:#8E44AD;width:16px;height:16px"></span>PIT Triggered</div>
        <div class="legend-item"><span class="legend-dot" style="background:#C0392B;width:14px;height:14px"></span>Critical (SRS &ge;70)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#E67E22;width:12px;height:12px"></span>High Risk (50-69)</div>
        <div class="legend-item"><span class="legend-dot" style="background:#27AE60;width:8px;height:8px"></span>Normal (&lt;50)</div>
      `;
      return div;
    };
    legend.addTo(map);

    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear existing
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    state.establishments.forEach(est => {
      const style = getMarkerStyle(est.srs, est.pit);
      const marker = L.circleMarker([est.lat, est.lng], {
        radius: style.radius,
        fillColor: style.color,
        color: style.color,
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.75
      });

      marker.bindTooltip(est.name, { direction: 'top', offset: [0, -8] });
      marker.on('click', () => {
        dispatch({ type: 'SELECT_ESTABLISHMENT', payload: est });
      });

      marker.establishmentId = est.id;
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [state.establishments, dispatch]);

  // Handle selection highlight and fly-to
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Reset previous selection
    if (selectedRef.current) {
      const prevMarker = markersRef.current.find(m => m.establishmentId === selectedRef.current);
      if (prevMarker) {
        const est = state.establishments.find(e => e.id === selectedRef.current);
        if (est) {
          const style = getMarkerStyle(est.srs, est.pit);
          prevMarker.setStyle({
            radius: style.radius,
            fillColor: style.color,
            color: style.color,
            weight: 1
          });
        }
      }
    }

    if (state.selected) {
      const marker = markersRef.current.find(m => m.establishmentId === state.selected.id);
      if (marker) {
        marker.setStyle({
          radius: 14,
          color: '#2980B9',
          weight: 3,
          fillOpacity: 0.9
        });
        marker.bringToFront();
        map.flyTo([state.selected.lat, state.selected.lng], Math.max(map.getZoom(), 14), {
          duration: 0.8
        });
      }
      selectedRef.current = state.selected.id;
    }
  }, [state.selected, state.establishments]);

  return <div ref={mapRef} className="sentinel-map" />;
}
