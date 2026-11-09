import { getDb } from '../db/connection';
import { GoogleOAuthTokenRecord } from '../types/db';

export const googleOAuthRepository = {
  /**
   * Saves or updates OAuth tokens for a user.
   * If refresh_token is omitted in updates, the existing refresh_token is preserved.
   */
  saveTokens(data: {
    userId: string;
    googleEmail?: string | null;
    googleName?: string | null;
    googlePicture?: string | null;
    accessToken: string;
    refreshToken?: string | null;
    tokenExpiry?: number | null;
    scope?: string | null;
  }): GoogleOAuthTokenRecord {
    const db = getDb();
    const existing = this.getTokens(data.userId);
    const now = new Date().toISOString();

    const refreshToken = data.refreshToken !== undefined ? data.refreshToken : (existing?.refresh_token ?? null);
    const googleEmail = data.googleEmail !== undefined ? data.googleEmail : (existing?.google_email ?? null);
    const googleName = data.googleName !== undefined ? data.googleName : (existing?.google_name ?? null);
    const googlePicture = data.googlePicture !== undefined ? data.googlePicture : (existing?.google_picture ?? null);
    const scope = data.scope !== undefined ? data.scope : (existing?.scope ?? null);

    const stmt = db.prepare(`
      INSERT INTO google_oauth_tokens (
        user_id, google_email, google_name, google_picture,
        access_token, refresh_token, token_expiry, scope, created_at, updated_at
      ) VALUES (
        @userId, @googleEmail, @googleName, @googlePicture,
        @accessToken, @refreshToken, @tokenExpiry, @scope, @createdAt, @updatedAt
      )
      ON CONFLICT(user_id) DO UPDATE SET
        google_email = excluded.google_email,
        google_name = excluded.google_name,
        google_picture = excluded.google_picture,
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, google_oauth_tokens.refresh_token),
        token_expiry = excluded.token_expiry,
        scope = excluded.scope,
        updated_at = excluded.updated_at
    `);

    stmt.run({
      userId: data.userId,
      googleEmail,
      googleName,
      googlePicture,
      accessToken: data.accessToken,
      refreshToken,
      tokenExpiry: data.tokenExpiry || null,
      scope,
      createdAt: existing ? existing.created_at : now,
      updatedAt: now,
    });

    return {
      user_id: data.userId,
      google_email: googleEmail,
      google_name: googleName,
      google_picture: googlePicture,
      access_token: data.accessToken,
      refresh_token: refreshToken,
      token_expiry: data.tokenExpiry || null,
      scope,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };
  },

  /**
   * Retrieves stored OAuth tokens for a user.
   */
  getTokens(userId: string): GoogleOAuthTokenRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM google_oauth_tokens WHERE user_id = ?').get(userId) as GoogleOAuthTokenRecord | undefined;
    return row || null;
  },

  /**
   * Retrieves the active studio master OAuth tokens on this server.
   * Enables all users to upload to the shared studio Google Drive folder
   * without requiring each visitor to configure their own Google account.
   */
  getMasterTokens(): GoogleOAuthTokenRecord | null {
    const db = getDb();
    try {
      const row = db.prepare('SELECT * FROM google_oauth_tokens WHERE refresh_token IS NOT NULL OR access_token IS NOT NULL ORDER BY updated_at DESC LIMIT 1').get() as GoogleOAuthTokenRecord | undefined;
      return row || null;
    } catch {
      return null;
    }
  },

  /**
   * Updates only the access token and expiry after a refresh.
   */
  updateAccessToken(userId: string, accessToken: string, expiry: number): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE google_oauth_tokens
      SET access_token = ?, token_expiry = ?, updated_at = ?
      WHERE user_id = ?
    `).run(accessToken, expiry, now, userId);
  },

  /**
   * Clears stored tokens when the user disconnects their Google account.
   */
  deleteTokens(userId: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM google_oauth_tokens WHERE user_id = ?').run(userId);
    return result.changes > 0;
  },
};
