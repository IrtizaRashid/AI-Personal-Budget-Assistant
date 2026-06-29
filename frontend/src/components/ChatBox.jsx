import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/chatService.js';
import { formatPKR } from '../utils/format.js';
import ConfirmationCard from './ConfirmationCard.jsx';
import DuplicateCard from './DuplicateCard.jsx';
import VoiceInput from './VoiceInput.jsx';

// Turn the backend's structured response into a friendly assistant message.
// (The backend does the logic; the frontend only formats for display.)
const buildAssistantMessage = (data) => {
  switch (data.intent) {
    case 'add_expense': {
      // Clarification needed (ambiguous expense — missing amount or category)
      if (data.status === 'clarification_needed') {
        return { role: 'assistant', text: `🤔 ${data.message}` };
      }
      // Multiple expenses — data.added is an array
      if (Array.isArray(data.added)) {
        const lines = data.added
          .map(
            (e) =>
              `• ${e.category} — ${formatPKR(e.amount)}${e.description ? ` (${e.description})` : ''}`
          )
          .join('\n');
        const errorNote = data.errors?.length
          ? `\n⚠️ ${data.errors.length} item(s) could not be added.`
          : '';
        return { role: 'assistant', text: `✅ ${data.summary}\n${lines}${errorNote}` };
      }
      // Single expense — category / amount at top level
      return {
        role: 'assistant',
        text: `✅ Added ${data.category} expense of ${formatPKR(data.amount)}${
          data.description ? ` — ${data.description}` : ''
        }.`,
      };
    }
    case 'remaining_budget':
      return {
        role: 'assistant',
        text: `💰 Your remaining budget is ${formatPKR(data.remainingBudget)}.`,
      };
    case 'remaining_category_budget':
      return {
        role: 'assistant',
        text: `📊 ${data.category} budget remaining: ${formatPKR(data.remaining)}.`,
      };
    case 'show_expenses':
      return {
        role: 'assistant',
        text: data.expenses.length === 0 ? 'You have no expenses yet.' : 'Here are your expenses (newest first):',
        expenses: data.expenses,
      };
    case 'show_category_expenses':
      return {
        role: 'assistant',
        text: data.expenses.length === 0
          ? `You have no ${data.category} expenses yet.`
          : `Here are your ${data.category} expenses:`,
        expenses: data.expenses,
      };
    case 'show_today_expenses':
      return {
        role: 'assistant',
        text: data.expenses.length === 0 ? 'You have no expenses today.' : "Here are today's expenses:",
        expenses: data.expenses,
      };
    case 'show_week_expenses':
      return {
        role: 'assistant',
        text: data.expenses.length === 0 ? 'No expenses in the last 7 days.' : "Here are this week's expenses:",
        expenses: data.expenses,
      };
    case 'show_month_expenses':
      return {
        role: 'assistant',
        text: data.expenses.length === 0 ? 'No expenses this month.' : "Here are this month's expenses:",
        expenses: data.expenses,
      };
    case 'budget_summary': {
      const lines = (data.categories || [])
        .map((c) => `• ${c.category}: ${formatPKR(c.spent)} / ${formatPKR(c.allocated)}`)
        .join('\n');
      return {
        role: 'assistant',
        text: `📊 Budget Summary\nTotal: ${formatPKR(data.monthlyBudget)} | Spent: ${formatPKR(
          data.totalSpent
        )} | Left: ${formatPKR(data.remainingBudget)}\n\n${lines}`,
      };
    }
    case 'delete_last_expense':
      return {
        role: 'assistant',
        text: `🗑️ Deleted your last expense: ${data.deleted.category} — ${formatPKR(
          data.deleted.amount
        )}${data.deleted.description ? ` (${data.deleted.description})` : ''}.`,
      };
    case 'delete_last_category_expense':
      return {
        role: 'assistant',
        text: `🗑️ Deleted last ${data.deleted.category} expense: ${formatPKR(data.deleted.amount)}${
          data.deleted.description ? ` (${data.deleted.description})` : ''
        }.`,
      };
    case 'chat':
      return { role: 'assistant', text: data.message || data.reply || "I'm here to help!" };
    case 'unknown':
      return { role: 'assistant', text: data.message };
    default:
      return { role: 'assistant', text: data.message || 'Done.' };
  }
};

