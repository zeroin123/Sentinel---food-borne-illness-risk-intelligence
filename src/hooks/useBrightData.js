import { useCallback, useRef } from 'react';
import { useSentinel } from '../context/SentinelContext.jsx';
import { generateMockReviews, parseTripAdvisorMarkdown, parseYelpMarkdown, parseGoogleSERP } from '../utils/reviewParser.js';
import { computeSRS, checkPIT } from '../utils/srsFormula.js';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCachedReviews(id) {
  try {
    const raw = sessionStorage.getItem(`sentinel_reviews_${id}`);
    if (!raw) return null;
    const { reviews, timestamp } = JSON.parse(raw);
    // Don't return empty arrays from cache — treat them as uncached
    if (!reviews || reviews.length === 0) return null;
    if (Date.now() - timestamp > CACHE_TTL) {
      sessionStorage.removeItem(`sentinel_reviews_${id}`);
      return null;
    }
    return reviews;
  } catch {
    return null;
  }
}

function setCachedReviews(id, reviews) {
  // Only cache non-empty results
  if (!reviews || reviews.length === 0) return;
  try {
    sessionStorage.setItem(`sentinel_reviews_${id}`, JSON.stringify({
      reviews,
      timestamp: Date.now()
    }));
  } catch { /* storage full */ }
}

export function useBrightData() {
  const { state, dispatch } = useSentinel();
  // Use a ref so the scrape function always sees latest dispatch
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const scrapeReviews = useCallback(async (establishment) => {
    if (!establishment) {
      console.warn('[Sentinel] scrapeReviews called with no establishment');
      return;
    }

    console.log(`[Sentinel] scrapeReviews called for: "${establishment.name}" (ID: ${establishment.id})`);

    // Check session cache first
    const cached = getCachedReviews(establishment.id);
    if (cached && cached.length > 0) {
      console.log(`[Sentinel] Using cached reviews (${cached.length}) for ${establishment.name}`);
      dispatchRef.current({ type: 'SET_REVIEWS', payload: { id: establishment.id, reviews: cached } });
      updateSRS(establishment, cached, dispatchRef.current);
      return;
    }

    dispatchRef.current({ type: 'SET_REVIEW_LOADING', payload: true });

    const apiKey = import.meta.env.VITE_BRIGHTDATA_API_KEY;
    let reviews = [];

    if (!apiKey) {
      // ── DEMO MODE: generate mock reviews ──
      console.log(`[Sentinel] No API key found — generating mock reviews for "${establishment.name}"`);
      try {
        await new Promise(r => setTimeout(r, 200 + Math.random() * 400));
        reviews = generateMockReviews(establishment);
        console.log(`[Sentinel] Generated ${reviews.length} mock reviews`);
      } catch (err) {
        console.error('[Sentinel] Mock review generation failed:', err);
        reviews = [];
      }
    } else {
      // ── LIVE MODE: scrape from TripAdvisor → Yelp → Google ──
      console.log(`[Sentinel] API key found — scraping live reviews for "${establishment.name}"`);
      try {
        reviews = await scrapeAllSources(establishment, apiKey);
        console.log(`[Sentinel] Scraped ${reviews.length} live reviews`);
      } catch (err) {
        console.error('[Sentinel] Live scraping error:', err);
        reviews = [];
      }

      // If live scraping returned nothing (API failure, CORS, quota, etc.)
      // fall back to seeded mock reviews so the UI is never empty
      if (reviews.length === 0) {
        console.log(`[Sentinel] Live scraping returned 0 reviews — falling back to demo data for "${establishment.name}"`);
        try {
          reviews = generateMockReviews(establishment);
          console.log(`[Sentinel] Fallback generated ${reviews.length} demo reviews`);
        } catch (fbErr) {
          console.error('[Sentinel] Fallback mock generation failed:', fbErr);
        }
      }
    }

    setCachedReviews(establishment.id, reviews);
    dispatchRef.current({ type: 'SET_REVIEWS', payload: { id: establishment.id, reviews } });
    updateSRS(establishment, reviews, dispatchRef.current);
  }, []); // No dependencies — uses refs and direct env check

  return { scrapeReviews };
}

