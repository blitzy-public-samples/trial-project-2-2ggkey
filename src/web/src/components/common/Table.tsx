/**
 * @fileoverview A highly accessible, responsive, and themeable table component implementing Material Design principles
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { Pagination } from './Pagination';
import { LoadingSpinner } from './LoadingSpinner';
import { useTheme } from '../../hooks/useTheme';
import { PaginatedResponse, SortOrder } from '../../types/common.types';

import styles from './Table.module.css';

// Interfaces
export interface TableColumn<T> {
  key: string;
  header: string | React.ReactNode;
  accessor: (row: T) => any;
  sortable?: boolean;
  width?: string;
  priority?: number;
  cellRenderer?: (value: any, row: T) => React.ReactNode;
  ariaLabel?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  isLoading?: boolean;
  pagination?: PaginatedResponse<T>;
  onPageChange: (page: number) => void;
  onSort?: (key: string, order: SortOrder) => void;
  onRowClick?: (row: T) => void;
  className?: string;
  ariaLabel?: string;
  virtualScroll?: boolean;
}

/**
 * Enhanced table component with accessibility, responsive design, and theme integration
 */
export const Table = React.memo(<T extends Record<string, any>>(props: TableProps<T>) => {
  const {
    data,
    columns,
    isLoading,
    pagination,
    onPageChange,
    onSort,
    onRowClick,
    className,
    ariaLabel = 'Data table',
    virtualScroll = false
  } = props;

  const { currentTheme, isDarkMode } = useTheme();
  const [sortConfig, setSortConfig] = useState<{ key: string; order: SortOrder } | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const tableRef = useRef<HTMLTableElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);

  // Virtual scrolling state
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Memoized visible data for virtual scrolling
  const visibleData = useMemo(() => {
    if (!virtualScroll) return data;
    return data.slice(visibleRange.start, visibleRange.end);
  }, [data, virtualScroll, visibleRange]);

  // Setup virtual scrolling observer
  useEffect(() => {
    if (virtualScroll && tableRef.current) {
      observerRef.current = new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const newEnd = Math.min(visibleRange.end + 20, data.length);
              setVisibleRange(prev => ({ ...prev, end: newEnd }));
            }
          });
        },
        { root: tableRef.current, threshold: 0.5 }
      );

      return () => observerRef.current?.disconnect();
    }
  }, [virtualScroll, data.length]);

  // Announce sort changes to screen readers
  const announceSort = useCallback((column: TableColumn<T>, order: SortOrder) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = `Table sorted by ${column.header} in ${order} order`;
    }
  }, []);

  // Handle sort column click
  const handleSort = useCallback((column: TableColumn<T>) => {
    if (!column.sortable || !onSort) return;

    const newOrder = sortConfig?.key === column.key && sortConfig.order === SortOrder.ASC
      ? SortOrder.DESC
      : SortOrder.ASC;

    setSortConfig({ key: column.key, order: newOrder });
    onSort(column.key, newOrder);
    announceSort(column, newOrder);
  }, [sortConfig, onSort, announceSort]);

  // Keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTableElement>) => {
    const { key } = event;
    
    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedRowIndex(prev => Math.min(prev + 1, data.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedRowIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedRowIndex >= 0 && onRowClick) {
          onRowClick(data[focusedRowIndex]);
        }
        break;
      default:
        break;
    }
  }, [data, focusedRowIndex, onRowClick]);

  // Container classes
  const containerClasses = classNames(
    styles.table__container,
    {
      [styles['table__container--virtual']]: virtualScroll,
      [styles['table__container--dark']]: isDarkMode
    },
    className
  );

  return (
    <div className={containerClasses}>
      {/* Screen reader announcer */}
      <div
        ref={announcerRef}
        className={styles.table__announcement}
        role="status"
        aria-live="polite"
      />

      <div className={styles.table__wrapper} role="region" aria-label={ariaLabel}>
        <table
          ref={tableRef}
          className={styles.table}
          onKeyDown={handleKeyDown}
          role="grid"
          aria-busy={isLoading}
          data-theme={currentTheme}
        >
          <thead className={styles.table__header}>
            <tr role="row">
              {columns.map(column => (
                <th
                  key={column.key}
                  className={classNames(styles.table__header_cell, {
                    [styles['table__header_cell--sortable']]: column.sortable,
                    [styles['table__header_cell--sorted']]: sortConfig?.key === column.key,
                    [styles['table__header_cell--hidden']]: column.priority && window.innerWidth < 768
                  })}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column)}
                  role="columnheader"
                  aria-sort={
                    sortConfig?.key === column.key
                      ? sortConfig.order === SortOrder.ASC
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                  aria-label={column.ariaLabel || String(column.header)}
                >
                  {column.header}
                  {column.sortable && (
                    <span className={styles.table__sort_indicator} aria-hidden="true">
                      {sortConfig?.key === column.key
                        ? sortConfig.order === SortOrder.ASC
                          ? '↑'
                          : '↓'
                        : '↕'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className={styles.table__body}>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className={styles.table__loading}>
                  <LoadingSpinner size="medium" />
                </td>
              </tr>
            ) : visibleData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={styles.table__empty}>
                  No data available
                </td>
              </tr>
            ) : (
              visibleData.map((row, index) => (
                <tr
                  key={index}
                  className={classNames(styles.table__row, {
                    [styles['table__row--clickable']]: !!onRowClick,
                    [styles['table__row--focused']]: index === focusedRowIndex
                  })}
                  onClick={() => onRowClick?.(row)}
                  onFocus={() => setFocusedRowIndex(index)}
                  tabIndex={0}
                  role="row"
                  aria-selected={index === focusedRowIndex}
                >
                  {columns.map(column => (
                    <td
                      key={column.key}
                      className={classNames(styles.table__cell, {
                        [styles['table__cell--hidden']]: column.priority && window.innerWidth < 768
                      })}
                      role="gridcell"
                    >
                      {column.cellRenderer
                        ? column.cellRenderer(column.accessor(row), row)
                        : column.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className={styles.table__pagination}>
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalItems={pagination.total}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
});

Table.displayName = 'Table';

export default Table;