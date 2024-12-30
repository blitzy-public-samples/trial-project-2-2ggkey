/**
 * @fileoverview A reusable, accessible dialog component implementing Material Design principles
 * @version 1.0.0
 */

import React, { useCallback, useState, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import Modal, { ModalProps } from './Modal';
import Button from './Button';

import styles from './Dialog.module.css';

export interface DialogProps extends Omit<ModalProps, 'footer'> {
  /** Type of dialog determining layout and behavior patterns */
  dialogType: 'alert' | 'confirm' | 'form';
  /** Dialog title for accessibility and visual hierarchy */
  title: string;
  /** Main message content of the dialog */
  message: string | React.ReactNode;
  /** Async-capable callback function when confirm action is triggered */
  onConfirm?: () => void | Promise<void>;
  /** Callback function when cancel action is triggered */
  onCancel?: () => void;
  /** Localized text for confirm button */
  confirmText?: string;
  /** Localized text for cancel button */
  cancelText?: string;
  /** Visual style variant for confirm button */
  confirmButtonVariant?: 'primary' | 'secondary' | 'danger';
  /** Option to prevent closing dialog on backdrop click */
  disableBackdropClick?: boolean;
  /** Option to prevent closing dialog on escape key */
  disableEscapeKey?: boolean;
}

/**
 * Custom hook to manage dialog action handlers with loading states
 */
const useDialogActions = (
  onConfirm?: () => void | Promise<void>,
  onCancel?: () => void,
  onClose?: () => void
) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    if (!onConfirm) return;

    try {
      setIsLoading(true);
      await onConfirm();
      onClose?.();
    } catch (error) {
      console.error('Dialog confirmation error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onConfirm, onClose]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    onClose?.();
  }, [onCancel, onClose]);

  return {
    isLoading,
    handleConfirm,
    handleCancel
  };
};

/**
 * A dialog component that provides focused interaction patterns for alerts,
 * confirmations, and forms with comprehensive accessibility support.
 */
const Dialog = React.memo<DialogProps>(({
  dialogType = 'alert',
  title,
  message,
  onConfirm,
  onCancel,
  onClose,
  confirmText = 'OK',
  cancelText = 'Cancel',
  confirmButtonVariant = 'primary',
  disableBackdropClick = false,
  disableEscapeKey = false,
  className,
  children,
  ...modalProps
}) => {
  // Manage dialog actions and loading state
  const { isLoading, handleConfirm, handleCancel } = useDialogActions(
    onConfirm,
    onCancel,
    onClose
  );

  // Generate dialog-specific class names
  const dialogClasses = useMemo(() => classNames(
    styles.dialog,
    styles[`dialog--${dialogType}`],
    {
      [styles['dialog--loading']]: isLoading
    },
    className
  ), [dialogType, isLoading, className]);

  // Generate action buttons based on dialog type
  const dialogActions = useMemo(() => {
    const actions = [];

    if (dialogType !== 'alert') {
      actions.push(
        <Button
          key="cancel"
          variant="text"
          onClick={handleCancel}
          disabled={isLoading}
          ariaLabel={cancelText}
          dataTestId="dialog-cancel-button"
        >
          {cancelText}
        </Button>
      );
    }

    actions.push(
      <Button
        key="confirm"
        variant={confirmButtonVariant}
        onClick={handleConfirm}
        loading={isLoading}
        disabled={isLoading}
        ariaLabel={confirmText}
        dataTestId="dialog-confirm-button"
      >
        {confirmText}
      </Button>
    );

    return actions;
  }, [dialogType, confirmButtonVariant, confirmText, cancelText, handleConfirm, handleCancel, isLoading]);

  return (
    <Modal
      {...modalProps}
      onClose={onClose}
      className={dialogClasses}
      closeOnOverlayClick={!disableBackdropClick}
      showCloseButton={dialogType === 'form'}
      ariaLabel={`${dialogType} dialog`}
      aria-describedby="dialog-message"
    >
      <div className={styles.dialog__content}>
        <h2 className={styles.dialog__title} id="dialog-title">
          {title}
        </h2>
        
        <div className={styles.dialog__message} id="dialog-message">
          {message}
        </div>

        {children}

        <div 
          className={classNames(
            styles.dialog__actions,
            styles[`dialog__actions--${dialogActions.length === 1 ? 'single' : 'double'}`]
          )}
        >
          {dialogActions}
        </div>
      </div>
    </Modal>
  );
});

// Display name for debugging
Dialog.displayName = 'Dialog';

export default Dialog;

/**
 * CSS Module styles are defined in Dialog.module.css
 * 
 * Example usage:
 * ```tsx
 * <Dialog
 *   isOpen={isOpen}
 *   dialogType="confirm"
 *   title="Confirm Action"
 *   message="Are you sure you want to proceed?"
 *   onConfirm={handleConfirm}
 *   onCancel={handleCancel}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */