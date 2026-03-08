import React, { createContext, useContext, useReducer, useMemo } from 'react';

const SentinelContext = createContext(null);

const initialState = {
  establishments: [],
  selected: null,
  reviews: {},          // keyed by OBJECTID
  filters: {
    tier: 'all',        // 'all', 'critical', 'high', 'elevated', 'normal', 'pit'
    search: ''
  },
  loading: false,
  refreshStatus: null,  // { type: 'success'|'error', message, timestamp }
  demoMode: true,
  reviewLoading: false
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ESTABLISHMENTS':
      return { ...state, establishments: action.payload, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SELECT_ESTABLISHMENT':
      return { ...state, selected: action.payload };
    case 'SET_REVIEWS':
      return {
        ...state,
        reviews: { ...state.reviews, [action.payload.id]: action.payload.reviews },
        reviewLoading: false
      };
    case 'SET_REVIEW_LOADING':
      return { ...state, reviewLoading: action.payload };
    case 'SET_FILTER_TIER':
      return { ...state, filters: { ...state.filters, tier: action.payload } };
    case 'SET_FILTER_SEARCH':
      return { ...state, filters: { ...state.filters, search: action.payload } };
    case 'MERGE_REFRESHED':
      return { ...state, establishments: action.payload };
    case 'SET_REFRESH_STATUS':
      return { ...state, refreshStatus: action.payload };
    case 'SET_DEMO_MODE':
      return { ...state, demoMode: action.payload };
    case 'UPDATE_ESTABLISHMENT_SRS': {
      const updated = state.establishments.map(e =>
        e.id === action.payload.id ? { ...e, ...action.payload.data } : e
      );
      const selectedUpdate = state.selected?.id === action.payload.id
        ? { ...state.selected, ...action.payload.data }
        : state.selected;
      return { ...state, establishments: updated, selected: selectedUpdate };
    }
    default:
      return state;
  }
}

export function SentinelProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const filteredEstablishments = useMemo(() => {
    let list = [...state.establishments];

    // Filter by tier
    if (state.filters.tier !== 'all') {
      switch (state.filters.tier) {
        case 'critical':
          list = list.filter(e => e.srs >= 70);
          break;
        case 'high':
          list = list.filter(e => e.srs >= 50 && e.srs < 70);
          break;
        case 'elevated':
          list = list.filter(e => e.srs >= 30 && e.srs < 50);
          break;
        case 'normal':
          list = list.filter(e => e.srs < 30);
          break;
        case 'pit':
          list = list.filter(e => e.pit);
          break;
      }
    }

    // Filter by search
    if (state.filters.search) {
      const q = state.filters.search.toLowerCase();
      list = list.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.address.toLowerCase().includes(q)
      );
    }

    // Sort by SRS descending
    list.sort((a, b) => b.srs - a.srs);

    return list;
  }, [state.establishments, state.filters]);

  return (
    <SentinelContext.Provider value={{ state, dispatch, filteredEstablishments }}>
      {children}
    </SentinelContext.Provider>
  );
}

export function useSentinel() {
  const ctx = useContext(SentinelContext);
  if (!ctx) throw new Error('useSentinel must be used within SentinelProvider');
  return ctx;
}
