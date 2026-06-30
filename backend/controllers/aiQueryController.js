import { asyncHandler } from '../middleware/asyncHandler.js';
import { analyzeQuery } from '../services/queryAnalyzer.js';
import { collectQueryData } from '../services/queryDataCollector.js';
import { answerQuery } from '../services/aiQueryService.js';

export const universalQuery = asyncHandler(async (req, res) => {
  const { query, userId } = req.body;

  if (!query || !String(query).trim()) {
    return res.status(400).json({ message: 'query is required.' });
  }
  if (!userId) {
    return res.status(400).json({ message: 'userId is required.' });
  }

  // 1. Analyze — determine modules and context
  const { modules, dateRange, person } = analyzeQuery(String(query));

  // 2. Collect — fetch only required structured data
  const structuredData = await collectQueryData(Number(userId), modules, dateRange, person);

  // 3. Answer — send to AI for natural language response
  const answer = await answerQuery(query, structuredData, dateRange, person);

  return res.status(200).json({
    intent: 'ai_query',
    success: true,
    answer,
    meta: { modules, dateRange: dateRange?.label || null, person: person || null },
  });
});
