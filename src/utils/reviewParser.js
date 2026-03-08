import dayjs from 'dayjs';
import { extractIllnessSignals } from './keywords.js';

// ── HTML → plain text ──────────────────────────────────────────
// Web Unlocker / Browser API returns raw HTML; strip tags before parsing.

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isHtml(content) {
  return content.includes('<html') || content.includes('<div') || content.includes('<span');
}

function prepareContent(content) {
  if (!content) return '';
  return isHtml(content) ? stripHtml(content) : content;
}

// ── JSON/LD+JSON extraction from HTML ──────────────────────────
// TripAdvisor and Yelp embed structured review data in <script> tags.
// This is the most reliable way to get reviews from raw HTML.

function extractLdJsonReviews(html, source) {
  const reviews = [];
  // Find all <script type="application/ld+json"> blocks
  const ldPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = ldPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        // Look for Review objects or objects containing review arrays
        const revs = item.review || item.reviews || [];
        const revArray = Array.isArray(revs) ? revs : [revs];
        for (const r of revArray) {
          if (!r || r['@type'] !== 'Review') continue;
          const text = r.reviewBody || r.description || '';
          if (text.length < 15) continue;
          const rating = r.reviewRating?.ratingValue
            ? parseInt(r.reviewRating.ratingValue)
            : null;
          const author = r.author?.name || r.author || 'Anonymous';
          let dateStr = null;
          if (r.datePublished) {
            const d = dayjs(r.datePublished);
            if (d.isValid()) dateStr = d.format('YYYY-MM-DD');
          }
          reviews.push({
            author: typeof author === 'string' ? author : 'Anonymous',
            rating,
            date: dateStr,
            text,
            source,
            demo: false,
            illnessSignals: extractIllnessSignals(text)
          });
        }
      }
    } catch { /* skip malformed JSON-LD */ }
  }
  return reviews;
}

function extractEmbeddedJsonReviews(html, source) {
  const reviews = [];
  // Find <script type="application/json"> blocks that might contain reviews
  const jsonPattern = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      // Recursively search for review-like objects
      findReviewsInObject(data, reviews, source);
    } catch { /* skip */ }
  }
  return reviews;
}

function findReviewsInObject(obj, results, source, depth = 0) {
  if (depth > 6 || !obj || typeof obj !== 'object') return;
  if (results.length >= 20) return; // cap to avoid runaway recursion

  // Check if this object looks like a review
  if (obj.text && (obj.rating || obj.stars)) {
    const text = typeof obj.text === 'string' ? obj.text : (obj.text?.full || '');
    if (text.length >= 20) {
      const rating = parseInt(obj.rating) || parseInt(obj.stars) || null;
      const author = obj.user?.name || obj.author?.name || obj.userName || 'Anonymous';
      let dateStr = null;
      const dateRaw = obj.date || obj.time_created || obj.localizedDate;
      if (dateRaw) {
        const d = dayjs(dateRaw);
        if (d.isValid()) dateStr = d.format('YYYY-MM-DD');
      }
      results.push({
        author: typeof author === 'string' ? author : 'Anonymous',
        rating,
        date: dateStr,
        text,
        source,
        demo: false,
        illnessSignals: extractIllnessSignals(text)
      });
      return;
    }
  }

  // Also check for "comment" field (Yelp uses comment.text)
  if (obj.comment?.text && obj.rating) {
    const text = obj.comment.text;
    if (text.length >= 20) {
      results.push({
        author: obj.user?.name || 'Yelp User',
        rating: parseInt(obj.rating) || null,
        date: obj.time_created ? dayjs(obj.time_created).format('YYYY-MM-DD') : null,
        text,
        source,
        demo: false,
        illnessSignals: extractIllnessSignals(text)
      });
      return;
    }
  }

  // Recurse into arrays and objects
  if (Array.isArray(obj)) {
    for (const item of obj.slice(0, 50)) findReviewsInObject(item, results, source, depth + 1);
  } else {
    for (const key of Object.keys(obj)) {
      if (/review|comment/i.test(key)) {
        findReviewsInObject(obj[key], results, source, depth + 1);
      }
    }
  }
}

// ── TripAdvisor Parser ─────────────────────────────────────────
// Handles both raw HTML (from Web Unlocker) and markdown formats.
// Key anchor patterns that survive both formats:
//   - "N of 5 bubbles"  (rating)
//   - "Written Month DD, YYYY"  (date anchor)
//   - "[Author](/Profile/..."  (markdown author link)

