// Pure helpers for the Crew Feed (ES module, unit-tested in tests/crew-utils.test.js).

export const KINDS = {
  tip: { label: '💡 Tip', placeholder: 'The Dole Whip line is short right after the fireworks…' },
  review: { label: '⭐ Review', placeholder: 'How was it? Worth the hype?' },
  plan: { label: '📅 Plan', placeholder: 'Who wants to hit Cars Land for churros at 2pm Saturday?' },
  question: { label: '❓ Question', placeholder: 'Anyone tried the new holiday beignets yet?' },
};

// Must agree with validInvite() in firestore.rules.
export const EMAIL_RE = /^[^@\s/]+@[^@\s/]+\.[^@\s/]+$/;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function relTime(date, now = new Date()) {
  const s = Math.round((now - date) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24);
  if (d < 7) return d + 'd ago';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

const PALETTE = ['#1b2a4a', '#0f6b6b', '#6b3fa0', '#a63d40', '#b8861f', '#2d4373', '#c0507a', '#2a8a3e'];
export function colorFor(name) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// Labels are "Item name @ Restaurant"; the food list searches by item name.
export function itemSearchHref(label) {
  const name = String(label || '').split(' @ ')[0].trim();
  return '/?q=' + encodeURIComponent(name);
}

export function shareHref(key, name, loc) {
  const label = loc ? `${name} @ ${loc}` : name;
  return '/crew.html?item=' + encodeURIComponent(key) + '&label=' + encodeURIComponent(label);
}

// mailto: link that opens the admin's own email app with an invite drafted.
export function inviteMailto(email, { name = '', from = '', url = '' } = {}) {
  const hi = name ? `Hi ${name}!` : 'Hi!';
  const subject = "You're invited to our Disneyland food crew 🏰";
  const body = [
    hi,
    '',
    `${from || 'I'} added you to our Crew Feed for sharing Disneyland food tips, reviews and plans.`,
    '',
    `Open ${url} and sign in with Google using this account: ${email}`,
    '',
    'See you in the parks! ✨',
  ].join('\n');
  return 'mailto:' + encodeURIComponent(email)
    + '?subject=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(body);
}
