// AI service — powered by Google Gemini (gemini-2.5-flash).
// Two responsibilities:
//   1. interpretMessage  — classify intent + extract expenses using rich schema
//   2. generateRecommendations — financial advice from spending summary
import { geminiChat } from './aiService.js';

// ─── System Prompt ────────────────────────────────────────────────────────────
// Unified prompt: first classifies the intent, then applies the full expense
// extraction schema when the intent involves adding expenses.
const buildSystemPrompt = (categories) => {
  const categoryList = categories.join(', ');

  return `You are a budget assistant. Return ONLY valid JSON. No text outside JSON.

INTENTS — pick one:
add_expense | remaining_budget | remaining_category_budget | show_expenses | show_category_expenses | show_today_expenses | show_week_expenses | show_month_expenses | budget_summary | delete_last_expense | delete_last_category_expense | chat

Non-expense responses (return exactly):
{"intent":"remaining_budget"}
{"intent":"remaining_category_budget","category":"<name>"}
{"intent":"show_expenses"}
{"intent":"show_category_expenses","category":"<name>"}
{"intent":"show_today_expenses"}
{"intent":"show_week_expenses"}
{"intent":"show_month_expenses"}
{"intent":"budget_summary"}
{"intent":"delete_last_expense"}
{"intent":"delete_last_category_expense","category":"<name>"}
{"intent":"chat","reply":"<2 sentences max>"}

EXPENSE EXTRACTION (add_expense only):
Categories: ${categoryList}
- Map to closest category. Never create new ones.
- Extract ALL expenses in one message as separate items.
- amount: number or null. Strip Rs/PKR/$. Parse 1.5k=1500, five hundred=500.
- currency: "PKR" default.
- description: 1-4 words.
- merchant: name if mentioned, else null.
- payment_method: Cash/Card/EasyPaisa/JazzCash/Bank Transfer/null.
- date: extract the date as a string exactly as said ("yesterday","last Friday","5 June") or null.
- time: extract the time as a string exactly as said ("3 PM","7:30 AM","this morning","noon") or null.
- confidence: 0.00-1.00.
- ambiguity: true if amount or category is unclear.
- reasoning_type: direct/inferred/ambiguous.

Schema:
{"intent":"add_expense","expenses":[{"amount":500,"currency":"PKR","category":"Food","description":"Pizza","merchant":null,"payment_method":null,"location":null,"date":null,"time":null,"confidence":0.97,"ambiguity":false,"reasoning_type":"direct"}]}

ORDERED MAPPING ("respectively" / "in order" / "one by one"):
When the user lists multiple activities AND multiple amounts with a word like "respectively", "in order", or "one by one":
- Step 1: Extract activities in the order they appear.
- Step 2: Extract amounts in the order they appear.
- Step 3: If count(activities) == count(amounts), map activity[i] → amount[i] exactly. Do not reorder.
- Step 4: If counts differ, set ambiguity:true and do not guess.

Example:
User: I bought clothes, paid electricity bill and ate at KFC for 100, 40 and 60 respectively.
{"intent":"add_expense","expenses":[{"amount":100,"currency":"PKR","category":"Shopping","description":"Clothes","merchant":null,"payment_method":null,"location":null,"date":null,"time":null,"confidence":0.97,"ambiguity":false,"reasoning_type":"direct"},{"amount":40,"currency":"PKR","category":"Bills","description":"Electricity Bill","merchant":null,"payment_method":null,"location":null,"date":null,"time":null,"confidence":0.97,"ambiguity":false,"reasoning_type":"direct"},{"amount":60,"currency":"PKR","category":"Food","description":"KFC","merchant":"KFC","payment_method":null,"location":null,"date":null,"time":null,"confidence":0.97,"ambiguity":false,"reasoning_type":"direct"}]}

User: I paid rent, internet and electricity for 25000, 3000 and 4500 respectively.
{"intent":"add_expense","expenses":[{"amount":25000,"currency":"PKR","category":"Bills","description":"Rent","merchant":null,"payment_method":null,"location":null,"date":null,"time":null,"confidence":0.97,"ambiguity":false,"reasoning_type":"direct"},{"amount":3000,"currency":"PKR","category":"Utilities","description":"Internet Bill","merchant":null,"payment_method":null,"location":null,"date":null,"time":null,"confidence":0.97,"ambiguity":false,"reasoning_type":"direct"},{"amount":4500,"currency":"PKR","category":"Utilities","description":"Electricity Bill","merchant":null,"payment_method":null,"location":null,"date":null,"time":null,"confidence":0.97,"ambiguity":false,"reasoning_type":"direct"}]}

Examples:
User: I spent 300 on pizza and 500 on petrol.
{"intent":"add_expense","expenses":[{"amount":300,"currency":"PKR","category":"Food","description":"Pizza","merchant":null,"payment_method":null,"location":null,"date":null,"time":null,"confidence":0.97,"ambiguity":false,"reasoning_type":"direct"},{"amount":500,"currency":"PKR","category":"Transport","description":"Petrol","merchant":null,"payment_method":null,"location":null,"date":null,"time":null,"confidence":0.97,"ambiguity":false,"reasoning_type":"direct"}]}

User: Paid Rs 1,500 at KFC with EasyPaisa yesterday at 7 PM.
{"intent":"add_expense","expenses":[{"amount":1500,"currency":"PKR","category":"Food","description":"KFC","merchant":"KFC","payment_method":"EasyPaisa","location":null,"date":"yesterday","time":"7 PM","confidence":0.98,"ambiguity":false,"reasoning_type":"direct"}]}

User: I bought pizza yesterday at 7 PM and petrol today at 9 AM.
{"intent":"add_expense","expenses":[{"amount":null,"currency":"PKR","category":"Food","description":"Pizza","merchant":null,"payment_method":null,"location":null,"date":"yesterday","time":"7 PM","confidence":0.85,"ambiguity":true,"reasoning_type":"direct"},{"amount":null,"currency":"PKR","category":"Transport","description":"Petrol","merchant":null,"payment_method":null,"location":null,"date":"today","time":"9 AM","confidence":0.85,"ambiguity":true,"reasoning_type":"direct"}]}

User: How much budget is left?
{"intent":"remaining_budget"}

User: Hi!
{"intent":"chat","reply":"Hello! Tell me what you spent and I will record it for you."}

Never output text outside the JSON object.`;
};

