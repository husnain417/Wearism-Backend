// src/services/nsfwFilter.js
// Synchronous — runs in <1ms. No external API needed for basic moderation.
// Replace or augment with a proper ML classifier in production.

// Blocked terms — expand this list based on your moderation policy
const BLOCKED_TERMS = [
    'nude', 'naked', 'pornography', 'explicit', 'nsfw',
    // add more as needed — keep the list in a separate config file for easy updates
];

// Flagged terms — allowed but marked for review
const FLAG_TERMS = [
    'sexy', 'lingerie', 'underwear', 'bikini',
];

const normalise = str => str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

/**
 * Check a single text string for blocked or flagged terms.
 * @param {string|null} text
 * @returns {{ blocked: boolean, flagged: boolean, reason: string|null }}
 */
export function checkContent(text) {
    if (!text) return { blocked: false, flagged: false, reason: null };

    const norm = normalise(text);
    const words = norm.split(/\s+/);

    for (const term of BLOCKED_TERMS) {
        if (norm.includes(term)) {
            return { blocked: true, flagged: true, reason: `Blocked term: ${term}` };
        }
    }

    for (const term of FLAG_TERMS) {
        if (words.includes(term)) {
            return { blocked: false, flagged: true, reason: `Flagged term: ${term}` };
        }
    }

    return { blocked: false, flagged: false, reason: null };
}

/**
 * Check a post's caption and tags together.
 * @param {{ caption?: string, tags?: string[] }} post
 * @returns {{ blocked: boolean, flagged: boolean, reason: string|null }}
 */
export function checkPost({ caption, tags = [] }) {
    const combined = [caption, ...tags].filter(Boolean).join(' ');
    return checkContent(combined);
}
