import { useState } from 'react';
import { sendChatMessage } from '../services/chatService.js';
import { formatPKR } from '../utils/format.js';
import ConfirmationCard from './ConfirmationCard.jsx';
import DuplicateCard from './DuplicateCard.jsx';
import VoiceInput from './VoiceInput.jsx';
import ReallocationReviewCard from './ReallocationReviewCard.jsx';
import SharedSplitCard from './SharedSplitCard.jsx';

// Renders a rich AI query answer — handles bullet points, numbered lists, line breaks.
const RichAnswer = ({ text, meta }) => {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        // Bullet point
        if (/^[-•*]\s/.test(trimmed)) {
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-fuchsia-400">•</span>
              <span className="text-sm text-slate-200">{trimmed.replace(/^[-•*]\s/, '')}</span>
            </div>
          );
        }
        // Numbered list
        if (/^\d+\.\s/.test(trimmed)) {
          const num = trimmed.match(/^\d+/)[0];
          return (
            <div key={i} className="flex gap-2">
              <span className="shrink-0 text-xs font-bold text-fuchsia-400 mt-0.5">{num}.</span>
              <span className="text-sm text-slate-200">{trimmed.replace(/^\d+\.\s/, '')}</span>
            </div>
          );
        }
        // Bold-ish headers (all caps or ending with colon)
        if (/^[A-Z][A-Z\s]+:?$/.test(trimmed) || trimmed.endsWith(':')) {
          return <p key={i} className="text-xs font-semibold uppercase tracking-wide text-fuchsia-300 mt-2">{trimmed}</p>;
        }
        // Regular line
        return <p key={i} className="text-sm text-slate-200 leading-relaxed">{trimmed}</p>;
      })}
      {meta?.modules?.length > 0 && (
        <p className="mt-2 text-[10px] text-slate-500">
          Sources: {meta.modules.join(', ')}{meta.dateRange ? ` · ${meta.dateRange}` : ''}{meta.person ? ` · about ${meta.person}` : ''}
        </p>
      )}
    </div>
  );
};

