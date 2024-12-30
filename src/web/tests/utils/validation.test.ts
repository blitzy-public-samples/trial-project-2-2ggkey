// External imports - v29.0.0
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Faker library - v8.0.0
import { faker } from '@faker-js/faker';

// Internal imports
import {
  validateEmail,
  validatePassword,
  authValidationSchemas,
  taskValidationSchemas,
  taskBulkUpdateSchema,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REGEX,
  ValidationResult,
  PasswordValidationRules
} from '../../../src/utils/validation.utils';

// Mock i18next
jest.mock('i18next', () => ({
  t: (key: string) => key,
}));

describe('Email Validation Tests', () => {
  const validEmails = [
    'user@example.com',
    'test.user@domain.com',
    'user+label@domain.com',
    'user@subdomain.domain.com',
    'üser@domain.com',
    `${faker.string.alpha(64)}@${faker.internet.domainName()}`
  ];

  const invalidEmails = [
    '',
    ' ',
    'invalid-email',
    '@domain.com',
    'user@',
    'user@.com',
    'user@domain',
    'user space@domain.com',
    `${faker.string.alpha(65)}@${faker.internet.domainName()}` // Exceeds max length
  ];

  it.each(validEmails)('should validate correct email format: %s', (email) => {
    const result = validateEmail(email);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it.each(invalidEmails)('should reject invalid email format: %s', (email) => {
    const result = validateEmail(email);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle null and undefined inputs', () => {
    expect(validateEmail(null as any).isValid).toBe(false);
    expect(validateEmail(undefined as any).isValid).toBe(false);
  });
});

describe('Password Validation Tests', () => {
  const defaultRules: PasswordValidationRules = {
    minLength: PASSWORD_MIN_LENGTH,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecial: true,
  };

  const validPasswords = [
    'Password123!',
    'SecurePass1#',
    'TestPass123$',
    `${faker.internet.password({ length: 20, pattern: /[A-Za-z0-9!@#$%^&*]/ })}`
  ];

  const invalidPasswords = [
    '',
    'pass',
    'password',
    'PASSWORD',
    '12345678',
    'NoSpecial1',
    'nouppercasespecial1!',
    'NOLOWERCASESPECIAL1!',
    'NoNumbers!'
  ];

  it.each(validPasswords)('should validate correct password format: %s', (password) => {
    const result = validatePassword(password, defaultRules);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it.each(invalidPasswords)('should reject invalid password format: %s', (password) => {
    const result = validatePassword(password, defaultRules);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate passwords with custom rules', () => {
    const customRules: PasswordValidationRules = {
      minLength: 6,
      requireUppercase: false,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecial: false,
    };

    const result = validatePassword('simple2', customRules);
    expect(result.isValid).toBe(true);
  });

  it('should handle null and undefined inputs', () => {
    expect(validatePassword(null as any).isValid).toBe(false);
    expect(validatePassword(undefined as any).isValid).toBe(false);
  });
});

describe('Auth Validation Schema Tests', () => {
  describe('Login Schema', () => {
    it('should validate correct login data', async () => {
      const validData = {
        email: 'user@example.com',
        password: 'Password123!'
      };
      
      await expect(authValidationSchemas.loginSchema.validate(validData))
        .resolves.toEqual(validData);
    });

    it('should reject invalid login data', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'short'
      };

      await expect(authValidationSchemas.loginSchema.validate(invalidData))
        .rejects.toThrow();
    });
  });

  describe('Register Schema', () => {
    it('should validate correct registration data', async () => {
      const validData = {
        email: 'user@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!'
      };

      await expect(authValidationSchemas.registerSchema.validate(validData))
        .resolves.toEqual(validData);
    });

    it('should reject mismatched passwords', async () => {
      const invalidData = {
        email: 'user@example.com',
        password: 'Password123!',
        confirmPassword: 'DifferentPass123!'
      };

      await expect(authValidationSchemas.registerSchema.validate(invalidData))
        .rejects.toThrow();
    });
  });
});

describe('Task Validation Schema Tests', () => {
  describe('Create Task Schema', () => {
    it('should validate correct task creation data', async () => {
      const validData = {
        title: 'Test Task',
        description: 'Test Description',
        dueDate: new Date(Date.now() + 86400000), // tomorrow
        priority: 'high',
        assigneeId: faker.string.uuid()
      };

      await expect(taskValidationSchemas.createTaskSchema.validate(validData))
        .resolves.toEqual(validData);
    });

    it('should reject invalid task data', async () => {
      const invalidData = {
        title: '', // empty title
        description: faker.string.alpha(1001), // exceeds max length
        dueDate: new Date(Date.now() - 86400000), // yesterday
        priority: 'invalid',
        assigneeId: 'invalid-uuid'
      };

      await expect(taskValidationSchemas.createTaskSchema.validate(invalidData))
        .rejects.toThrow();
    });
  });

  describe('Bulk Update Schema', () => {
    it('should validate correct bulk update data', async () => {
      const validData = {
        taskIds: [faker.string.uuid(), faker.string.uuid()],
        updates: {
          status: 'in_progress',
          priority: 'high',
          assigneeId: faker.string.uuid()
        }
      };

      await expect(taskValidationSchemas.taskBulkUpdateSchema.validate(validData))
        .resolves.toEqual(validData);
    });

    it('should reject invalid bulk update data', async () => {
      const invalidData = {
        taskIds: [], // empty array
        updates: {
          status: 'invalid_status',
          priority: 'invalid_priority'
        }
      };

      await expect(taskValidationSchemas.taskBulkUpdateSchema.validate(invalidData))
        .rejects.toThrow();
    });

    it('should handle large bulk updates within limits', async () => {
      const taskIds = Array.from({ length: 100 }, () => faker.string.uuid());
      const validData = {
        taskIds,
        updates: {
          status: 'done',
          priority: 'low'
        }
      };

      await expect(taskValidationSchemas.taskBulkUpdateSchema.validate(validData))
        .resolves.toEqual(validData);
    });
  });
});

describe('Performance Tests', () => {
  it('should handle email validation performance', () => {
    const startTime = Date.now();
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
      validateEmail(faker.internet.email());
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should handle password validation performance', () => {
    const startTime = Date.now();
    const iterations = 1000;
    
    for (let i = 0; i < iterations; i++) {
      validatePassword(faker.internet.password());
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });
});