// ─── interpretMessage ─────────────────────────────────────────────────────────

export const interpretMessage = async (message, categories = []) => {
  const systemPrompt = buildSystemPrompt(
    categories.length > 0
      ? categories
      : ['Food', 'Transport', 'Bills', 'Entertainment', 'Savings', 'Miscellaneous']
  );

  return geminiChat(systemPrompt, message, 0);
};

// ─── generateRecommendations ──────────────────────────────────────────────────

const RECOMMENDATIONS_PROMPT = `You are a finance advisor. Analyse the user's budget JSON and return ONLY valid JSON. No text outside JSON.

Return 3 to 5 recommendations in this exact shape:
{"recommendations":[{"title":"<8 words max>","detail":"<35 words max, use exact numbers from data>","category":"<name or null>","priority":"<critical|high|medium|low>","type":"<warning|tip|praise|insight>"}]}

Priority rules:
- critical: category >100% spent OR total budget >90% used
- high: category 75-100% spent
- medium: category 50-74% spent
- low: category <50% spent

Type rules:
- warning: dangerously high spending
- tip: actionable saving suggestion
- praise: doing well in a category
- insight: spending pattern observation

Rules:
- Use exact percentages and amounts from the input data.
- Always use "Rs" as the currency symbol. Never use "$" or "USD".
- If total budget >80% used, include a global warning.
- If overall <40% used, include at least one praise.
- Never invent numbers or categories not in the data.
- Never return empty recommendations array.`;

export const generateRecommendations = async (summary) => {
  const parsed = await geminiChat(RECOMMENDATIONS_PROMPT, JSON.stringify(summary), 0.4);

  const fixCurrency = (s) => String(s).replace(/\$\s?/g, 'Rs ').trim();

  const list = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
  return list
    .filter((r) => r && typeof r === 'object' && r.title && r.detail)
    .map((r) => ({
      title: fixCurrency(r.title),
      detail: fixCurrency(r.detail),
      category: r.category || null,
      priority: ['critical', 'high', 'medium', 'low'].includes(r.priority) ? r.priority : 'medium',
      type: ['warning', 'tip', 'praise', 'insight'].includes(r.type) ? r.type : 'insight',
    }))
    .slice(0, 5);
};