export function parseTripAdvisorMarkdown(content) {
  if (!content) return [];

  // Strategy 1: Extract from LD+JSON / embedded JSON (most reliable for HTML)
  if (isHtml(content)) {
    const jsonReviews = [
      ...extractLdJsonReviews(content, 'TripAdvisor'),
      ...extractEmbeddedJsonReviews(content, 'TripAdvisor')
    ];
    if (jsonReviews.length > 0) {
      console.log(`[Sentinel] TripAdvisor: ${jsonReviews.length} reviews from embedded JSON`);
      return jsonReviews;
    }
  }

  // Strategy 2: Text pattern matching (for markdown or stripped HTML)
  const text = prepareContent(content);
  const reviews = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Rating anchor: "4 of 5 bubbles" — skip sub-ratings and aggregate rows
    const ratingMatch = line.match(/^(\d)\s+of\s+5\s+bubbles$/i) ||
                        line.match(/(\d)\s+of\s+5\s+bubbles/i);
    if (ratingMatch &&
        !line.includes('Average') && !line.includes('Service') &&
        !line.includes('Food') && !line.includes('Value') && !line.includes('Atmosphere')) {
      const rating = parseInt(ratingMatch[1]);

      // Author: look back up to 8 lines
      let author = 'TripAdvisor User';
      for (let j = Math.max(0, i - 8); j < i; j++) {
        const l = lines[j];
        // Markdown link pattern: [Name](/Profile/...)
        const mdMatch = l.match(/\[([^\]]+)\]\(\/Profile\//);
        if (mdMatch) { author = mdMatch[1].trim(); break; }
        // Plain text: capitalised short name not containing noise words
        if (l.length > 2 && l.length < 50 &&
            /^[A-Z]/.test(l) &&
            !l.match(/^\d/) &&
            !/(bubble|review|photo|contribution|helpful|written|rating|location|more)/i.test(l)) {
          author = l;
          break;
        }
      }

      // Collect title, review body, date — scan forward up to 60 lines
      let title = '';
      let dateStr = null;
      let textLines = [];
      let foundEnd = false;

      for (let j = i + 1; j < Math.min(i + 60, lines.length); j++) {
        const fl = lines[j];

        // Markdown title link
        const titleMatch = fl.match(/\[([^\]]+)\]\(\/ShowUserReviews/);
        if (titleMatch && !title) { title = titleMatch[1].trim(); continue; }

        // Date anchor: "Written Month DD, YYYY"
        const writtenMatch = fl.match(/Written\s+(\w+\s+\d{1,2},?\s*\d{4})/i);
        if (writtenMatch) {
          const d = dayjs(writtenMatch[1]);
          if (d.isValid()) dateStr = d.format('YYYY-MM-DD');
          foundEnd = true;
          i = j + 1;
          break;
        }

        // Skip noise
        if (/^(Read more|This review|Review collected|This business|Insider tip|Helpful\?|More|See all)/i.test(fl) ||
            fl.match(/^\d+\.\d+ of 5 bubbles/i) ||
            fl.match(/^(Value|Service|Food|Atmosphere|Location|Cleanliness)$/i) ||
            fl.match(/^\[/) ||
            fl.match(/^\d+ contribution/) ||
            fl.includes('©') || fl.includes('Terms of Use') ||
            fl.trim() === '') continue;

        if (fl.length > 20) textLines.push(fl);
      }

      if (!foundEnd) { i++; continue; }

      const reviewText = (title ? title + '. ' : '') + textLines.slice(0, 8).join(' ');
      if (reviewText.length >= 15) {
        reviews.push({
          author, rating, date: dateStr,
          text: reviewText,
          source: 'TripAdvisor',
          demo: false,
          illnessSignals: extractIllnessSignals(reviewText)
        });
      }
      continue;
    }
    i++;
  }

  return reviews;
}

// ── Yelp Parser ────────────────────────────────────────────────
// Handles both raw HTML and markdown formats.
// Key anchor patterns:
//   - "N star rating"  (rating, works in both formats)
//   - date patterns after rating

export function parseYelpMarkdown(content) {
  if (!content) return [];

  // Strategy 1: Extract from LD+JSON / embedded JSON (most reliable for HTML)
  if (isHtml(content)) {
    const jsonReviews = [
      ...extractLdJsonReviews(content, 'Yelp'),
      ...extractEmbeddedJsonReviews(content, 'Yelp')
    ];
    if (jsonReviews.length > 0) {
      console.log(`[Sentinel] Yelp: ${jsonReviews.length} reviews from embedded JSON`);
      return jsonReviews;
    }
  }

  // Strategy 2: Text pattern matching (for markdown or stripped HTML)
  const text = prepareContent(content);
  const reviews = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Rating anchor: "4 star rating" or aria-label="4 star rating"
    const starMatch = line.match(/(\d)\s*star\s*rating/i) ||
                      line.match(/aria-label="(\d)\s*star/i);
    if (starMatch) {
      const rating = parseInt(starMatch[1]);

      // Author: look back up to 6 lines for a short name-like string
      let author = 'Yelp User';
      for (let j = Math.max(0, i - 6); j < i; j++) {
        const l = lines[j].trim();
        if (l.length > 2 && l.length < 50 &&
            !l.match(/^\d/) &&
            !/(star|review|photo|elite|useful|funny|cool|location|follow)/i.test(l)) {
          author = l;
          break;
        }
      }

      // Look forward for date + review text
      let dateStr = null;
      let textLines = [];

      for (let j = i + 1; j < Math.min(i + 35, lines.length); j++) {
        const fl = lines[j].trim();

        // Date: "1/15/2025", "Jan 15, 2025", "2025-01-15"
        if (!dateStr) {
          const dm = fl.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/) ||
                     fl.match(/^(\w{3,9}\s+\d{1,2},?\s*\d{4})/) ||
                     fl.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dm) {
            const d = dayjs(dm[1]);
            if (d.isValid()) dateStr = d.format('YYYY-MM-DD');
            continue;
          }
        }

        // Stop at next review
        if (fl.match(/\d\s*star\s*rating/i) || fl.match(/aria-label="\d\s*star/i)) {
          i = j - 1; break;
        }

        // Skip noise
        if (!fl || fl.length < 15 ||
            /^(Useful|Funny|Cool|Thanks|Love this|Oh no|Compliment)/i.test(fl) ||
            fl.includes('©') || fl.includes('Terms of Service')) continue;

        textLines.push(fl);
        if (j === Math.min(i + 34, lines.length - 1)) i = j;
      }

      const reviewText = textLines.slice(0, 6).join(' ').trim();
      if (reviewText.length >= 20) {
        reviews.push({
          author, rating, date: dateStr,
          text: reviewText,
          source: 'Yelp',
          demo: false,
          illnessSignals: extractIllnessSignals(reviewText)
        });
      }
    }
    i++;
  }

  return reviews;
}

