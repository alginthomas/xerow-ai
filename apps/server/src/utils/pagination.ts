/**
 * Cursor-based pagination utilities
 */

export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total?: number;
    has_next: boolean;
    next_cursor: string | null;
  };
}

export function parsePaginationParams(query: {
  cursor?: string;
  limit?: string;
}): PaginationParams {
  return {
    cursor: query.cursor || undefined,
    limit: Math.min(Math.max(parseInt(query.limit || '20', 10) || 20, 1), 100),
  };
}

export function encodeCursor(id: string, timestamp?: string): string {
  const payload = timestamp ? `${id}|${timestamp}` : id;
  return Buffer.from(payload).toString('base64url');
}

export function decodeCursor(cursor: string): { id: string; timestamp?: string } {
  const payload = Buffer.from(cursor, 'base64url').toString('utf-8');
  const parts = payload.split('|');
  return { id: parts[0], timestamp: parts[1] };
}

export function buildPaginatedResult<T extends { id?: string; [key: string]: any }>(
  rows: T[],
  limit: number,
  idField: string = 'id',
  timestampField?: string
): PaginatedResult<T> {
  const has_next = rows.length > limit;
  const data = has_next ? rows.slice(0, limit) : rows;
  const lastItem = data[data.length - 1];

  return {
    data,
    meta: {
      has_next,
      next_cursor: has_next && lastItem
        ? encodeCursor(
            String(lastItem[idField]),
            timestampField ? String(lastItem[timestampField]) : undefined
          )
        : null,
    },
  };
}