// Shown when an investment_buy fails because Savings balance is insufficient.
// Offers two choices: cancel the investment, or transfer from another category.
const InsufficientSavingsCard = ({ data, categories = [], userId, onCancelled, onInvested }) => {
  const { available = 0, required = 0, shortfall = 0, savingsCategory = 'Savings', pending } = data;
  const [step, setStep]       = useState('prompt'); // 'prompt' | 'transfer' | 'loading'
  const [fromCat, setFromCat] = useState('');
  const [transferAmt, setTransferAmt] = useState(String(shortfall > 0 ? shortfall : ''));
  const [errMsg, setErrMsg]   = useState('');

  const otherCats = categories
    .filter(c => !c.category?.toLowerCase().includes('saving') && (c.remaining ?? 0) > 0)
    .map(c => ({ name: c.category, remaining: c.remaining }));

  const handleTransfer = async () => {
    setErrMsg('');
    if (!fromCat) { setErrMsg('Select a category.'); return; }
    const amt = Number(transferAmt);
    if (!amt || amt <= 0) { setErrMsg('Enter a valid amount.'); return; }
    if (amt < shortfall) { setErrMsg(`Need at least Rs ${shortfall.toLocaleString()} to cover the shortfall.`); return; }
    setStep('loading');
    try {
      // 1. Transfer to Savings
      const tr = await fetch('/api/categories/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, fromCategory: fromCat, amount: amt }),
      });
      const trData = await tr.json();
      if (!trData.success) throw new Error(trData.message || 'Transfer failed.');

      // 2. Retry investment (savings now funded)
      const inv = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          message: `invest ${pending.amount} in ${pending.name}${pending.type ? ` (${pending.type})` : ''}`,
          _skipSavingsCheck: true,
        }),
      });
      const invData = await inv.json();
      if (!invData.success) throw new Error(invData.message || 'Investment failed after transfer.');
      onInvested(invData);
    } catch (err) {
      setErrMsg(err.message);
      setStep('transfer');
    }
  };

  return (
    <div className="space-y-3 text-sm">
      <p className="text-amber-300 font-medium">
        ⚠️ Insufficient Savings — you have <span className="text-white font-semibold">Rs {Number(available).toLocaleString()}</span> but need <span className="text-white font-semibold">Rs {Number(required).toLocaleString()}</span> (shortfall: Rs {Number(shortfall).toLocaleString()}).
      </p>
      <p className="text-slate-400 text-xs">Investments can only be funded from the {savingsCategory} category.</p>

      {step === 'prompt' && (
        <div className="flex gap-2">
          <button
            onClick={() => setStep('transfer')}
            className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
          >
            Transfer from another category
          </button>
          <button
            onClick={onCancelled}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition"
          >
            Cancel investment
          </button>
        </div>
      )}

      {step === 'transfer' && (
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-wide mb-1">Transfer from</label>
            <select
              value={fromCat}
              onChange={e => setFromCat(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1a0d2e] px-3 py-2 text-xs text-white focus:border-fuchsia-500 focus:outline-none"
            >
              <option value="">— pick a category —</option>
              {otherCats.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} (Rs {Number(c.remaining).toLocaleString()} available)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 uppercase tracking-wide mb-1">Amount to transfer (Rs)</label>
            <input
              type="number" min="1"
              value={transferAmt}
              onChange={e => setTransferAmt(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#1a0d2e] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none"
              placeholder={`Min Rs ${Number(shortfall).toLocaleString()}`}
            />
          </div>
          {errMsg && <p className="text-xs text-red-400">{errMsg}</p>}
          <div className="flex gap-2">
            <button onClick={handleTransfer} className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-600 to-purple-600 px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition">
              Transfer & Invest
            </button>
            <button onClick={onCancelled} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'loading' && (
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-fuchsia-400" />
          Transferring and investing…
        </div>
      )}
    </div>
  );
};

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
    case 'income_received': {
      if (data.status === 'amount_needed') {
        return { role: 'assistant', text: `💰 ${data.message}` };
      }
      if (data.status === 'review_allocations') {
        return {
          role: 'assistant',
          text: `💰 ${data.message}`,
          type: 'reallocation_review',
          reallocation: data.reallocation,
        };
      }
      return { role: 'assistant', text: data.message || 'Income recorded.' };
    }
    case 'shared_expense': {
      if (data.status === 'missing_amount') return { role: 'assistant', text: `🤝 ${data.message}` };
      const loanLines = (data.loans || []).map(l => `  • ${l.person_name} owes you ${formatPKR(l.amount)}`).join('\n');
      return {
        role: 'assistant',
        text: `🤝 ${data.message}${loanLines ? '\n\nLoans created:\n' + loanLines : ''}${data.myShare ? `\n\nYour share: ${formatPKR(data.myShare)}` : ''}`,
      };
    }
    case 'loan_given':
      return { role: 'assistant', text: `🤝 ${data.message || 'Loan recorded.'}` };
    case 'loan_taken':
      return { role: 'assistant', text: `💸 ${data.message || 'Loan recorded.'}` };
    case 'loan_repaid': {
      if (!data.success && !data.results) return { role: 'assistant', text: `ℹ️ ${data.message}` };

      // Multi-person result
      if (Array.isArray(data.results)) {
        const lines = data.results.map(r => {
          if (!r.success) return `⚠️ ${r.message}`;
          return r.fullyPaid
            ? `✅ ${r.message}`
            : `🔄 ${r.message}`;
        });
        return { role: 'assistant', text: lines.join('\n') };
      }

      // Single person result
      const lines = [
        `✅ ${data.message}`,
        ``,
        `Person: ${data.person}`,
        `Amount: ${formatPKR(data.amountReceived)}`,
        data.fullyPaid
          ? `Remaining: Rs 0  |  Status: Fully Paid ✅`
          : `Remaining: ${formatPKR(data.remaining)}  |  Status: Partially Paid`,
      ];
      return { role: 'assistant', text: lines.join('\n') };
    }
    case 'show_loans': {
      const list = data.loans || [];
      if (list.length === 0) return { role: 'assistant', text: 'No loans on record.', type: 'show_loans', loans: [] };
      return { role: 'assistant', text: null, type: 'show_loans', loans: list };
    }
    case 'ai_query':
      if (!data.success) return { role: 'assistant', text: `⚠️ ${data.answer || data.message}` };
      return {
        role: 'assistant',
        text: data.answer,
        isRichAnswer: true,
        meta: data.meta,
      };
    case 'investment_buy':
      if (!data.success) return { role: 'assistant', text: `⚠️ ${data.message}` };
      return { role: 'assistant', text: `📈 ${data.message}` };
    case 'investment_sell':
      if (!data.success) return { role: 'assistant', text: `⚠️ ${data.message}` };
      return { role: 'assistant', text: `📉 ${data.message}` };
    case 'investment_dividend':
      if (!data.success) return { role: 'assistant', text: `⚠️ ${data.message}` };
      return { role: 'assistant', text: `💹 ${data.message}` };
    case 'show_investments': {
      const { investments = [], summary: invSum = {} } = data;
      if (investments.length === 0) return { role: 'assistant', text: 'No investments on record. Try: "I invested 5000 in Apple"' };
      const lines = investments.map(inv => {
        const pl = Number(inv.profit_loss || 0);
        const sign = pl >= 0 ? '+' : '';
        return `• ${inv.name} (${inv.type}) — ${formatPKR(inv.invested_amount)} invested · P&L: ${sign}${formatPKR(pl)} (${sign}${inv.return_pct}%)`;
      }).join('\n');
      const header = `📊 Portfolio — ${investments.length} position(s) · Total invested: ${formatPKR(invSum.totalInvested || 0)}`;
      return { role: 'assistant', text: `${header}\n${lines}` };
    }
    case 'chat':
      return { role: 'assistant', text: data.message || data.reply || "I'm here to help!" };
    case 'unknown':
      return { role: 'assistant', text: data.message };
    default:
      return { role: 'assistant', text: data.message || 'Done.' };
  }
};

// Compact loan list rendered inside the chat bubble for show_loans intent.
function LoanList({ loans = [] }) {
  if (loans.length === 0) return <p className="text-slate-400 text-xs">No loans on record.</p>;

  const given = loans.filter((l) => l.type === 'given');
  const taken = loans.filter((l) => l.type === 'taken');

  const Section = ({ title, icon, items, amountClass }) =>
    items.length === 0 ? null : (
      <div className="mb-2">
        <p className="mb-1 text-xs font-semibold text-slate-400 uppercase tracking-wide">{icon} {title}</p>
        {items.map((l) => (
          <div key={l.id} className="flex justify-between gap-3 border-t border-white/10 py-1 text-xs">
            <span className="text-slate-300">{l.person_name}{l.description ? ` · ${l.description}` : ''}</span>
            <span className={`font-semibold shrink-0 ${amountClass} ${l.status === 'paid' ? 'line-through opacity-50' : ''}`}>
              {formatPKR(l.amount)}
            </span>
          </div>
        ))}
      </div>
    );

  return (
    <div className="mt-1">
      <Section title="Owed to You" icon="💰" items={given} amountClass="text-emerald-400" />
      <Section title="You Owe" icon="💸" items={taken} amountClass="text-red-400" />
    </div>
  );
}

// Props:
//   userId         : current user's id
//   categories     : current categories (used by the over-budget transfer flow)
//   onDataChanged  : callback to refresh the dashboard after any change
//   onWarning      : callback to surface a budget warning toast
//   onMonthlyLimit : callback when the total monthly budget is exceeded
//   onReallocationSaved : callback when budget reallocation is saved
//   budgetFull     : true when the monthly budget is fully utilized (locks input)
export default function ChatBox({
  userId,
  categories = [],
  onDataChanged,
  onWarning,
  onMonthlyLimit,
  onReallocationSaved,
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

      // Shared expense — split type not yet known; show split picker
      if (data.intent === 'shared_expense' && data.status === 'split_needed') {
        const names = (data.people || []).join(' and ');
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            type: 'split_needed',
            expense: data,
            text: `🤝 ${names ? `You and ${names}` : 'Multiple people'} shared ${data.description || 'an expense'} for ${formatPKR(data.total)}. How would you like to split it?`,
          },
        ]);
        return;
      }

      // Insufficient savings for an investment — show 2-option card
      if (data.intent === 'investment_buy' && !data.success && data.reason === 'insufficient_savings') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', type: 'insufficient_savings', savingsData: data },
        ]);
        return;
      }

      const assistantMsg = buildAssistantMessage(data);
      setMessages((prev) => [...prev, assistantMsg]);

      // Optionally read the reply aloud.
      if (speakResponses) speak(assistantMsg.text);

      // Refresh dashboard after any data-changing intent
      const changesData =
        data.intent === 'add_expense' ||
        data.intent === 'delete_last_expense' ||
        data.intent === 'delete_last_category_expense' ||
        (data.intent === 'shared_expense' && data.success) ||
        (data.intent === 'loan_given' && data.success) ||
        (data.intent === 'loan_taken' && data.success) ||
        (data.intent === 'loan_repaid' && data.success) ||
        (data.intent === 'income_received' && data.status === 'saved') ||
        (data.intent === 'investment_buy' && data.success) ||
        (data.intent === 'investment_sell' && data.success) ||
        (data.intent === 'investment_dividend' && data.success);
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
        err.message ||
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
              {/* Interactive cards */}
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
              ) : msg.type === 'reallocation_review' ? (
                <ReallocationReviewCard
                  reallocation={msg.reallocation}
                  onSaved={onReallocationSaved}
                  onCancelled={() => setMessages(prev => [...prev, { role: 'assistant', text: 'Reallocation cancelled.' }])}
                />
              ) : msg.type === 'split_needed' ? (
                <>
                  <p className="mb-2">{msg.text}</p>
                  <SharedSplitCard
                    expense={msg.expense}
                    userId={userId}
                    onSaved={(result) => {
                      setMessages((prev) => [
                        ...prev.slice(0, i),
                        { role: 'assistant', text: `✅ ${result.message || 'Expense split and recorded.'}` },
                        ...prev.slice(i + 1),
                      ]);
                      onDataChanged?.();
                    }}
                    onCancelled={() =>
                      setMessages((prev) => [
                        ...prev.slice(0, i),
                        { role: 'assistant', text: 'Split cancelled.' },
                        ...prev.slice(i + 1),
                      ])
                    }
                  />
                </>
              ) : msg.type === 'insufficient_savings' ? (
                <InsufficientSavingsCard
                  data={msg.savingsData}
                  categories={categories}
                  userId={userId}
                  onCancelled={() =>
                    setMessages((prev) => [
                      ...prev.slice(0, i),
                      { role: 'assistant', text: 'Investment cancelled.' },
                      ...prev.slice(i + 1),
                    ])
                  }
                  onInvested={(result) => {
                    setMessages((prev) => [
                      ...prev.slice(0, i),
                      { role: 'assistant', text: `📈 ${result.message}` },
                      ...prev.slice(i + 1),
                    ]);
                    onDataChanged?.();
                  }}
                />
              ) : msg.type === 'show_loans' ? (
                <LoanList loans={msg.loans} />
              ) : msg.isRichAnswer ? (
                <RichAnswer text={msg.text} meta={msg.meta} />
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
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
            <div className="rounded-2xl bg-white/10 px-4 py-2 text-sm text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-400 [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-pink-400 [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-purple-400" />
                </span>
                <span className="text-xs">AI is thinking… (may take 20–40s)</span>
              </span>
            </div>
          </div>
        )}

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
