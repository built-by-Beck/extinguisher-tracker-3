/**
 * AI Assistant collapsible chat panel.
 * Floating button + slide-out panel for asking the AI about compliance,
 * inventory, and NFPA 10 guidance.
 *
 * Author: built_by_Beck
 */

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { askAssistant, type AiMessage } from '../../services/aiService.ts';
import { useOrg } from '../../hooks/useOrg.ts';
import { useAuth } from '../../hooks/useAuth.ts';
import type { Extinguisher } from '../../services/extinguisherService.ts';

interface AiAssistantPanelProps {
  extinguishers?: Extinguisher[];
  complianceSummary?: Record<string, number>;
}

const SUGGESTED_PROMPTS = [
  'What inspections are overdue?',
  'Explain the 6-year maintenance rule',
  'Summarize my compliance status',
  'What does NFPA 10 require monthly?',
  'Which extinguishers need hydrostatic testing?',
];

export function AiAssistantPanel({ extinguishers, complianceSummary }: AiAssistantPanelProps) {
  const { org } = useOrg();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  async function handleSend(text?: string) {
    const messageText = text ?? input.trim();
    if (!messageText || loading) return;

    setError(null);
    setInput('');

    const userMessage: AiMessage = { role: 'user', content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setLoading(true);

    try {
      const response = await askAssistant(updatedMessages, {
        orgName: org?.name,
        extinguishers,
        complianceSummary,
      });
      setMessages([...updatedMessages, { role: 'assistant', content: response }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI request failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessages([]);
    setError(null);
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition-transform hover:scale-105"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 flex h-[32rem] w-full flex-col rounded-t-xl border border-gray-200 bg-white shadow-2xl sm:bottom-6 sm:right-6 sm:h-[36rem] sm:w-96 sm:rounded-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900">AI Assistant</h3>
                <p className="text-xs text-gray-500">NFPA 10 Compliance Expert • Pro+ feature</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={handleClear}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Clear chat"
                  title="Clear chat"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <Sparkles className="mx-auto mb-2 h-8 w-8 text-red-500/50" />
                  <p className="text-sm font-medium text-gray-700">
                    Hi{user?.displayName ? `, ${user.displayName}` : ''}!
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Ask me about NFPA 10 compliance, your inventory, or inspection schedules.
                  </p>
                  <p className="mt-2 text-[11px] text-gray-400">
                    Included with Pro, Elite, and Enterprise plans.
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-400 uppercase">Try asking</p>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void handleSend(prompt)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 hover:bg-gray-50 hover:border-red-300 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 px-4 py-3">
            <form
              onSubmit={(e) => { e.preventDefault(); void handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about compliance, inspections..."
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-gray-400">
              AI access is included with Pro, Elite, and Enterprise plans.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
