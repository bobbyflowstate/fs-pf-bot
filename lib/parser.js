import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const parseMessage = async (messageText, username) => {
  const prompt = `
Parse this message from a focus group chat to identify task starts or completions.

Message: "${messageText}"

Rules:
- TASK START: Someone announcing they're about to work on something with an estimated time AND task description
- TASK COMPLETION: Someone announcing they finished work with actual time taken
- TIME ONLY: Just a time duration without task context (e.g., "20 minutes", "30 mins")

For TASK START: set "estimated_minutes" with the time, "actual_minutes" must be null, "task_description" must be provided
For TASK COMPLETION: set "actual_minutes" with the time taken, "estimated_minutes" must be null
For TIME ONLY: set "type" to "other", "actual_minutes" with the time, "estimated_minutes" must be null

Respond with JSON only:
{
  "type": "task_start" | "task_completion" | "other",
  "estimated_minutes": number | null,
  "actual_minutes": number | null,
  "task_description": string | null
}

Examples:
"30 mins: fix the login bug" → {"type": "task_start", "estimated_minutes": 30, "actual_minutes": null, "task_description": "fix the login bug"}
"gonna work on emails for about an hour" → {"type": "task_start", "estimated_minutes": 60, "actual_minutes": null, "task_description": "emails"}
"done in 45 minutes" → {"type": "task_completion", "estimated_minutes": null, "actual_minutes": 45, "task_description": null}
"finished in 60 minutes" → {"type": "task_completion", "estimated_minutes": null, "actual_minutes": 60, "task_description": null}
"took 20 minutes" → {"type": "task_completion", "estimated_minutes": null, "actual_minutes": 20, "task_description": null}
"completed in 30 mins" → {"type": "task_completion", "estimated_minutes": null, "actual_minutes": 30, "task_description": null}
"just finished that email task, took 20 mins" → {"type": "task_completion", "estimated_minutes": null, "actual_minutes": 20, "task_description": "email task"}
"20 minutes" → {"type": "other", "estimated_minutes": null, "actual_minutes": 20, "task_description": null}
"30 mins" → {"type": "other", "estimated_minutes": null, "actual_minutes": 30, "task_description": null}
"25m" → {"type": "other", "estimated_minutes": null, "actual_minutes": 25, "task_description": null}
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