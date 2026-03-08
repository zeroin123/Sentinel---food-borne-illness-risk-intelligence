// Illness keyword tiers with weights for review analysis
export const KEYWORD_TIERS = {
  T1: {
    weight: 3.0,
    label: 'Severe',
    color: '#C0392B',
    keywords: [
      'food poisoning', 'salmonella', 'e. coli', 'e.coli', 'norovirus',
      'health department', 'hospitalized', 'hospitalised', 'er visit',
      'emergency room', 'listeria', 'botulism', 'hepatitis'
    ]
  },
  T2: {
    weight: 2.0,
    label: 'Moderate',
    color: '#E67E22',
    keywords: [
      'vomiting', 'diarrhea', 'diarrhoea', 'stomach cramps', 'nausea',
      'sick after eating', 'got sick', 'made me sick', 'violently ill',
      'food borne', 'foodborne', 'threw up', 'throwing up'
    ]
  },
  T3: {
    weight: 1.0,
    label: 'Low',
    color: '#F39C12',
    keywords: [
      'stomach ache', 'stomachache', 'felt unwell', 'not fresh',
      'undercooked', 'raw chicken', 'raw meat', 'smells bad',
      'dirty kitchen', 'unsanitary', 'unclean', 'expired',
      'moldy', 'mouldy', 'bugs', 'cockroach', 'roach', 'rodent',
      'hair in food', 'upset stomach'
    ]
  }
};

/**
 * Extract illness signals from review text
 * Returns array of { keyword, tier, weight }
 */
export function extractIllnessSignals(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const signals = [];
  const found = new Set();

  for (const [tier, config] of Object.entries(KEYWORD_TIERS)) {
    for (const keyword of config.keywords) {
      if (lower.includes(keyword) && !found.has(keyword)) {
        found.add(keyword);
        signals.push({
          keyword,
          tier,
          weight: config.weight,
          color: config.color,
          label: config.label
        });
      }
    }
  }

  return signals;
}