function updateSRS(est, reviews, dispatch) {
  const srsData = computeSRS(est, reviews);
  const pit = checkPIT(est, reviews, srsData.srs);
  dispatch({
    type: 'UPDATE_ESTABLISHMENT_SRS',
    payload: { id: est.id, data: { ...srsData, pit } }
  });
}

// ── Live scraping orchestration ────────────────────────────────

async function scrapeAllSources(establishment, apiKey) {
  const name = establishment.name;
  const searchName = name.replace(/#\d+/g, '').replace(/\s*\(.*?\)\s*/g, '').trim();
  let allReviews = [];

  // ── 1. TripAdvisor ──
  try {
    console.log(`[Sentinel] Searching TripAdvisor for: ${searchName}`);
    const taUrl = await findTripAdvisorUrl(searchName, apiKey);
    if (taUrl) {
      console.log(`[Sentinel] Scraping TripAdvisor: ${taUrl}`);
      const md = await scrapeUrl(taUrl, apiKey);
      if (md) {
        const taReviews = parseTripAdvisorMarkdown(md);
        console.log(`[Sentinel] TripAdvisor: ${taReviews.length} reviews parsed`);
        allReviews.push(...taReviews);
      }
    } else {
      console.log('[Sentinel] No TripAdvisor URL found');
    }
  } catch (err) {
    console.warn('[Sentinel] TripAdvisor scrape failed:', err.message);
  }

  // ── 2. Yelp ──
  try {
    console.log(`[Sentinel] Searching Yelp for: ${searchName}`);
    const yelpUrl = await findYelpUrl(searchName, apiKey);
    if (yelpUrl) {
      console.log(`[Sentinel] Scraping Yelp: ${yelpUrl}`);
      const md = await scrapeUrl(yelpUrl, apiKey);
      if (md) {
        const yelpReviews = parseYelpMarkdown(md);
        console.log(`[Sentinel] Yelp: ${yelpReviews.length} reviews parsed`);
        allReviews.push(...yelpReviews);
      }
    } else {
      console.log('[Sentinel] No Yelp URL found');
    }
  } catch (err) {
    console.warn('[Sentinel] Yelp scrape failed:', err.message);
  }

  // ── 3. Google Reviews — only if TripAdvisor + Yelp found fewer than 3 reviews ──
  if (allReviews.length < 3) {
    try {
      console.log(`[Sentinel] TripAdvisor/Yelp returned ${allReviews.length} — supplementing with Google`);
      const serpReviews = await searchGoogleReviews(searchName, apiKey);
      console.log(`[Sentinel] Google Reviews: ${serpReviews.length} reviews parsed`);
      allReviews.push(...serpReviews);
    } catch (err) {
      console.warn('[Sentinel] Google Reviews failed:', err.message);
    }
  } else {
    console.log(`[Sentinel] Skipping Google — already have ${allReviews.length} reviews from TripAdvisor/Yelp`);
  }

  // Sort newest first
  allReviews.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  return allReviews;
}

// ── API helpers ────────────────────────────────────────────────

function apiBase() {
  return import.meta.env.DEV ? '/api/brightdata' : 'https://api.brightdata.com';
}

/**
 * Bright Data Browser API — renders JavaScript and returns full page content.
 * Uses mcp_browser zone for TripAdvisor/Yelp (they need JS rendering).
 * Falls back to mcp_unlocker (Web Unlocker) if Browser API fails.
 */
async function scrapeUrl(targetUrl, apiKey) {
  // Try Browser API first (renders JS — needed for Yelp/TripAdvisor)
  for (const zone of ['mcp_browser', 'mcp_unlocker']) {
    try {
      console.log(`[Sentinel] Scraping (${zone}): ${targetUrl}`);
      const res = await fetch(`${apiBase()}/request`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zone, url: targetUrl, format: 'raw' })
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => res.statusText);
        console.warn(`[Sentinel] ${zone} returned ${res.status}: ${errBody}`);
        continue; // try next zone
      }

      const html = await res.text();
      if (html && html.length > 500) return html;
      console.warn(`[Sentinel] ${zone} returned very short response (${html.length} chars)`);
    } catch (err) {
      console.warn(`[Sentinel] ${zone} error:`, err.message);
    }
  }

  throw new Error('All scraping zones failed');
}

