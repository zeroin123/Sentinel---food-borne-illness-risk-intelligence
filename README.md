# SENTINEL — Food-Borne Illness Risk Intelligence Platform

A client-side web application for Montgomery County Health Department inspectors. Sentinel cross-references official food inspection scores with crowd-sourced illness signals scraped from TripAdvisor and Google, surfacing hidden food safety risks.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Setup

Copy `.env` and add your Bright Data API key for live review scraping:

```
VITE_BRIGHTDATA_API_KEY=your_key_here
```

Without the key, the app runs in **Demo Mode** with realistic mock review data.

## Tech Stack

- **React 18 + Vite** — Static SPA, no server required
- **Leaflet** — Interactive map with canvas-rendered markers
- **proj4.js** — Alabama State Plane East → WGS84 coordinate conversion
- **Papa Parse** — CSV data parsing
- **Day.js** — Date calculations
- **jsPDF + jspdf-autotable** — PDF report generation
- **Lucide React** — Icons

## Project Structure

```
src/
├── context/SentinelContext.jsx   # Global state (useReducer)
├── hooks/
│   ├── useCSVData.js             # CSV loading + coordinate conversion
│   ├── useBrightData.js          # Review scraping / demo mock
│   ├── useDataRefresh.js         # ArcGIS live data refresh
│   └── useReportExport.js        # PDF report generation
├── utils/
│   ├── coordConvert.js           # AL State Plane East → WGS84
│   ├── srsFormula.js             # SRS, IRS, RRS, RecRS, PIT
│   ├── keywords.js               # Illness keyword tiers (T1/T2/T3)
│   └── reviewParser.js           # TripAdvisor/Google parsers + mock
├── components/
│   ├── NavBar.jsx
│   ├── left/
│   │   ├── LeftPanel.jsx         # Filter bar + scrollable list
│   │   └── RiskCard.jsx
│   ├── map/
│   │   └── SentinelMap.jsx       # Leaflet + canvas renderer
│   └── right/
│       ├── RightPanel.jsx        # Detail panel container
│       ├── PITAlert.jsx
│       ├── SRSGauge.jsx
│       ├── RecommendedAction.jsx
│       ├── ReviewFeed.jsx        # Tabbed review panel
│       └── ReviewCard.jsx
public/
└── food_scores.csv               # Montgomery inspection data
```

## Deployment

100% static site. Deploy `dist/` to Vercel, Netlify, or GitHub Pages.

Set `VITE_BRIGHTDATA_API_KEY` in your host's environment variables for live mode.

---

Sentinel PRD v1.0 | Montgomery County Health Department | March 2026
