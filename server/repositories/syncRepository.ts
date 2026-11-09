import { getDb } from '../db/connection';
import { CloudSyncStateRecord, OfflineSyncQueueRecord } from '../types/db';
import { randomUUID } from 'crypto';

export class SyncRepository {
  /**
   * Retrieves current cloud synchronization status for the user.
   */
  getSyncState(userId: string): CloudSyncStateRecord | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM cloud_sync_state WHERE user_id = ?').get(userId) as
      | CloudSyncStateRecord
      | undefined;
    return row || null;
  }

  /**
   * Inserts or updates the cloud synchronization state for the user.
   */
  upsertSyncState(userId: string, data: Partial<CloudSyncStateRecord>): CloudSyncStateRecord {
    const db = getDb();
    const existing = this.getSyncState(userId);
    const now = new Date().toISOString();

    if (!existing) {
      db.prepare(`
        INSERT INTO cloud_sync_state (
          user_id, last_sync_at, sync_status, snapshot_drive_file_id,
          snapshot_version, total_synced_projects, total_synced_conversations,
          total_synced_files, auto_sync_enabled, error_message, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        userId,
        data.last_sync_at || null,
        data.sync_status || 'idle',
        data.snapshot_drive_file_id || null,
        data.snapshot_version ?? 1,
        data.total_synced_projects ?? 0,
        data.total_synced_conversations ?? 0,
        data.total_synced_files ?? 0,
        data.auto_sync_enabled ?? 1,
        data.error_message || null,
        now
      );
    } else {
      const sets: string[] = ['updated_at = ?'];
      const params: any[] = [now];

      if (data.last_sync_at !== undefined) {
        sets.push('last_sync_at = ?');
        params.push(data.last_sync_at);
      }
      if (data.sync_status !== undefined) {
        sets.push('sync_status = ?');
        params.push(data.sync_status);
      }
      if (data.snapshot_drive_file_id !== undefined) {
        sets.push('snapshot_drive_file_id = ?');
        params.push(data.snapshot_drive_file_id);
      }
      if (data.snapshot_version !== undefined) {
        sets.push('snapshot_version = ?');
        params.push(data.snapshot_version);
      }
      if (data.total_synced_projects !== undefined) {
        sets.push('total_synced_projects = ?');
        params.push(data.total_synced_projects);
      }
      if (data.total_synced_conversations !== undefined) {
        sets.push('total_synced_conversations = ?');
        params.push(data.total_synced_conversations);
      }
      if (data.total_synced_files !== undefined) {
        sets.push('total_synced_files = ?');
        params.push(data.total_synced_files);
      }
      if (data.auto_sync_enabled !== undefined) {
        sets.push('auto_sync_enabled = ?');
        params.push(data.auto_sync_enabled);
      }
      if (data.error_message !== undefined) {
        sets.push('error_message = ?');
        params.push(data.error_message);
      }

      params.push(userId);
      db.prepare(`UPDATE cloud_sync_state SET ${sets.join(', ')} WHERE user_id = ?`).run(...params);
    }

    return this.getSyncState(userId)!;
  }

  /**
   * Enqueues an action for later replay when network connection or Drive API becomes available.
   */
  enqueueOfflineAction(
    userId: string,
    actionType: 'file_upload' | 'file_delete' | 'data_sync',
    entityId: string,
    payload: any
  ): OfflineSyncQueueRecord {
    const db = getDb();
    const id = randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO offline_sync_queue (
        id, user_id, action_type, entity_id, payload_json,
        retry_count, status, error_message, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 0, 'pending', NULL, ?, ?
      )
    `).run(
      id,
      userId,
      actionType,
      entityId,
      JSON.stringify(payload),
      now,
      now
    );

    return db.prepare('SELECT * FROM offline_sync_queue WHERE id = ?').get(id) as OfflineSyncQueueRecord;
  }

  /**
   * Retrieves all pending actions in queue for a user, ordered by creation time.
   */
  getPendingQueue(userId: string): OfflineSyncQueueRecord[] {
    const db = getDb();
    return db
      .prepare('SELECT * FROM offline_sync_queue WHERE user_id = ? AND status = ? ORDER BY created_at ASC')
      .all(userId, 'pending') as OfflineSyncQueueRecord[];
  }

  /**
   * Marks queue item as completed and removes it.
   */
  markQueueItemCompleted(id: string): void {
    const db = getDb();
    db.prepare('DELETE FROM offline_sync_queue WHERE id = ?').run(id);
  }

  /**
   * Marks queue item as failed with error details.
   */
  markQueueItemFailed(id: string, errorMessage: string): void {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE offline_sync_queue 
      SET status = 'failed', error_message = ?, retry_count = retry_count + 1, updated_at = ?
      WHERE id = ?
    `).run(errorMessage, now, id);
  }

  /**
   * Resets failed items back to pending for retry.
   */
  retryFailedItems(userId: string): number {
    const db = getDb();
    const result = db.prepare(`
      UPDATE offline_sync_queue
      SET status = 'pending', error_message = NULL, updated_at = ?
      WHERE user_id = ? AND status = 'failed'
    `).run(new Date().toISOString(), userId);
    return result.changes;
  }
}

export const syncRepository = new SyncRepository();

