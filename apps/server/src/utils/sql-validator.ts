/**
 * SQL Validator and Query Rewriter
 * Validates and sanitizes SQL queries for employee search
 * Ensures only safe SELECT queries are executed
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedSQL?: string;
  warnings?: string[];
}

/**
 * Allowed table names (whitelist)
 */
const ALLOWED_TABLES = ['employees'];

/**
 * Disallowed table names that should trigger an error
 */
const DISALLOWED_TABLES = ['users']; // 'users' table is for system accounts, not employees

/**
 * Dangerous SQL keywords that should be rejected
 */
const DANGEROUS_KEYWORDS = [
  'DROP',
  'DELETE',
  'UPDATE',
  'INSERT',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'EXEC',
  'EXECUTE',
  'CALL',
  'GRANT',
  'REVOKE',
];

/**
 * Validate SQL query for employee search
 * Only allows SELECT statements on the employees table
 */
export function validateEmployeeSearchSQL(
  sql: string,
  options: {
    maxLimit?: number;
    defaultLimit?: number;
    requireLimit?: boolean;
  } = {}
): ValidationResult {
  const {
    maxLimit = 100,
    defaultLimit = 25,
    requireLimit = true,
  } = options;

  try {
    // Normalize SQL: trim and remove extra whitespace
    const normalizedSQL = sql.trim().replace(/\s+/g, ' ');

    // Check for empty SQL
    if (!normalizedSQL) {
      return {
        isValid: false,
        error: 'SQL query cannot be empty',
      };
    }

    // Check for dangerous keywords (case-insensitive)
    const upperSQL = normalizedSQL.toUpperCase();
    for (const keyword of DANGEROUS_KEYWORDS) {
      // Use word boundaries to avoid false positives (e.g., "SELECT" shouldn't match "SELECTED")
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(normalizedSQL)) {
        return {
          isValid: false,
          error: `Dangerous SQL keyword detected: ${keyword}. Only SELECT queries are allowed.`,
        };
      }
    }

    // Must start with SELECT (case-insensitive)
    if (!/^\s*SELECT\s+/i.test(normalizedSQL)) {
      return {
        isValid: false,
        error: 'Only SELECT queries are allowed',
      };
    }

    // Check for table name (must be employees)
    // Extract table name from FROM clause
    const fromMatch = normalizedSQL.match(/\bFROM\s+(\w+)/i);
    if (!fromMatch) {
      return {
        isValid: false,
        error: 'SQL query must include a FROM clause',
      };
    }

    const tableName = fromMatch[1].toLowerCase();
    
    // Check for disallowed tables first (with helpful error message)
    if (DISALLOWED_TABLES.includes(tableName)) {
      return {
        isValid: false,
        error: `Cannot query the "${tableName}" table. The "${tableName}" table is for system user accounts, not employees. Please use the "employees" table instead.`,
      };
    }
    
    // Check if table is in allowed list
    if (!ALLOWED_TABLES.includes(tableName)) {
      return {
        isValid: false,
        error: `Table "${tableName}" is not allowed. Only queries on the "employees" table are permitted.`,
      };
    }

    // Check for LIMIT clause
    const limitMatch = normalizedSQL.match(/\bLIMIT\s+(\d+)/i);
    const hasLimit = !!limitMatch;

    if (requireLimit && !hasLimit) {
      // Auto-inject LIMIT if missing
      const sanitizedSQL = addLimitClause(normalizedSQL, defaultLimit);
      return {
        isValid: true,
        sanitizedSQL,
        warnings: [`LIMIT clause was automatically added (${defaultLimit})`],
      };
    }

    // Validate LIMIT value if present
    if (hasLimit) {
      const limitValue = parseInt(limitMatch![1], 10);
      if (isNaN(limitValue) || limitValue <= 0) {
        return {
          isValid: false,
          error: 'LIMIT value must be a positive integer',
        };
      }
      if (limitValue > maxLimit) {
        // Cap the limit to maxLimit
        const sanitizedSQL = normalizedSQL.replace(
          /\bLIMIT\s+\d+/i,
          `LIMIT ${maxLimit}`
        );
        return {
          isValid: true,
          sanitizedSQL,
          warnings: [`LIMIT was capped to ${maxLimit} (requested: ${limitValue})`],
        };
      }
    }

    // Check for OFFSET clause
    const offsetMatch = normalizedSQL.match(/\bOFFSET\s+(\d+)/i);
    if (offsetMatch) {
      const offsetValue = parseInt(offsetMatch[1], 10);
      if (isNaN(offsetValue) || offsetValue < 0) {
        return {
          isValid: false,
          error: 'OFFSET value must be a non-negative integer',
        };
      }
    }

    // Prevent SELECT * on large tables (optional safety check)
    if (/\bSELECT\s+\*/i.test(normalizedSQL)) {
      // Allow SELECT * but log a warning
      return {
        isValid: true,
        sanitizedSQL: normalizedSQL,
        warnings: ['SELECT * is allowed but consider selecting specific columns for better performance'],
      };
    }

    return {
      isValid: true,
      sanitizedSQL: normalizedSQL,
    };
  } catch (error: any) {
    return {
      isValid: false,
      error: `SQL validation error: ${error.message}`,
    };
  }
}

/**
 * Add LIMIT clause to SQL query if missing
 */
function addLimitClause(sql: string, limit: number): string {
  // Check if LIMIT already exists
  if (/\bLIMIT\s+\d+/i.test(sql)) {
    return sql;
  }

  // Add LIMIT before any semicolon or at the end
  if (sql.endsWith(';')) {
    return sql.slice(0, -1) + ` LIMIT ${limit};`;
  }
  return sql + ` LIMIT ${limit}`;
}

/**
 * Extract pagination parameters from SQL query
 */
export function extractPaginationParams(sql: string): {
  limit: number;
  offset: number;
} {
  const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i);
  const offsetMatch = sql.match(/\bOFFSET\s+(\d+)/i);

  const limit = limitMatch ? parseInt(limitMatch[1], 10) : 25;
  const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;

  return { limit, offset };
}

/**
 * Rewrite SQL query with pagination parameters
 */
export function rewriteSQLWithPagination(
  sql: string,
  page: number,
  pageSize: number
): string {
  const offset = (page - 1) * pageSize;

  // Remove existing LIMIT and OFFSET
  let rewritten = sql.replace(/\bLIMIT\s+\d+/gi, '');
  rewritten = rewritten.replace(/\bOFFSET\s+\d+/gi, '');

  // Add new LIMIT and OFFSET
  rewritten = rewritten.trim();
  if (rewritten.endsWith(';')) {
    rewritten = rewritten.slice(0, -1);
  }

  return `${rewritten} LIMIT ${pageSize} OFFSET ${offset}`;
}

/**
 * Log SQL query for auditing
 */
export function logSQLQuery(
  sql: string,
  metadata?: {
    userId?: string;
    userQuery?: string;
    timestamp?: Date;
  }
): void {
  const logEntry = {
    timestamp: (metadata?.timestamp || new Date()).toISOString(),
    sql,
    userId: metadata?.userId,
    userQuery: metadata?.userQuery,
  };

  // Log to console (in production, this should go to a proper logging service)
  console.log('[SQL Query Audit]', JSON.stringify(logEntry));
}