// ── Google SERP Parser ─────────────────────────────────────────

export function parseGoogleSERP(results) {
  if (!results || !Array.isArray(results)) return [];
  return results
    .filter(r => r.description && r.description.length > 50)
    .filter(r => {
      // Only keep results that look like reviews
      const d = r.description.toLowerCase();
      return d.includes('review') || d.includes('food') || d.includes('restaurant') ||
             d.includes('eat') || d.includes('dinner') || d.includes('lunch') ||
             d.includes('service') || d.includes('meal');
    })
    .slice(0, 8)
    .map((r, i) => {
      const text = r.description.replace(/Read more$/i, '').trim();
      return {
        author: r.title ? r.title.split(/[-–|]/)[0].trim().slice(0, 30) : `Result ${i + 1}`,
        rating: null,
        date: null,
        text,
        source: 'Google',
        demo: false,
        illnessSignals: extractIllnessSignals(text)
      };
    });
}


// ── Mock Review Generator ──────────────────────────────────────

const POSITIVE = [
  "Great food and excellent service. The {dish} was perfectly cooked and the portions are very generous. Will definitely come back again soon!",
  "One of the best restaurants in Montgomery. The staff is friendly, the place is clean, and the food is always fresh and delicious.",
  "Had the {dish} and it was amazing. Quick service and reasonable prices. My family loves eating here on weekends.",
  "Solid experience every time we visit. Consistently good quality food and the atmosphere is pleasant.",
  "Really enjoy this spot. The {dish} never disappoints. Clean restaurant, nice staff, and the food comes out fast.",
  "Fantastic! Everything from the appetizers to the {dish} was perfectly seasoned. Highly recommended.",
  "Hidden gem in Montgomery. The {dish} is the best I've had in the area. Very reasonable prices for the quality.",
  "Always a great experience here. Food is fresh, service is prompt, and the prices are fair. The {dish} is my go-to order.",
  "Visited last week and had a wonderful meal. The {dish} was outstanding. Will be back with family soon."
];

