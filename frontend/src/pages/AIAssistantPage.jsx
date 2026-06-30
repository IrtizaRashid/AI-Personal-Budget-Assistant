import { useState } from 'react';
import { universalQuery } from '../services/api.js';

export default function AIAssistantPage() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const result = await universalQuery({ query });
      setResponse(result.answer || result.response || 'No response received.');
      setHistory([...history, { query, response: result.answer || result.response }]);
      setQuery('');
    } catch (error) {
      setResponse('Sorry, I encountered an error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
      </div>

      {/* Chat Container */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
        <div className="border-b border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Ask me anything about your finances</h2>
        </div>

        {/* Chat History */}
        <div className="h-[400px] overflow-y-auto p-6 space-y-4">
          {history.length === 0 && !response && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="text-4xl mb-4">🤖</div>
              <p className="text-sm">Ask me questions like:</p>
              <ul className="mt-2 text-sm space-y-1">
                <li>"How much did I spend on food this month?"</li>
                <li>"What's my savings rate?"</li>
                <li>"Am I over budget in any category?"</li>
              </ul>
            </div>
          )}

          {history.map((item, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-white">
                  {item.query}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl bg-white/10 px-4 py-2 text-slate-200">
                  {item.response}
                </div>
              </div>
            </div>
          ))}

          {response && !history.some(h => h.response === response) && (
            <div className="space-y-2">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-white">
                  {query}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl bg-white/10 px-4 py-2 text-slate-200">
                  {response}
                </div>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white/10 px-4 py-2 text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-500" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-500 delay-100" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-fuchsia-500 delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="border-t border-white/10 p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about your finances..."
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-6 py-3 font-semibold text-white hover:from-fuchsia-500 hover:to-pink-500 transition-all disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Quick Questions */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-slate-400">Quick Questions</h3>
        <div className="flex flex-wrap gap-2">
          {[
            "What's my total income?",
            "How much did I spend?",
            "Am I over budget?",
            "What's my savings rate?",
            "Show my top expenses",
          ].map((question) => (
            <button
              key={question}
              onClick={() => setQuery(question)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10 transition-all"
            >
              {question}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
