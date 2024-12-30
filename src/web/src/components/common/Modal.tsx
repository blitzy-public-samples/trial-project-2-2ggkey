/**
 * @fileoverview A reusable, accessible modal dialog component implementing Material Design principles
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef } from 'react';
import classNames from 'classnames'; // ^2.3.2
import FocusTrap from 'focus-trap-react'; // ^10.0.0
import { Button } from './Button';
import { Theme } from '../../types/common.types';

import styles from './Modal.module.css';

export interface ModalProps {
  /** Controls modal visibility state */
  isOpen: boolean;
  /** Callback function triggered when modal closes */
  onClose: () => void;
  /** Modal title text used for heading and aria-labelledby */
  title: string;
  /** Modal size variant with responsive breakpoints */
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  /** Modal content with support for nested components */
  children: React.ReactNode;
  /** Controls whether clicking overlay closes modal */
  closeOnOverlayClick?: boolean;
  /** Controls visibility of close button */
  showCloseButton?: boolean;
  /** Additional CSS classes for custom styling */
  className?: string;
  /** Custom aria-label for accessibility */
  ariaLabel?: string;
  /** Reference to element that should receive initial focus */
  initialFocusRef?: React.RefObject<HTMLElement>;
  /** Theme override for the modal */
  theme?: Theme;
}

/**
 * Custom hook for managing modal keyboard interactions
 */
const useModalKeyboardEvents = (onClose: () => void) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
};

/**
 * A highly accessible modal dialog component with comprehensive focus management
 * and keyboard interaction support.
 */
const Modal = React.memo<ModalProps>(({
  isOpen,
  onClose,
  title,
  size = 'medium',
  children,
  closeOnOverlayClick = true,
  showCloseButton = true,
  className,
  ariaLabel,
  initialFocusRef,
  theme,
}) => {
  // Refs for managing focus and scroll lock
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle keyboard events
  useModalKeyboardEvents(onClose);

  // Store the previously focused element and lock body scroll
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = '';
      if (previousActiveElement.current && !isOpen) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen]);

  // Handle overlay click
  const handleOverlayClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnOverlayClick, onClose]);

  // Generate modal classes
  const modalClasses = classNames(
    styles['modal-container'],
    styles[`modal--${size}`],
    {
      [styles['modal--enter']]: isOpen,
      [styles['modal--exit']]: !isOpen,
    },
    className
  );

  // Early return if modal is not open
  if (!isOpen) return null;

  return (
    <FocusTrap
      focusTrapOptions={{
        initialFocus: initialFocusRef?.current || undefined,
        escapeDeactivates: false,
        allowOutsideClick: true,
      }}
    >
      <div
        className={styles['modal-overlay']}
        onClick={handleOverlayClick}
        data-theme={theme}
        role="presentation"
      >
        <div
          ref={modalRef}
          className={modalClasses}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-content"
          aria-label={ariaLabel}
        >
          <header className={styles['modal-header']}>
            <h2 id="modal-title" className={styles['modal-title']}>
              {title}
            </h2>
            {showCloseButton && (
              <Button
                variant="text"
                size="small"
                onClick={onClose}
                className={styles['modal-close-button']}
                ariaLabel="Close modal"
              >
                <span aria-hidden="true">&times;</span>
              </Button>
            )}
          </header>

          <div id="modal-content" className={styles['modal-content']}>
            {children}
          </div>
        </div>
      </div>
    </FocusTrap>
  );
});

// Display name for debugging
Modal.displayName = 'Modal';

export default Modal;

/**
 * CSS Module styles are defined in Modal.module.css
 * 
 * Example usage:
 * ```tsx
 * const MyComponent = () => {
 *   const [isOpen, setIsOpen] = useState(false);
 * 
 *   return (
 *     <Modal
 *       isOpen={isOpen}
 *       onClose={() => setIsOpen(false)}
 *       title="Example Modal"
 *       size="medium"
 *     >
 *       <p>Modal content goes here</p>
 *     </Modal>
 *   );
 * };
 * ```
 */