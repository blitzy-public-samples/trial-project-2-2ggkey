import { Entity, Column, PrimaryColumn, Index, BeforeInsert, BeforeUpdate } from 'typeorm'; // typeorm ^0.3.0
import { IsEmail, IsNotEmpty, MinLength, MaxLength } from 'class-validator'; // class-validator ^0.14.0
import { v4 as uuidv4 } from 'uuid'; // uuid ^9.0.0
import speakeasy from 'speakeasy'; // speakeasy ^2.0.0
import { pool } from '../config/database.config';
import { hashPassword } from '../utils/encryption.util';

// Security-related constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const PASSWORD_HISTORY_SIZE = 5;
const TOKEN_EXPIRY_HOURS = 24;
const MFA_BACKUP_CODES_COUNT = 10;

@Entity('users')
@Index(['email'], { unique: true })
export class User {
    @PrimaryColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 255, unique: true })
    @IsEmail({}, { message: 'Invalid email format' })
    @IsNotEmpty()
    email: string;

    @Column({ type: 'varchar', length: 255 })
    @IsNotEmpty()
    @MinLength(8)
    @MaxLength(64)
    password_hash: string;

    @Column({ type: 'varchar', length: 100 })
    @IsNotEmpty()
    name: string;

    @Column({ type: 'boolean', default: true })
    is_active: boolean;

    @Column({ type: 'boolean', default: false })
    is_email_verified: boolean;

    @Column({ type: 'boolean', default: false })
    mfa_enabled: boolean;

    @Column({ type: 'varchar', length: 255, nullable: true })
    mfa_secret?: string;

    @Column({ type: 'jsonb', nullable: true })
    mfa_backup_codes?: string[];

    @Column({ type: 'integer', default: 0 })
    login_attempts: number;

    @Column({ type: 'timestamp', nullable: true })
    locked_until?: Date;

    @Column({ type: 'jsonb', default: [] })
    previous_passwords: string[];

    @Column({ type: 'varchar', length: 255, nullable: true })
    reset_token?: string;

    @Column({ type: 'timestamp', nullable: true })
    reset_token_expires?: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    updated_at: Date;

    @Column({ type: 'varchar', length: 45, nullable: true })
    last_login_ip?: string;

    @Column({ type: 'timestamp', nullable: true })
    last_login_date?: Date;

    constructor(userData: Partial<User>) {
        if (userData) {
            this.id = userData.id || uuidv4();
            this.email = userData.email;
            this.name = userData.name;
            this.password_hash = userData.password_hash;
            this.is_active = true;
            this.is_email_verified = false;
            this.mfa_enabled = false;
            this.login_attempts = 0;
            this.previous_passwords = [];
            this.created_at = new Date();
            this.updated_at = new Date();
        }
    }

    @BeforeInsert()
    @BeforeUpdate()
    updateTimestamp() {
        this.updated_at = new Date();
    }

    /**
     * Creates a new user with security validations and password hashing
     * @param userData User creation data
     * @returns Promise<User>
     */
    static async create(userData: Partial<User>): Promise<User> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Check for existing email
            const existingUser = await client.query(
                'SELECT id FROM users WHERE email = $1',
                [userData.email]
            );

            if (existingUser.rows.length > 0) {
                throw new Error('Email already exists');
            }

            // Hash password
            const hashedPassword = await hashPassword(userData.password_hash);
            
            const user = new User({
                ...userData,
                password_hash: hashedPassword
            });

            // Insert user
            const result = await client.query(
                `INSERT INTO users (
                    id, email, password_hash, name, is_active, is_email_verified,
                    mfa_enabled, login_attempts, previous_passwords, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                [
                    user.id, user.email, user.password_hash, user.name,
                    user.is_active, user.is_email_verified, user.mfa_enabled,
                    user.login_attempts, user.previous_passwords, user.created_at,
                    user.updated_at
                ]
            );

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Updates login attempts and manages account locking
     * @param success Whether login attempt was successful
     * @param ip_address IP address of login attempt
     */
    async updateLoginAttempts(success: boolean, ip_address: string): Promise<void> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            if (success) {
                // Reset on successful login
                await client.query(
                    `UPDATE users 
                     SET login_attempts = 0, 
                         locked_until = NULL, 
                         last_login_ip = $1,
                         last_login_date = CURRENT_TIMESTAMP
                     WHERE id = $2`,
                    [ip_address, this.id]
                );
            } else {
                // Increment attempts and possibly lock account
                const newAttempts = this.login_attempts + 1;
                const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;
                const lockUntil = shouldLock ? new Date(Date.now() + LOCK_DURATION_MS) : null;

                await client.query(
                    `UPDATE users 
                     SET login_attempts = $1, 
                         locked_until = $2
                     WHERE id = $3`,
                    [newAttempts, lockUntil, this.id]
                );
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Enables MFA for user and generates backup codes
     * @param secret TOTP secret
     * @returns Array of backup codes
     */
    async enableMFA(secret: string): Promise<string[]> {
        const client = await pool.connect();
        
        try {
            await client.query('BEGIN');

            // Generate backup codes
            const backupCodes = Array.from({ length: MFA_BACKUP_CODES_COUNT }, () => 
                speakeasy.generateSecret({ length: 10 }).base32
            );

            // Hash backup codes before storage
            const hashedBackupCodes = await Promise.all(
                backupCodes.map(code => hashPassword(code))
            );

            await client.query(
                `UPDATE users 
                 SET mfa_enabled = true,
                     mfa_secret = $1,
                     mfa_backup_codes = $2
                 WHERE id = $3`,
                [secret, hashedBackupCodes, this.id]
            );

            await client.query('COMMIT');
            return backupCodes; // Return unhashed codes to user
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}