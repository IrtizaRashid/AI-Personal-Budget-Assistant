import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/chatService.js';
import { formatPKR } from '../utils/format.js';

// Turn the backend's structured response into a friendly assistant message.
// (The backend does the logic; the frontend only formats for display.)
const buildAssistantMessage = (data) => {
  switch (data.intent) {
    case 'add_expense':
      return {
        role: 'assistant',
        text: `✅ Added ${data.category} expense of ${formatPKR(
          data.amount
        )}${data.description ? ` — ${data.description}` : ''}.`,
      };
    case 'remaining_budget':
      return {
        role: 'assistant',
        text: `💰 Your remaining budget is ${formatPKR(data.remainingBudget)}.`,
      };
    case 'remaining_category_budget':
      return {
        role: 'assistant',
        text: `📊 ${data.category} budget remaining: ${formatPKR(
          data.remaining
        )}.`,
      };
    case 'show_expenses':
      return {
        role: 'assistant',
        text:
          data.expenses.length === 0
            ? 'You have no expenses yet.'
            : 'Here are your expenses (newest first):',
        expenses: data.expenses,
      };
    case 'show_category_expenses':
      return {
        role: 'assistant',
        text:
          data.expenses.length === 0
            ? `You have no ${data.category} expenses yet.`
            : `Here are your ${data.category} expenses:`,
        expenses: data.expenses,
      };
    case 'show_today_expenses':
      return {
        role: 'assistant',
        text:
          data.expenses.length === 0
            ? 'You have no expenses today.'
            : "Here are today's expenses:",
        expenses: data.expenses,
      };
    case 'delete_last_expense':
      return {
        role: 'assistant',
        text: `🗑️ Deleted your last expense: ${data.deleted.category} — ${formatPKR(
          data.deleted.amount
        )}${data.deleted.description ? ` (${data.deleted.description})` : ''}.`,
      };
    case 'unknown':
      return { role: 'assistant', text: data.message };
    default:
      return { role: 'assistant', text: 'Done.' };
  }
};

// Props:
//   userId         : current user's id
//   onDataChanged  : callback to refresh the dashboard after any change
//                    (expense added OR deleted)
export default function ChatBox({ userId, onDataChanged }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! Try “I spent 500 on pizza” or “How much budget is left?”',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Ref to the bottom of the list so we can auto-scroll on new messages.
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    // Show the user's message immediately and clear the input.
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const data = await sendChatMessage(userId, text);
      setMessages((prev) => [...prev, buildAssistantMessage(data)]);

      // If the data changed (expense added or deleted), refresh the
      // dashboard, category table and expense history (no page reload).
      const changesData =
        data.intent === 'add_expense' || data.intent === 'delete_last_expense';
      if (changesData && typeof onDataChanged === 'function') {
        onDataChanged();
      }
    } catch (err) {
      const errorText =
        err.response?.data?.error ||
        'Something went wrong talking to the assistant.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `⚠️ ${errorText}`, isError: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Send on Enter (Shift+Enter could be used for newlines if it were a textarea).
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[28rem] flex-col rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      {/* Header */}
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-800">AI Assistant</h2>
        <p className="text-xs text-slate-400">Manage your budget in plain English</p>
      </div>

      {/* Scrollable chat history */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : msg.isError
                  ? 'bg-red-50 text-red-700'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              <p>{msg.text}</p>

              {/* Optional expense list for the show_expenses intent */}
              {msg.expenses && msg.expenses.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {msg.expenses.map((e) => (
                    <li
                      key={e.id}
                      className="flex justify-between gap-4 border-t border-slate-200 pt-1 text-xs"
                    >
                      <span>
                        {e.category}
                        {e.description ? ` — ${e.description}` : ''}
                      </span>
                      <span className="font-semibold">{formatPKR(e.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-500">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input + Send */}
      <div className="flex gap-2 border-t border-slate-100 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
