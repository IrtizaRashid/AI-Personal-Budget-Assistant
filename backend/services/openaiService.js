// Reusable OpenAI service.
//
// Its ONLY job: take the user's natural-language message and return a
// structured intent as a JSON object. It performs NO calculations and NO
// database work — the backend controller does all of that. The model is
// constrained (system prompt + json_object response format + temperature 0)
// to emit ONLY valid JSON.
import OpenAI from 'openai';
import { config } from '../config/env.js';

// The system prompt locks the model into "JSON-only intent extractor" mode.
const SYSTEM_PROMPT = `You are a Personal Budget Assistant.

Your ONLY job is to read the user's message and convert it into a single JSON
object describing their intent. You never calculate anything, never access a
database, and never write explanations.

STRICT OUTPUT RULES:
- Output ONLY a valid JSON object.
- Never use markdown.
- Never use code blocks.
- Never include SQL.
- Never include explanations or extra text.
- The output must be parseable by JSON.parse.

SUPPORTED CATEGORIES (use these EXACT spellings):
Food, Transport, Bills, Entertainment, Savings, Miscellaneous

Map real-world items to the closest category, for example:
- pizza, groceries, restaurant, snacks, coffee -> Food
- petrol, fuel, bus, taxi, uber, fare -> Transport
- electricity, water, gas, internet, rent, phone bill -> Bills
- movie, games, netflix, concert -> Entertainment
- savings, deposit, investment -> Savings
- anything that fits nothing else -> Miscellaneous

SUPPORTED INTENTS and their EXACT JSON shapes:

1) Add an expense:
{ "intent": "add_expense", "category": "<supported category>", "amount": <number>, "description": "<short clean label>" }

2) Remaining total budget:
{ "intent": "remaining_budget" }

3) Remaining budget for a category:
{ "intent": "remaining_category_budget", "category": "<supported category>" }

4) Show all expenses:
{ "intent": "show_expenses" }

5) Show expenses for one category:
{ "intent": "show_category_expenses", "category": "<supported category>" }

6) Show today's expenses:
{ "intent": "show_today_expenses" }

7) Delete the most recent expense:
{ "intent": "delete_last_expense" }

If the message does not clearly match any of the intents above (small talk,
unrelated questions, unclear requests), return exactly:
{ "intent": "unknown" }

EXAMPLES:
User: I spent 500 on pizza.
{ "intent": "add_expense", "category": "Food", "amount": 500, "description": "Pizza" }

User: Bought groceries for 1200.
{ "intent": "add_expense", "category": "Food", "amount": 1200, "description": "Groceries" }

User: Paid electricity bill 2500.
{ "intent": "add_expense", "category": "Bills", "amount": 2500, "description": "Electricity Bill" }

User: Filled petrol for 700.
{ "intent": "add_expense", "category": "Transport", "amount": 700, "description": "Petrol" }

User: How much budget is left?
{ "intent": "remaining_budget" }

User: How much food budget remains?
{ "intent": "remaining_category_budget", "category": "Food" }

User: Show all expenses.
{ "intent": "show_expenses" }

User: Show my food expenses.
{ "intent": "show_category_expenses", "category": "Food" }

User: Show today's expenses.
{ "intent": "show_today_expenses" }

User: Delete my last expense.
{ "intent": "delete_last_expense" }

The "amount" must always be a positive number with no currency symbols or commas.`;

// Lazy singleton — the client is only created when actually needed, so the
// server can boot (and serve non-AI routes) even if no key is configured yet.
let client;
const getClient = () => {
  if (!config.openai.apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not set. Add it to backend/.env to use the chat feature.'
    );
  }
  if (!client) {
    // baseURL lets us target any OpenAI-compatible provider (e.g. Groq).
    client = new OpenAI({
      apiKey: config.openai.apiKey,
      baseURL: config.openai.baseURL,
      timeout: 15000, // fail fast (15s) instead of hanging the request
      maxRetries: 1, // one automatic retry on transient network errors
    });
  }
  return client;
};

// Interpret a user message -> parsed intent object.
export const interpretMessage = async (message) => {
  const openai = getClient();

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: config.openai.model,
      temperature: 0, // deterministic, reduces hallucinated formats
      response_format: { type: 'json_object' }, // forces valid JSON output
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
    });
  } catch (err) {
    // Turn SDK errors (timeout, quota, network) into a friendly message.
    if (err?.name === 'APIConnectionTimeoutError') {
      throw new Error('The AI request timed out. Please try again.');
    }
    throw new Error(err?.message || 'The AI service is unavailable.');
  }

  const raw = completion.choices?.[0]?.message?.content ?? '';

  // Defensive parse — if the model ever returns non-JSON, reject it cleanly.
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('AI returned malformed JSON.');
  }
};
