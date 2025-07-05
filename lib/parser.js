import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const parseMessage = async (messageText, username) => {
  const prompt = `
Parse this message from a focus group chat. Extract:
1. Time estimate (in minutes)
2. Task description
3. Is this a task start or completion?

Message: "${messageText}"

Respond with JSON only:
{
  "type": "task_start" | "task_completion" | "other",
  "estimated_minutes": number | null,
  "actual_minutes": number | null,
  "task_description": string | null
}

Examples:
"30 mins: fix the login bug" → {"type": "task_start", "estimated_minutes": 30, "task_description": "fix the login bug"}
"done in 45 minutes" → {"type": "task_completion", "actual_minutes": 45}
"finished in 60 minutes" → {"type": "task_completion", "actual_minutes": 60}
"done in 60 mins" → {"type": "task_completion", "actual_minutes": 60}
"took 20 minutes" → {"type": "task_completion", "actual_minutes": 20}
"completed in 30 mins" → {"type": "task_completion", "actual_minutes": 30}
"just finished that email task, took 20 mins" → {"type": "task_completion", "actual_minutes": 20, "task_description": "email task"}
"gonna work on that email stuff for about an hour" → {"type": "task_start", "estimated_minutes": 60, "task_description": "email stuff"}

IMPORTANT: Any message mentioning "done", "finished", "completed", "took X minutes", or "in X minutes" when referring to completion should be classified as "task_completion".
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const content = response.content[0].text;
    return JSON.parse(content);
    
  } catch (error) {
    console.error('Parse error:', error);
    return { type: 'other', estimated_minutes: null, actual_minutes: null, task_description: null };
  }
};