/**
 * Shared UI helper functions used across multiple pages.
 */

/** Generate initials from a name string */
export const getInitials = (name: string): string => {
  if (!name || name === '-') return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Generate a consistent avatar color class from a name */
export const getAvatarColor = (name: string): string => {
  const colors = [
    'bg-blue-500/20 text-blue-400',
    'bg-emerald-500/20 text-emerald-400',
    'bg-amber-500/20 text-amber-400',
    'bg-purple-500/20 text-purple-400',
    'bg-rose-500/20 text-rose-400',
    'bg-cyan-500/20 text-cyan-400',
    'bg-orange-500/20 text-orange-400',
    'bg-indigo-500/20 text-indigo-400',
  ];
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/** Decode HTML entities in a string */
export const decodeHtmlEntities = (text: string): string => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};
