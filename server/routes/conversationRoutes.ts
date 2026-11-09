import { Router, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import { conversationRepository } from '../repositories/conversationRepository';

export const conversationRouter = Router();

conversationRouter.use(requireAuth);

// GET /api/conversations - List conversations with search, filters, and sort
conversationRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const module = typeof req.query.module === 'string' ? req.query.module : undefined;
    const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const sortBy = req.query.sortBy === 'oldest' ? 'oldest' : 'newest';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;

    const conversations = conversationRepository.findConversationsByUser(userId, {
      module,
      projectId,
      search,
      sortBy,
      limit,
      offset,
    });
    return res.json({ conversations, count: conversations.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch conversations.' });
  }
});

// POST /api/conversations - Start a new conversation
conversationRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { module, title, topic, projectId } = req.body;
    if (!module || !title || !title.trim()) {
      return res.status(400).json({ error: 'Module and title are required.' });
    }

    const conversationId = `conv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const conversation = conversationRepository.createConversation({
      id: conversationId,
      user_id: userId,
      module,
      title: title.trim(),
      topic,
      project_id: projectId,
    });

    return res.status(201).json({ conversation });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to create conversation.' });
  }
});

// GET /api/conversations/:id - Get conversation details and its messages
conversationRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const details = conversationRepository.getConversationWithMessages(req.params.id, userId);
    if (!details) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }
    return res.json(details);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve conversation.' });
  }
});

// PUT /api/conversations/:id - Rename or update conversation
conversationRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, topic, projectId } = req.body;

    const updated = conversationRepository.updateConversation(req.params.id, userId, {
      title,
      topic,
      project_id: projectId,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }

    return res.json({ conversation: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to update conversation.' });
  }
});

// DELETE /api/conversations/:id - Delete a conversation and its messages
conversationRouter.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const deleted = conversationRepository.deleteConversation(req.params.id, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }
    return res.json({ success: true, message: 'Conversation deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete conversation.' });
  }
});

// GET /api/conversations/:id/messages - Get messages in a conversation
conversationRouter.get('/:id/messages', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const messages = conversationRepository.getMessages(req.params.id, userId);
    return res.json({ messages });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch messages.' });
  }
});

// POST /api/conversations/:id/messages - Append a message
conversationRouter.post('/:id/messages', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { role, content, citations, followUpSuggestions, tokenCount } = req.body;

    if (!role || !content || !content.trim()) {
      return res.status(400).json({ error: 'Role and message content are required.' });
    }

    // Verify conversation ownership
    const conv = conversationRepository.findConversationById(req.params.id, userId);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found or access denied.' });
    }

    const messageId = `msg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const message = conversationRepository.addMessage({
      id: messageId,
      conversation_id: req.params.id,
      user_id: userId,
      role,
      content: content.trim(),
      citations,
      followUpSuggestions,
      token_count: tokenCount,
    });

    return res.status(201).json({ message });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Failed to record message.' });
  }
});
