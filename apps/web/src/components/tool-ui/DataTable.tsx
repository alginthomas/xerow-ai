/**
 * Data Table Component (Tool UI)
 * A simplified data table component following Tool UI patterns
 * For full implementation, see: https://www.tool-ui.com/docs/components/data-table
 */

import React from 'react';
import { Card } from '../../app/components/ui/card';
import { Badge } from '../../app/components/ui/badge';
import type { SerializableDataTable } from '../../lib/tool-ui/schemas';
import { ResponseActionsComponent } from './ResponseActions';

interface DataTableProps extends SerializableDataTable {
  maxWidth?: string;
  onResponseAction?: (actionId: string) => void;
  onBeforeResponseAction?: (actionId: string) => boolean | Promise<boolean>;
}

export function DataTable({ 
  id, 
  title, 
  description, 
  columns, 
  rows, 
  pagination,
  responseActions,
  maxWidth = '100%',
  onResponseAction,
  onBeforeResponseAction,
}: DataTableProps) {
  return (
    <Card className="my-4 p-4" style={{ maxWidth }}>
      {title && (
        <div className="mb-3">
          <h3 className="text-base font-semibold">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b">
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="px-4 py-2 text-left text-sm font-medium text-muted-foreground"
                  style={{ textAlign: column.align || 'left' }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-muted/50">
                {columns.map((column) => {
                  const cellValue = row.cells[column.id];
                  return (
                    <td
                      key={column.id}
                      className="px-4 py-2 text-sm"
                      style={{ textAlign: column.align || 'left' }}
                    >
                      {renderCell(cellValue, column.type)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="mt-4 text-sm text-muted-foreground">
          Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{' '}
          {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
          {pagination.total} results
        </div>
      )}

      {responseActions && (
        <ResponseActionsComponent
          responseActions={responseActions}
          onResponseAction={onResponseAction}
          onBeforeResponseAction={onBeforeResponseAction}
        />
      )}
    </Card>
  );
}

function renderCell(value: any, type?: string) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  switch (type) {
    case 'currency':
      return typeof value === 'number' 
        ? `$${value.toFixed(2)}` 
        : `$${value}`;
    
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : value;
    
    case 'badge':
      return <Badge variant="secondary">{String(value)}</Badge>;
    
    case 'image':
      return typeof value === 'string' ? (
        <img src={value} alt="" className="h-12 w-12 object-cover rounded" />
      ) : null;
    
    default:
      return <span>{String(value)}</span>;
  }
}

/**
 * Error boundary for Data Table
 */
export function DataTableErrorBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
