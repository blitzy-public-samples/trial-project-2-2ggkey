/**
 * @fileoverview A reusable, accessible pagination component implementing Material Design principles
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { Button } from './Button';
import { PaginatedResponse } from '../../types/common.types';

import styles from './Pagination.module.css';

export interface PaginationProps {
  /** Current active page number (1-based indexing) */
  currentPage: number;
  /** Total number of available pages */
  totalPages: number;
  /** Number of items displayed per page */
  pageSize: number;
  /** Total number of items in the dataset */
  totalItems: number;
  /** Callback function triggered on page change */
  onPageChange: (page: number) => void;
  /** Optional callback for page size changes */
  onPageSizeChange?: (pageSize: number) => void;
  /** Configurable array of available page sizes */
  pageSizeOptions?: number[];
  /** Toggle for page size selector visibility */
  showPageSizeSelector?: boolean;
  /** Optional additional CSS class for custom styling */
  className?: string;
  /** Customizable aria-label for accessibility */
  ariaLabel?: string;
  /** Text direction for RTL support */
  dir?: 'ltr' | 'rtl';
}

/**
 * Generates an array of page numbers with ellipsis for pagination display
 * @param currentPage - Current active page
 * @param totalPages - Total number of pages
 * @returns Array of page numbers and ellipsis indicators
 */
const getPageNumbers = (currentPage: number, totalPages: number): (number | string)[] => {
  const delta = 2; // Number of pages to show before and after current page
  const range: (number | string)[] = [];
  
  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 || // First page
      i === totalPages || // Last page
      (i >= currentPage - delta && i <= currentPage + delta) // Pages around current
    ) {
      range.push(i);
    } else if (range[range.length - 1] !== '...') {
      range.push('...');
    }
  }
  
  return range;
};

/**
 * A highly customizable pagination component with comprehensive accessibility support
 * and performance optimizations.
 */
export const Pagination = React.memo<PaginationProps>(({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  showPageSizeSelector = true,
  className,
  ariaLabel = 'Page navigation',
  dir = 'ltr'
}) => {
  // Validate input parameters
  if (currentPage < 1 || currentPage > totalPages) {
    console.warn('Invalid currentPage value in Pagination component');
  }

  // Memoize page numbers calculation
  const pageNumbers = useMemo(() => 
    getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  // Memoize range text for accessibility
  const rangeText = useMemo(() => {
    const start = (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);
    return `Showing ${start}-${end} of ${totalItems} items`;
  }, [currentPage, pageSize, totalItems]);

  // Debounced page change handler
  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  }, [currentPage, totalPages, onPageChange]);

  // Page size change handler
  const handlePageSizeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(event.target.value);
    onPageSizeChange?.(newSize);
  }, [onPageSizeChange]);

  // Generate container classes
  const containerClasses = classNames(
    styles.pagination__container,
    {
      [styles['pagination__container--rtl']]: dir === 'rtl'
    },
    className
  );

  return (
    <nav
      className={containerClasses}
      aria-label={ariaLabel}
      role="navigation"
      dir={dir}
    >
      {/* Page size selector */}
      {showPageSizeSelector && onPageSizeChange && (
        <div className={styles.pagination__size_selector}>
          <label htmlFor="pageSize">Items per page:</label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={handlePageSizeChange}
            aria-label="Select number of items per page"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Range information */}
      <div className={styles.pagination__info} aria-live="polite">
        {rangeText}
      </div>

      {/* Navigation buttons */}
      <div className={styles.pagination__controls} role="group" aria-label="Page navigation">
        {/* Previous page button */}
        <Button
          variant="outlined"
          size="small"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          ariaLabel="Previous page"
          className={styles.pagination__button}
        >
          {dir === 'ltr' ? '←' : '→'}
        </Button>

        {/* Page number buttons */}
        {pageNumbers.map((pageNum, index) => (
          pageNum === '...' ? (
            <span
              key={`ellipsis-${index}`}
              className={styles.pagination__ellipsis}
              aria-hidden="true"
            >
              ⋯
            </span>
          ) : (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'primary' : 'outlined'}
              size="small"
              onClick={() => handlePageChange(Number(pageNum))}
              ariaLabel={`Page ${pageNum}`}
              aria-current={currentPage === pageNum ? 'page' : undefined}
              className={classNames(
                styles.pagination__button,
                { [styles['pagination__button--active']]: currentPage === pageNum }
              )}
            >
              {pageNum}
            </Button>
          )
        ))}

        {/* Next page button */}
        <Button
          variant="outlined"
          size="small"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          ariaLabel="Next page"
          className={styles.pagination__button}
        >
          {dir === 'ltr' ? '→' : '←'}
        </Button>
      </div>
    </nav>
  );
});

// Display name for debugging
Pagination.displayName = 'Pagination';

export default Pagination;