// AI Query Service — answers any natural language financial question
// using structured data collected from the backend.
// Uses geminiText (plain-text output, NOT JSON).
import { geminiText } from './aiService.js';

const SYSTEM_PROMPT = `You are a personal financial assistant embedded in a budgeting app.

Your job is to answer the user's financial questions using ONLY the structured data provided below.

RULES:
- Answer in clear, natural language.
- Use "Rs" for all currency amounts (never $, USD, PKR prefix).
- Format numbers with commas: Rs 5,000 not Rs 5000.
- Use bullet points or numbered lists for multiple items.
- Include a short summary sentence at the start of your answer.
- If data is missing or empty for what was asked, say so clearly.
- Never expose database IDs, SQL, table names, or internal field names.
- Never fabricate numbers — use only what is in the provided data.
- Keep your answer concise but complete. Aim for under 250 words unless a detailed report is needed.
- If you detect a trend or pattern, mention it naturally.
- For person-based queries, calculate totals across ALL relevant modules (loans + expenses + repayments).
- For date-range queries, only reference data that falls within that range.
- End with one short practical observation if relevant (e.g. "You're spending 40% on food — consider reviewing that.").
- NEVER say "Based on the data provided" — just answer directly.

Today's date is ${new Date().toDateString()}.`;

// Strip fields that could expose internals before sending to AI
const sanitize = (data) => JSON.stringify(data, (key, value) => {
  // Drop internal id fields
  if (key === 'id' || key === 'user_id' || key === 'loan_id' || key === 'investment_id') return undefined;
  // Drop null values to reduce token count
  if (value === null) return undefined;
  return value;
}, 2);

export const answerQuery = async (query, structuredData, dateRange, person) => {
  const contextNote = [
    dateRange ? `Note: The user is asking specifically about: ${dateRange.label}.` : '',
    person    ? `Note: The user is asking about a person named "${person}".` : '',
  ].filter(Boolean).join('\n');

  const userContent = `${contextNote ? contextNote + '\n\n' : ''}FINANCIAL DATA:\n${sanitize(structuredData)}\n\nUSER'S QUESTION: ${query}`;

  return geminiText(SYSTEM_PROMPT, userContent, 0.3);
};
