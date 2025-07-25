import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const parseMessageHybrid = async (messageText, username) => {
  const text = messageText.trim();
  
  // Regex patterns for common formats
  const TASK_START = /^(\d+)\s*(min|mins|minutes?):\s*(.+)$/i;
  const COMPLETION = /^(done|finished|completed)\s+in\s+(\d+)\s*(min|mins|minutes?)$/i;
  const TIME_ONLY = /^(\d+)\s*(min|mins|minutes?)$/i;
  
  console.log('Hybrid parser: trying regex patterns first for:', text);
  
  // Try task start pattern first
  const taskStartMatch = text.match(TASK_START);
  if (taskStartMatch) {
    const minutes = parseInt(taskStartMatch[1]);
    const taskDescription = taskStartMatch[3].trim();
    console.log('Regex matched task_start:', minutes, 'min,', taskDescription);
    return {
      type: 'task_start',
      estimated_minutes: minutes,
      actual_minutes: null,
      task_description: taskDescription
    };
  }
  
  // Try completion pattern
  const completionMatch = text.match(COMPLETION);
  if (completionMatch) {
    const minutes = parseInt(completionMatch[2]);
    console.log('Regex matched task_completion:', minutes, 'min');
    return {
      type: 'task_completion',
      estimated_minutes: null,
      actual_minutes: minutes,
      task_description: null
    };
  }
  
  // Try time-only pattern
  const timeOnlyMatch = text.match(TIME_ONLY);
  if (timeOnlyMatch) {
    const minutes = parseInt(timeOnlyMatch[1]);
    console.log('Regex matched time_only:', minutes, 'min');
    return {
      type: 'other',
      estimated_minutes: null,
      actual_minutes: minutes,
      task_description: null
    };
  }
  
  // No regex match - fall back to AI parser
  console.log('No regex match, falling back to AI parser');
  return await parseMessage(text, username);
};

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

export const categorizeTasksBatch = async (taskDescriptions) => {
  if (!taskDescriptions || taskDescriptions.length === 0) {
    return [];
  }

  const prompt = `
Categorize these task descriptions into the most appropriate categories:

Categories:
1. Health & Exercise - gym, meditation, yoga, walks, stretching, wellness activities
2. Breaks & Personal - snacking, lunch, breaks, personal care, rest
3. Administrative - taxes, finances, emails, planning, scheduling, bureaucracy
4. Core Competency - coding, music production, DJing, writing, reading, creative work
5. Communication - meetings, calls, discussions (if not administrative)
6. Learning & Development - research, studying, tutorials, skill building
7. Other - anything that doesn't fit above categories

Task descriptions to categorize:
${taskDescriptions.map((desc, i) => `${i + 1}. "${desc}"`).join('\n')}

Rules:
- Choose the MOST appropriate single category for each task
- Respond with ONLY the category names, one per line, in the same order
- If uncertain, choose "Other"

Examples:
"gym workout" → Health & Exercise
"check email" → Administrative
"code review" → Core Competency
"lunch break" → Breaks & Personal
"client meeting" → Communication
"read tutorial" → Learning & Development
`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }]
    });
    
    const content = response.content[0].text.trim();
    const categories = content.split('\n').map(cat => cat.trim());
    
    console.log('Batch categorized', taskDescriptions.length, 'tasks');
    console.log('Categories assigned:', categories);
    
    // Ensure we have the same number of categories as tasks
    if (categories.length !== taskDescriptions.length) {
      console.warn('Category count mismatch, falling back to "Other"');
      return taskDescriptions.map(() => 'Other');
    }
    
    return categories;
    
  } catch (error) {
    console.error('Batch categorization error:', error);
    return taskDescriptions.map(() => 'Other');
  }
};