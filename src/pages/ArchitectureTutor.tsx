import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Send, 
  RotateCcw, 
  Sparkles, 
  Loader2,
  History,
  Trash2,
  Edit2,
  Check,
  X,
  MessageSquare,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { ArchitectureBackground } from '@/components/common/ArchitectureBackground';
import { PageHeading } from '@/components/common/PageHeading';
import { AIResponsePanel } from '@/components/common/AIResponsePanel';
import { Button, PrimaryButton } from '@/components/common/Buttons';
import { Modal, ConfirmDialog } from '@/components/common/Modal';
import { PdfExportModal } from '@/components/common/PdfExportModal';
import { showToast } from '@/components/common/Toast';
import { aiService } from '@/services/aiService';
import { apiClient, ConversationResponse, MessageResponse } from '@/services/apiClient';
import { TUTOR_TOPICS } from '@/data/mockData';
import { TutorMessage } from '@/types';
import { GENZ_VOICE } from '@/config/genzVoice';

export const ArchitectureTutor: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  
  // Conversation History state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationResponse[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [deletingConvId, setDeletingConvId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations list
  const loadConversations = async () => {
    try {
      setIsLoadingHistory(true);
      const res = await apiClient.getConversations({ module: 'tutor' });
      setConversations(res.conversations || []);
    } catch (e) {
      console.warn('[ArchitectureTutor] Could not load conversations from server:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Handle URL params (?conversationId=... or ?topic=...)
  useEffect(() => {
    const convParam = searchParams.get('conversationId');
    const topicParam = searchParams.get('topic');

    if (convParam) {
      loadSpecificConversation(convParam);
    }

    if (topicParam) {
      const found = TUTOR_TOPICS.find((t) => t.id === topicParam);
      if (found) {
        setSelectedTopicId(found.id);
        setInputQuestion(found.sampleQuestion);
      }
    }
  }, [searchParams]);

  // Load an existing conversation and its messages from SQLite
  const loadSpecificConversation = async (convId: string) => {
    try {
      setIsLoading(true);
      const res = await apiClient.getConversationById(convId);
      setActiveConversationId(convId);

      // Map DB messages to UI TutorMessage
      const mapped: TutorMessage[] = res.messages.map((m: MessageResponse) => {
        let citations: string[] = [];
        let followUps: string[] = [];
        try { citations = JSON.parse(m.citations_json || '[]'); } catch {}
        try { followUps = JSON.parse(m.follow_up_suggestions_json || '[]'); } catch {}

        return {
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          citations,
          followUpSuggestions: followUps,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
      });

      setMessages(mapped);
      setIsHistoryOpen(false);
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Could Not Load Conversation',
        message: e?.message || 'Conversation may have been deleted.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleAsk = async (questionToAsk?: string) => {
    const q = (questionToAsk || inputQuestion).trim();
    if (!q || isLoading) return;

    const userMessage: TutorMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedWithUser = [...messages, userMessage];
    setMessages(updatedWithUser);
    setInputQuestion('');
    setIsLoading(true);

    try {
      // Prepare history for Gemini context (last 6 turns)
      const contextHistory = messages.slice(-6).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Call AI tutor endpoint (automatically persists messages & creates conversation if needed)
      const response = await aiService.askTutor(
        q,
        selectedTopicId || undefined,
        contextHistory,
        activeConversationId || undefined
      );

      const assistantMessage: TutorMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        citations: response.citations,
        followUpSuggestions: response.followUpSuggestions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([...updatedWithUser, assistantMessage]);

      // If backend returned or assigned a conversation ID, set it
      if (response.conversationId && response.conversationId !== activeConversationId) {
        setActiveConversationId(response.conversationId);
        setSearchParams({ conversationId: response.conversationId });
      }

      // Refresh history list
      loadConversations();
    } catch (e: any) {
      console.error(e);
      showToast({
        type: 'error',
        title: 'Inquiry Failed',
        message: e?.message || 'Could not connect to architectural tutor engine. Please retry.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopicSelect = (topicId: string) => {
    const topic = TUTOR_TOPICS.find((t) => t.id === topicId);
    if (topic) {
      setSelectedTopicId(topic.id);
      setInputQuestion(topic.sampleQuestion);
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setSelectedTopicId(null);
    setInputQuestion('');
    setSearchParams({});
    setIsHistoryOpen(false);
    showToast({
      type: 'info',
      title: 'New Studio Inquiry',
      message: 'Workspace cleared. Ready for a new architectural topic or precedent inquiry.',
    });
  };

  const handleSaveMessage = async (msg: TutorMessage) => {
    try {
      await apiClient.createSavedOutput({
        type: 'tutor-note',
        title: `Tutor Analysis: ${selectedTopicId || 'Architectural Theory'}`,
        content: msg.content,
        metadata: {
          citations: msg.citations,
          followUpSuggestions: msg.followUpSuggestions,
          conversationId: activeConversationId,
        },
      });
      showToast({
        type: 'success',
        title: 'Saved to Studio Archive',
        message: 'Tutor analysis archived in SQLite studio database.',
      });
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Archive Failed',
        message: e?.message || 'Could not archive tutor output.',
      });
    }
  };

  const handleRenameConversation = async (convId: string) => {
    if (!editingTitle.trim()) return;
    try {
      await apiClient.updateConversation(convId, { title: editingTitle.trim() });
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: editingTitle.trim() } : c))
      );
      setEditingConvId(null);
      showToast({ type: 'success', title: 'Renamed', message: 'Conversation title updated in SQLite.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Rename Failed', message: e?.message });
    }
  };

  const handleDeleteConversation = async () => {
    if (!deletingConvId) return;
    try {
      await apiClient.deleteConversation(deletingConvId);
      setConversations((prev) => prev.filter((c) => c.id !== deletingConvId));
      if (activeConversationId === deletingConvId) {
        handleNewConversation();
      }
      setDeletingConvId(null);
      showToast({ type: 'info', title: 'Conversation Deleted', message: 'Conversation removed from SQLite.' });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Delete Failed', message: e?.message });
    }
  };

  return (
    <div className="relative min-h-screen py-12 lg:py-20 overflow-hidden">
      {/* Background Architectural Illustration */}
      <ArchitectureBackground
        imageSrc="/images/architecture/tutor_feathered.png"
        fallbackSrc="/images/architecture/tutor_hero_bg.jpg"
        alt="Architectural pen and ink etching of Renaissance Classical Dome with circular pool"
        alignment="right"
        opacity={0.20}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-archBorder/50">
          <PageHeading
            kicker={GENZ_VOICE.pageHeaders.tutor.kicker}
            title={GENZ_VOICE.pageHeaders.tutor.title}
            description={GENZ_VOICE.pageHeaders.tutor.subtitle}
          />

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* History Drawer Toggle Button */}
            <Button
              variant="secondary"
              size="sm"
              icon={<History className="w-4 h-4" />}
              onClick={() => {
                setIsHistoryOpen(true);
                loadConversations();
              }}
              title="View past inquiries and conversations"
            >
              Inquiry History {conversations.length > 0 && `(${conversations.length})`}
            </Button>

            {/* New Conversation Button */}
            <PrimaryButton
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={handleNewConversation}
              title="Reset conversation and start fresh"
            >
              New Conversation
            </PrimaryButton>
          </div>
        </div>

        {/* Topic Suggestion Chips */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-espresso">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Studio Topics & Precedent Inquiries</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TUTOR_TOPICS.map((topic) => {
              const isSelected = selectedTopicId === topic.id;
              return (
                <button
                  key={topic.id}
                  onClick={() => handleTopicSelect(topic.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? 'glass-pill-active shadow-arch-sm'
                      : 'glass-pill text-ink hover:text-espresso'
                  }`}
                >
                  {topic.title}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation Stream */}
        <div className="space-y-6 min-h-[350px]">
          {messages.length === 0 ? (
            /* Clean Empty State for New Inquiries */
            <div className="py-16 text-center space-y-5 rounded-3xl border border-dashed border-archBorder/60 glass-panel p-8 shadow-arch-sm">
              <div className="w-14 h-14 rounded-2xl bg-cream border border-archBorder flex items-center justify-center text-espresso mx-auto shadow-arch-sm">
                <BookOpen className="w-7 h-7 text-espresso/80" />
              </div>
              <div className="space-y-1.5 max-w-lg mx-auto">
                <h3 className="font-serif text-2xl font-semibold text-ink">
                  Ask Anything Without the Professor Side-Eye 👀
                </h3>
                <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
                  Select a starter studio dilemma below or ask your own 3 AM structural doubts — from cantilever physics to Corbusier’s Five Points:
                </p>
              </div>
              <div className="pt-2 flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {GENZ_VOICE.promptChips.tutor.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputQuestion(chip);
                    }}
                    className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-cream/90 hover:bg-cream border border-archBorder/60 hover:border-espresso/50 text-ink-muted hover:text-espresso transition-all shadow-2xs text-left"
                  >
                    💡 {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div key={msg.id} className="flex justify-end animate-fadeIn">
                    <div className="max-w-2xl bg-espresso text-cream rounded-2xl rounded-tr-sm p-4 sm:p-5 shadow-arch-sm">
                      <p className="text-sm font-sans leading-relaxed">{msg.content}</p>
                      <span className="block text-[10px] text-beige/70 text-right mt-1.5 font-mono">
                        {msg.timestamp}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg.id} className="max-w-4xl">
                  <AIResponsePanel
                    title="Studio Tutor Analysis"
                    content={msg.content}
                    citations={msg.citations}
                    followUpSuggestions={msg.followUpSuggestions}
                    onSelectFollowUp={(s) => handleAsk(s)}
                    onSave={() => handleSaveMessage(msg)}
                    isSaved={msg.isSaved}
                  />
                </div>
              );
            })
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="max-w-2xl p-6 rounded-3xl bg-cream-light/95 border border-archBorder shadow-arch-md animate-fadeIn">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-espresso flex-shrink-0" />
                <span className="text-sm font-serif text-ink">
                  {GENZ_VOICE.loadingMessages.tutor}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Question Input Workspace */}
        <div className="sticky bottom-16 md:bottom-6 z-30 pt-2">
          <div className="p-3 sm:p-4 rounded-3xl glass-panel shadow-glass">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk();
              }}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder="Ask about structural spans, facade physics, or why your cantilever is giving up 💀..."
                disabled={isLoading}
                className="flex-1 bg-transparent px-4 py-2.5 text-sm sm:text-base text-ink placeholder:text-taupe focus:outline-none"
              />

              <PrimaryButton
                type="submit"
                disabled={!inputQuestion.trim() || isLoading}
                size="md"
                icon={<Send className="w-4 h-4" />}
              >
                Inquire
              </PrimaryButton>
            </form>
          </div>
        </div>
      </div>

      {/* PDF Export Modal */}
      {activeConversationId && isPdfExportOpen && (
        <PdfExportModal
          isOpen={isPdfExportOpen}
          onClose={() => setIsPdfExportOpen(false)}
          exportType="tutor_notes"
          targetId={activeConversationId}
          defaultTitle={conversations.find((c) => c.id === activeConversationId)?.title || 'Architecture Tutor Notes'}
          defaultSubtitle={conversations.find((c) => c.id === activeConversationId)?.topic || 'Studio Inquiry Notes'}
        />
      )}

      {/* Slide-out / Modal Conversation History Panel */}
      <Modal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        title="Tutor Inquiry History"
        subtitle="Browse, reopen, rename, or delete past conversations stored in SQLite"
        maxWidth="xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-archBorder/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-espresso">
              {conversations.length} Saved Conversation{conversations.length === 1 ? '' : 's'}
            </span>
            <Button
              variant="primary"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={handleNewConversation}
            >
              Start New Inquiry
            </Button>
          </div>

          {isLoadingHistory ? (
            <div className="py-12 text-center text-sm text-ink-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-espresso" />
              <span>Loading saved inquiries...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <MessageSquare className="w-8 h-8 text-taupe mx-auto" />
              <p className="text-sm font-serif text-ink">No saved inquiries yet</p>
              <p className="text-xs text-ink-muted">
                Questions you ask the tutor will automatically appear here.
              </p>
            </div>
          ) : (
            <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
              {conversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                const isEditing = editingConvId === conv.id;

                return (
                  <div
                    key={conv.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-cream border-espresso shadow-arch-sm ring-1 ring-espresso/20'
                        : 'bg-cream/40 border-archBorder/60 hover:bg-cream hover:border-archBorder'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-cream-light border border-espresso text-ink focus:outline-none"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameConversation(conv.id);
                              if (e.key === 'Escape') setEditingConvId(null);
                            }}
                          />
                          <button
                            onClick={() => handleRenameConversation(conv.id)}
                            className="p-1 rounded text-emerald-700 hover:bg-emerald-50"
                            title="Save title"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingConvId(null)}
                            className="p-1 rounded text-rose-700 hover:bg-rose-50"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => loadSpecificConversation(conv.id)}
                          className="cursor-pointer space-y-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-serif font-semibold text-sm text-ink truncate block">
                              {conv.title}
                            </span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 text-emerald-800">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                            <span>{new Date(conv.updated_at).toLocaleDateString()}</span>
                            {conv.messages_count !== undefined && (
                              <span>&bull; {conv.messages_count} messages</span>
                            )}
                            {conv.topic && (
                              <span className="capitalize text-espresso font-mono">&bull; {conv.topic}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            setEditingConvId(conv.id);
                            setEditingTitle(conv.title);
                          }}
                          className="p-1.5 rounded-lg text-taupe hover:text-espresso hover:bg-beige/40 transition-colors"
                          title="Rename inquiry"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingConvId(conv.id)}
                          className="p-1.5 rounded-lg text-taupe hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => loadSpecificConversation(conv.id)}
                          className="p-1.5 rounded-lg text-espresso hover:bg-beige/40 transition-colors"
                          title="Reopen conversation"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* Confirmation Dialog for Deleting Conversation */}
      <ConfirmDialog
        isOpen={!!deletingConvId}
        onClose={() => setDeletingConvId(null)}
        onConfirm={handleDeleteConversation}
        title="Delete Conversation"
        message="Are you sure you want to delete this architectural tutor inquiry? All messages and citations in this conversation will be permanently removed from SQLite."
        confirmLabel="Delete Inquiry"
        isDestructive
      />
    </div>
  );
};