const NEGATIVE = [
  "Disappointing visit. The food was cold and took forever to arrive. Won't be returning anytime soon.",
  "Not what it used to be. The quality has gone downhill significantly. The {dish} was overcooked and bland.",
  "Poor service and mediocre food. Had to wait 45 minutes for our meal and it was lukewarm when it finally arrived.",
  "Would not recommend. The restaurant was dirty, the food was tasteless, and the service was incredibly slow.",
  "Very underwhelming. The {dish} was dry and lacked any flavor. Staff seemed disinterested. Disappointing for the price."
];

const ILLNESS = [
  "Got food poisoning after eating the {dish}. Was vomiting for two days straight. Absolutely terrible experience.",
  "My whole family got sick after eating here. Stomach cramps and diarrhea that lasted 48 hours. Something is wrong with their kitchen.",
  "Ate the {dish} and within hours was experiencing severe nausea and vomiting. Had to go to the ER. Never going back.",
  "Felt unwell after dinner. Not fresh at all, the {dish} tasted undercooked. Woke up with terrible stomach ache the next morning.",
  "Sick after eating the {dish}. Threw up multiple times that night. The food smells bad and the kitchen looked dirty.",
  "I got sick after eating here. Stomach cramps started a few hours later. The {dish} seemed undercooked and not fresh at all.",
  "Three of us ate here and all got diarrhea and nausea within 24 hours. This place needs a health department visit.",
  "Left feeling nauseous. The {dish} was clearly undercooked and the restaurant smelled bad. Got violently ill later that night.",
  "Food poisoning from this place. Spent the whole night vomiting. The {dish} tasted off but I ate it anyway. Huge mistake."
];

const DISHES = [
  'fried chicken', 'burger', 'catfish', 'pulled pork', 'shrimp platter',
  'steak', 'pasta', 'ribs', 'grilled chicken', 'seafood gumbo',
  'brisket', 'chicken tenders', 'fish tacos', 'club sandwich', 'soup',
  'wings', 'mac and cheese', 'collard greens', 'cornbread', 'fried okra'
];

const NAMES = [
  'Sarah M', 'James K', 'Robert W', 'Linda T', 'Michael B', 'Patricia R',
  'David L', 'Jennifer H', 'Thomas S', 'Maria G', 'William C', 'Elizabeth A',
  'John P', 'Susan D', 'Chris N', 'Karen F', 'Daniel V', 'Nancy J',
  'Mark E', 'Jessica Q', 'Brian Z', 'Ashley O', 'Kevin I', 'Amanda U',
  'Ryan M', 'Donna B', 'Steven H', 'Angela W', 'Paul T', 'Kimberly R'
];

function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
function fill(tpl, rng) { return tpl.replace(/\{dish\}/g, pick(DISHES, rng)); }

export function generateMockReviews(establishment) {
  const seed = hashCode(establishment.name || 'x');
  const rng = seededRandom(seed);

  const count = 5 + Math.floor(rng() * 14); // 5-18 reviews
  const reviews = [];
  const score = parseFloat(establishment.score) || 90;

  // Illness probability based on score
  let illnessChance;
  if (score <= 1) illnessChance = 0.40;
  else if (score < 70) illnessChance = 0.35;
  else if (score < 80) illnessChance = 0.22;
  else if (score < 85) illnessChance = 0.15;
  else illnessChance = 0.10; // Good-score places still get some illness reviews (PIT candidates)

  const usedNames = new Set();

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(rng() * 400);
    const date = dayjs().subtract(daysAgo, 'day').format('YYYY-MM-DD');

    let author;
    do { author = pick(NAMES, rng); } while (usedNames.has(author) && usedNames.size < NAMES.length);
    usedNames.add(author);

    const roll = rng();
    let text, rating;

    if (roll < illnessChance) {
      text = fill(pick(ILLNESS, rng), rng);
      rating = 1;
    } else if (roll < illnessChance + 0.12) {
      text = fill(pick(NEGATIVE, rng), rng);
      rating = 1 + Math.floor(rng() * 2); // 1-2
    } else {
      text = fill(pick(POSITIVE, rng), rng);
      rating = 4 + Math.floor(rng() * 2); // 4-5
    }

    const sources = ['TripAdvisor', 'Google', 'Yelp'];
    reviews.push({
      author,
      rating,
      date,
      text,
      source: sources[Math.floor(rng() * sources.length)],
      demo: true,
      illnessSignals: extractIllnessSignals(text)
    });
  }

  return reviews.sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());
}

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function seededRandom(seed) {
  let s = seed || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
