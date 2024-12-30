// External imports
// yup v1.2.0 - Schema-based validation
import * as yup from 'yup';
// i18next v21.8.0 - Internationalization
import i18next from 'i18next';

// Constants
export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REGEX = {
  UPPERCASE: /[A-Z]/,
  LOWERCASE: /[a-z]/,
  NUMBERS: /[0-9]/,
  SPECIAL: /[!@#$%^&*]/,
};

export const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Interfaces
export interface ValidationResult {
  isValid: boolean;
  message: string;
  errors: string[];
  field: string;
}

export interface PasswordValidationRules {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecial: boolean;
}

// Utility Functions
export const createValidationResult = (
  isValid: boolean,
  message: string,
  field: string,
  errors: string[] = []
): ValidationResult => ({
  isValid,
  message,
  field,
  errors,
});

export const validateEmail = (email: string): ValidationResult => {
  const field = 'email';
  
  if (!email?.trim()) {
    return createValidationResult(
      false,
      i18next.t('validation.email.required'),
      field,
      ['Email is required']
    );
  }

  if (!EMAIL_REGEX.test(email)) {
    return createValidationResult(
      false,
      i18next.t('validation.email.invalid'),
      field,
      ['Invalid email format']
    );
  }

  return createValidationResult(
    true,
    i18next.t('validation.email.valid'),
    field
  );
};

export const validatePassword = (
  password: string,
  rules: PasswordValidationRules = {
    minLength: PASSWORD_MIN_LENGTH,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: true,
  }
): ValidationResult => {
  const errors: string[] = [];
  const field = 'password';

  if (!password) {
    return createValidationResult(
      false,
      i18next.t('validation.password.required'),
      field,
      ['Password is required']
    );
  }

  if (password.length < rules.minLength) {
    errors.push(`Password must be at least ${rules.minLength} characters long`);
  }

  if (rules.requireUppercase && !PASSWORD_REGEX.UPPERCASE.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (rules.requireLowercase && !PASSWORD_REGEX.LOWERCASE.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (rules.requireNumbers && !PASSWORD_REGEX.NUMBERS.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (rules.requireSpecial && !PASSWORD_REGEX.SPECIAL.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return createValidationResult(
    errors.length === 0,
    errors.length === 0
      ? i18next.t('validation.password.valid')
      : i18next.t('validation.password.invalid'),
    field,
    errors
  );
};

// Yup Validation Schemas
export const authValidationSchemas = {
  loginSchema: yup.object().shape({
    email: yup
      .string()
      .required(i18next.t('validation.email.required'))
      .matches(EMAIL_REGEX, i18next.t('validation.email.invalid')),
    password: yup
      .string()
      .required(i18next.t('validation.password.required'))
      .min(PASSWORD_MIN_LENGTH, i18next.t('validation.password.tooShort')),
  }),

  registerSchema: yup.object().shape({
    email: yup
      .string()
      .required(i18next.t('validation.email.required'))
      .matches(EMAIL_REGEX, i18next.t('validation.email.invalid')),
    password: yup
      .string()
      .required(i18next.t('validation.password.required'))
      .min(PASSWORD_MIN_LENGTH, i18next.t('validation.password.tooShort'))
      .matches(PASSWORD_REGEX.UPPERCASE, i18next.t('validation.password.requireUppercase'))
      .matches(PASSWORD_REGEX.LOWERCASE, i18next.t('validation.password.requireLowercase'))
      .matches(PASSWORD_REGEX.NUMBERS, i18next.t('validation.password.requireNumbers'))
      .matches(PASSWORD_REGEX.SPECIAL, i18next.t('validation.password.requireSpecial')),
    confirmPassword: yup
      .string()
      .required(i18next.t('validation.confirmPassword.required'))
      .oneOf([yup.ref('password')], i18next.t('validation.confirmPassword.mismatch')),
  }),

  passwordResetSchema: yup.object().shape({
    email: yup
      .string()
      .required(i18next.t('validation.email.required'))
      .matches(EMAIL_REGEX, i18next.t('validation.email.invalid')),
  }),
};

export const taskValidationSchemas = {
  createTaskSchema: yup.object().shape({
    title: yup
      .string()
      .required(i18next.t('validation.task.title.required'))
      .min(3, i18next.t('validation.task.title.tooShort'))
      .max(100, i18next.t('validation.task.title.tooLong')),
    description: yup
      .string()
      .max(1000, i18next.t('validation.task.description.tooLong')),
    dueDate: yup
      .date()
      .min(new Date(), i18next.t('validation.task.dueDate.pastDate')),
    priority: yup
      .string()
      .oneOf(['low', 'medium', 'high'], i18next.t('validation.task.priority.invalid')),
    assigneeId: yup
      .string()
      .uuid(i18next.t('validation.task.assignee.invalidId')),
  }),

  updateTaskSchema: yup.object().shape({
    title: yup
      .string()
      .min(3, i18next.t('validation.task.title.tooShort'))
      .max(100, i18next.t('validation.task.title.tooLong')),
    description: yup
      .string()
      .max(1000, i18next.t('validation.task.description.tooLong')),
    dueDate: yup
      .date()
      .min(new Date(), i18next.t('validation.task.dueDate.pastDate')),
    priority: yup
      .string()
      .oneOf(['low', 'medium', 'high'], i18next.t('validation.task.priority.invalid')),
    status: yup
      .string()
      .oneOf(['todo', 'in_progress', 'done'], i18next.t('validation.task.status.invalid')),
  }),

  taskBulkUpdateSchema: yup.object().shape({
    taskIds: yup
      .array()
      .of(yup.string().uuid(i18next.t('validation.task.id.invalid')))
      .required(i18next.t('validation.task.ids.required'))
      .min(1, i18next.t('validation.task.ids.empty')),
    updates: yup.object().shape({
      status: yup
        .string()
        .oneOf(['todo', 'in_progress', 'done'], i18next.t('validation.task.status.invalid')),
      priority: yup
        .string()
        .oneOf(['low', 'medium', 'high'], i18next.t('validation.task.priority.invalid')),
      assigneeId: yup
        .string()
        .uuid(i18next.t('validation.task.assignee.invalidId')),
    }).required(),
  }),
};

// Export validation utilities
export const validationUtils = {
  validateEmail,
  validatePassword,
  createValidationResult,
};