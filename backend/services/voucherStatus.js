export function normalizePostingState(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'posted'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'draft'].includes(normalized)) return false;
  }
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return Boolean(value);
}

export function buildPostedOnlyClause(existingClause = '') {
  const clause = existingClause?.trim() || '';
  if (!clause) return 'AND v.is_posted = TRUE';
  return `${clause} AND v.is_posted = TRUE`;
}

export function buildPostingUpdateValues(isPosted, userId = null, postedAt = new Date()) {
  const shouldPost = normalizePostingState(isPosted);
  return {
    is_posted: shouldPost,
    posted_by: shouldPost ? userId ?? null : null,
    posted_at: shouldPost ? postedAt : null,
  };
}
