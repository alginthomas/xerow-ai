/**
 * Format a date as relative time (e.g., "2h ago", "Yesterday", "3 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffInMs = now.getTime() - then.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  // Just now (less than 1 minute)
  if (diffInSeconds < 60) {
    return 'Just now';
  }

  // Minutes ago
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  // Hours ago
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  // Yesterday
  if (diffInDays === 1) {
    return 'Yesterday';
  }

  // Days ago (up to 7 days)
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  // Weeks ago
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  // Months ago
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  // Years ago
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}