// Props:
//   userId         : current user's id
//   categories     : current categories (used by the over-budget transfer flow)
//   onDataChanged  : callback to refresh the dashboard after any change
//   onWarning      : callback to surface a budget warning toast
//   onMonthlyLimit : callback when the total monthly budget is exceeded
//   budgetFull     : true when the monthly budget is fully utilized (locks input)
export default function ChatBox({
  userId,
  categories = [],
  onDataChanged,
  onWarning,
  onMonthlyLimit,
  budgetFull = false,
}) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi! Try “I spent 500 on pizza” or “How much budget is left?”',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // Speech Synthesis: read AI replies aloud when ON.
  const [speakResponses, setSpeakResponses] = useState(false);

  // Ref to the bottom of the list so we can auto-scroll on new messages.
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Read text aloud with the browser's Speech Synthesis API.
  const speak = (text) => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel(); // stop anything already speaking
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // Core send routine — accepts the text directly so it works for both typed
  // input AND voice transcripts (avoids relying on async state updates).
  const sendMessage = async (rawText) => {
    const text = (rawText ?? '').trim();
    if (!text || loading || budgetFull) return;

    // Show the user's message immediately and clear the input.
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const data = await sendChatMessage(userId, text);

      // Total monthly budget exceeded — show the blocking modal. Nothing saved.
      if (data.status === 'monthly_budget_exceeded') {
        onMonthlyLimit?.(data);
        return;
      }

      // Insufficient category budget — show the interactive confirmation card
      // instead of a normal text reply. No expense is inserted yet.
      if (data.status === 'confirmation_required') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', type: 'confirmation', expense: data.expense },
        ]);
        return;
      }

      // Possible duplicate — ask the user before inserting.
      if (data.status === 'duplicate_detected') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', type: 'duplicate', expense: data.existingExpense },
        ]);
        return;
      }

      const assistantMsg = buildAssistantMessage(data);
      setMessages((prev) => [...prev, assistantMsg]);

      // Optionally read the reply aloud.
      if (speakResponses) speak(assistantMsg.text);

      // If the data changed (expense added or deleted), refresh the
      // dashboard, category table and expense history (no page reload).
      const changesData =
        data.intent === 'add_expense' ||
        data.intent === 'delete_last_expense' ||
        data.intent === 'delete_last_category_expense';
      if (changesData && data.status !== 'clarification_needed' && typeof onDataChanged === 'function') {
        onDataChanged();
      }

      // Surface any budget warning returned after recording the expense.
      const warning = data.budgetWarning || data.budgetWarnings?.[0];
      if (warning && typeof onWarning === 'function') {
        onWarning(warning);
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

  const handleSend = () => sendMessage(input);

  // Voice transcript -> show it in the box, then send automatically.
  const handleVoiceResult = (transcript) => {
    setInput(transcript);
    sendMessage(transcript);
  };

  // Surface voice errors as a friendly assistant message.
  const handleVoiceError = (message) => {
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', text: `🎤 ${message}`, isError: true },
    ]);
  };

  // Send on Enter (Shift+Enter could be used for newlines if it were a textarea).
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 px-6 py-4 shadow-lg shadow-fuchsia-500/20">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <span>🤖</span> AI Assistant
          </h2>
          <p className="text-xs text-pink-100">
            Type or speak in plain English
          </p>
        </div>

        {/* Voice Responses toggle (Speech Synthesis) */}
        <button
          type="button"
          onClick={() => {
            // When turning off, stop any current narration.
            if (speakResponses) window.speechSynthesis?.cancel();
            setSpeakResponses((v) => !v);
          }}
          title="Read AI replies aloud"
          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition ${
            speakResponses
              ? 'bg-white text-fuchsia-700'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          🔊 {speakResponses ? 'ON' : 'OFF'}
        </button>
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
                  ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white'
                  : msg.isError
                  ? 'bg-red-500/15 text-red-300'
                  : 'bg-white/10 text-slate-200'
              }`}
            >
              {/* Interactive cards (insufficient budget / duplicate) */}
              {msg.type === 'confirmation' ? (
                <ConfirmationCard
                  userId={userId}
                  expense={msg.expense}
                  categories={categories}
                  onChanged={onDataChanged}
                  onWarning={onWarning}
                />
              ) : msg.type === 'duplicate' ? (
                <DuplicateCard
                  userId={userId}
                  expense={msg.expense}
                  onChanged={onDataChanged}
                  onWarning={onWarning}
                />
              ) : (
                <p>{msg.text}</p>
              )}

              {/* Optional expense list for the show_expenses intent */}
              {msg.expenses && msg.expenses.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {msg.expenses.map((e) => (
                    <li
                      key={e.id}
                      className="flex justify-between gap-4 border-t border-white/10 pt-1 text-xs"
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
            <div className="rounded-2xl bg-white/10 px-4 py-2 text-sm">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400" />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* When the monthly budget is fully used, lock all expense input. */}
      {budgetFull && (
        <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-300">
          Monthly budget fully utilized — delete an expense or start a new month
          to add more.
        </div>
      )}

      {/* Input + Voice + Send */}
      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={budgetFull ? 'Monthly budget reached' : 'Type or speak a message…'}
          disabled={loading || budgetFull}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 disabled:opacity-50"
        />

        {/* Microphone (Web Speech API) — also disabled when budget is full */}
        <VoiceInput
          onResult={handleVoiceResult}
          onError={handleVoiceError}
          disabled={loading || budgetFull}
        />
        <button
          onClick={handleSend}
          disabled={loading || budgetFull || !input.trim()}
          className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-5 py-2 text-sm font-semibold text-white shadow shadow-fuchsia-500/30 transition hover:from-fuchsia-500 hover:to-pink-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
