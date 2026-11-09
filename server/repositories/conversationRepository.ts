import { getDb } from '../db/connection';
import { ConversationRecord, MessageRecord } from '../types/db';

export interface ConversationFilterOptions {
  module?: string;
  projectId?: string;
  search?: string;
  sortBy?: 'newest' | 'oldest';
  limit?: number;
  offset?: number;
}

export const conversationRepository = {
  createConversation(data: {
    id: string;
    user_id: string;
    module: 'tutor' | 'concept' | 'portfolio';
    title: string;
    topic?: string;
    project_id?: string | null;
  }): ConversationRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const topic = data.topic || '';
    const projectId = data.project_id || null;

    const stmt = db.prepare(`
      INSERT INTO conversations (id, user_id, project_id, module, title, topic, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(data.id, data.user_id, projectId, data.module, data.title, topic, now, now);

    return {
      id: data.id,
      user_id: data.user_id,
      project_id: projectId,
      module: data.module,
      title: data.title,
      topic,
      created_at: now,
      updated_at: now,
      messages_count: 0,
    };
  },

  findConversationsByUser(userId: string, options?: ConversationFilterOptions): ConversationRecord[] {
    const db = getDb();
    const conditions = ['c.user_id = ?'];
    const params: any[] = [userId];

    if (options?.module) {
      conditions.push('c.module = ?');
      params.push(options.module);
    }
    if (options?.projectId) {
      conditions.push('c.project_id = ?');
      params.push(options.projectId);
    }
    if (options?.search) {
      conditions.push('(c.title LIKE ? OR c.topic LIKE ?)');
      const term = `%${options.search}%`;
      params.push(term, term);
    }

    const orderDirection = options?.sortBy === 'oldest' ? 'ASC' : 'DESC';
    const limitClause = options?.limit ? `LIMIT ${Number(options.limit)} OFFSET ${Number(options.offset || 0)}` : '';

    const sql = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messages_count
      FROM conversations c
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.updated_at ${orderDirection}
      ${limitClause}
    `;

    return db.prepare(sql).all(...params) as ConversationRecord[];
  },

  findConversationById(id: string, userId: string): ConversationRecord | null {
    const db = getDb();
    const row = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messages_count
      FROM conversations c
      WHERE c.id = ? AND c.user_id = ?
    `).get(id, userId) as ConversationRecord | undefined;
    return row || null;
  },

  findById(id: string, userId: string): ConversationRecord | null {
    return this.findConversationById(id, userId);
  },

  getMessagesByConversationId(conversationId: string, userId: string): MessageRecord[] {
    return this.getMessages(conversationId, userId);
  },

  create(data: {
    id: string;
    user_id: string;
    module?: 'tutor' | 'concept' | 'portfolio';
    tool_type?: string;
    title: string;
    topic?: string;
    project_id?: string | null;
  }): ConversationRecord {
    const module = data.module || (data.tool_type as any) || 'tutor';
    return this.createConversation({
      id: data.id,
      user_id: data.user_id,
      module,
      title: data.title,
      topic: data.topic,
      project_id: data.project_id,
    });
  },

  updateConversation(
    id: string,
    userId: string,
    updates: { title?: string; topic?: string; project_id?: string | null }
  ): ConversationRecord | null {
    const db = getDb();
    const existing = this.findConversationById(id, userId);
    if (!existing) return null;

    const newTitle = updates.title !== undefined ? updates.title.trim() : existing.title;
    const newTopic = updates.topic !== undefined ? updates.topic.trim() : existing.topic;
    const newProjectId = updates.project_id !== undefined ? updates.project_id : existing.project_id;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE conversations 
      SET title = ?, topic = ?, project_id = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(newTitle, newTopic, newProjectId || null, now, id, userId);

    return this.findConversationById(id, userId);
  },

  addMessage(data: {
    id: string;
    conversation_id: string;
    user_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    citations?: string[];
    followUpSuggestions?: string[];
    token_count?: number;
  }): MessageRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const citationsJson = JSON.stringify(data.citations || []);
    const followUpJson = JSON.stringify(data.followUpSuggestions || []);
    const tokenCount = data.token_count || 0;

    const stmt = db.prepare(`
      INSERT INTO messages (
        id, conversation_id, user_id, role, content,
        citations_json, follow_up_suggestions_json, token_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.conversation_id,
      data.user_id,
      data.role,
      data.content,
      citationsJson,
      followUpJson,
      tokenCount,
      now
    );

    // Touch conversation updated_at
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, data.conversation_id);

    return {
      id: data.id,
      conversation_id: data.conversation_id,
      user_id: data.user_id,
      role: data.role,
      content: data.content,
      citations_json: citationsJson,
      follow_up_suggestions_json: followUpJson,
      token_count: tokenCount,
      created_at: now,
    };
  },

  getMessages(conversationId: string, userId: string): MessageRecord[] {
    const db = getDb();
    // Validate user owns the conversation
    const conversation = this.findConversationById(conversationId, userId);
    if (!conversation) return [];

    return db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(conversationId) as MessageRecord[];
  },

  getConversationWithMessages(id: string, userId: string): { conversation: ConversationRecord; messages: MessageRecord[] } | null {
    const conv = this.findConversationById(id, userId);
    if (!conv) return null;
    const messages = this.getMessages(id, userId);
    return { conversation: conv, messages };
  },

  deleteConversation(id: string, userId: string): boolean {
    const db = getDb();
    const result = db.prepare(`DELETE FROM conversations WHERE id = ? AND user_id = ?`).run(id, userId);
    return result.changes > 0;
  }
};
