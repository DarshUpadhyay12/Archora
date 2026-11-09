import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { userRepository } from '../repositories/userRepository';
import { sessionRepository } from '../repositories/sessionRepository';
import { SafeUser } from '../types/db';

export interface AuthResult {
  user: SafeUser;
  token: string;
  expiresAt: string;
}

export const authService = {
  /**
   * Registers a new student architect in Anchora SQLite database.
   * Enforces email format, password complexity, and duplicate prevention.
   */
  async register(params: {
    email: string;
    password: string;
    fullName: string;
    university?: string;
    semester?: string;
    bio?: string;
  }): Promise<AuthResult> {
    const email = (params.email || '').trim().toLowerCase();
    const password = params.password || '';
    const fullName = (params.fullName || '').trim();

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      throw new Error('A valid email address is required.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters in length.');
    }
    if (!fullName) {
      throw new Error('Full name is required to initialize your studio profile.');
    }

    // Check duplicate account
    const existing = userRepository.findByEmail(email);
    if (existing) {
      throw new Error('This email address is already registered. Please sign in.');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = `usr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const user = userRepository.create({
      id: userId,
      email,
      password_hash: passwordHash,
      full_name: fullName,
      university: params.university,
      semester: params.semester,
      bio: params.bio,
    });

    // Generate cryptographic session token (64-character hex)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 30); // 30-day session
    const expiresAt = expiresDate.toISOString();

    sessionRepository.create(token, user.id, expiresAt);

    return { user, token, expiresAt };
  },

  /**
   * Authenticates user against SQLite password hash.
   */
  async login(emailInput: string, passwordInput: string): Promise<AuthResult> {
    const email = (emailInput || '').trim().toLowerCase();
    const password = passwordInput || '';

    if (!email || !password) {
      throw new Error('Email and password are required.');
    }

    const userRecord = userRepository.findByEmail(email);
    if (!userRecord) {
      throw new Error('Invalid email or password.');
    }

    const isMatch = await bcrypt.compare(password, userRecord.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 30);
    const expiresAt = expiresDate.toISOString();

    sessionRepository.create(token, userRecord.id, expiresAt);

    const { password_hash, ...safeUser } = userRecord;
    return { user: safeUser, token, expiresAt };
  },

  /**
   * Terminates active session in SQLite.
   */
  logout(token: string): boolean {
    if (!token) return false;
    return sessionRepository.deleteByToken(token);
  },

  /**
   * Validates active session token.
   */
  validateSession(token: string): SafeUser | null {
    if (!token) return null;
    const match = sessionRepository.findByToken(token);
    if (!match) return null;
    return match.user;
  }
};

