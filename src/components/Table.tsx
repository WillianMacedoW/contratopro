import React from 'react';
import './Table.css';

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function Table<T>({ data, columns, keyExtractor, onRowClick, emptyMessage = 'Nenhum dado encontrado' }: TableProps<T>) {
  return (
    <div className="table-container">
      <table className="app-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.tagName === 'INPUT' || target.closest('input')) return;
                  onRowClick && onRowClick(item);
                }}
                className={onRowClick ? 'clickable-row' : ''}
              >
                {columns.map((col, idx) => (
                  <td key={idx}>
                    {col.cell ? col.cell(item) : col.accessorKey ? String(item[col.accessorKey]) : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