/**
 * Google search via Web Unlocker — scrapes Google search HTML directly.
 * Replaces the SERP API (which is async and returns response_id).
 * Uses mcp_unlocker to fetch Google search results synchronously.
 */
async function googleSearch(query, apiKey) {
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us&num=10`;

  console.log(`[Sentinel] Google search via Web Unlocker: ${query}`);
  const res = await fetch(`${apiBase()}/request`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ zone: 'mcp_unlocker', url: googleUrl, format: 'raw' })
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => res.statusText);
    throw new Error(`Google search ${res.status}: ${errBody}`);
  }

  const html = await res.text();
  console.log(`[Sentinel] Google search returned ${html.length} chars`);

  if (!html || html.length < 500) return { organic: [] };

  // Extract links from Google search results HTML
  const results = [];
  const seen = new Set();

  // Google wraps organic results in /url?q= redirects
  const redirectPattern = /\/url\?q=(https?:\/\/[^&"']+)/g;
  let match;
  while ((match = redirectPattern.exec(html)) !== null) {
    const url = decodeURIComponent(match[1]);
    if (!seen.has(url) &&
        !url.includes('google.') && !url.includes('gstatic.') &&
        !url.includes('googleapis.') && !url.includes('schema.org') &&
        !url.includes('w3.org') && !url.includes('youtube.com/results')) {
      seen.add(url);
      results.push({ link: url, title: '', description: '' });
    }
  }

  // Fallback: direct href links (some Google responses skip redirects)
  if (results.length === 0) {
    const directPattern = /href="(https?:\/\/(?!(?:www\.)?google\.|gstatic\.|googleapis\.|accounts\.google\.|support\.google\.)[^"]+)"/g;
    while ((match = directPattern.exec(html)) !== null) {
      const url = decodeURIComponent(match[1]);
      if (!seen.has(url)) {
        seen.add(url);
        results.push({ link: url, title: '', description: '' });
      }
    }
  }

  // Extract text snippets for descriptions (best-effort)
  const snippetPattern = /<span[^>]*>([^<]{50,400})<\/span>/g;
  const snippets = [];
  while ((match = snippetPattern.exec(html)) !== null) {
    const text = match[1].replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
    if (text.length >= 50 && !text.includes('{') && !text.includes('function') && !text.includes('var ')) {
      snippets.push(text);
    }
  }
  for (let i = 0; i < results.length && i < snippets.length; i++) {
    results[i].description = snippets[i];
  }

  console.log(`[Sentinel] Google search extracted ${results.length} links`);
  return { organic: results };
}

async function findTripAdvisorUrl(name, apiKey) {
  const data = await googleSearch(`${name} Montgomery AL site:tripadvisor.com`, apiKey);
  const match = (data.organic || []).find(r =>
    r.link?.includes('tripadvisor.com/Restaurant_Review') ||
    r.link?.includes('tripadvisor.com/Restaurant-') ||
    r.link?.includes('tripadvisor.com')
  );
  return match?.link || null;
}

async function findYelpUrl(name, apiKey) {
  const data = await googleSearch(`${name} Montgomery AL site:yelp.com`, apiKey);
  const match = (data.organic || []).find(r =>
    r.link?.includes('yelp.com/biz/')
  );
  return match?.link || null;
}

async function searchGoogleReviews(name, apiKey) {
  const data = await googleSearch(`${name} Montgomery AL restaurant reviews`, apiKey);
  return parseGoogleSERP(data.organic || []);
}