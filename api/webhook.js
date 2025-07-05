import { parseMessage } from '../lib/parser.js';
import { saveTask, completeTask } from '../lib/storage.js';
import { sendMessage } from '../lib/telegram.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    
    if (!message?.text) {
      return res.status(200).json({ ok: true });
    }
    
    const parsed = await parseMessage(message.text, message.from.username);
    
    if (parsed.type === 'task_start') {
      await saveTask(message.from.id, {
        type: 'start',
        username: message.from.username,
        estimated_minutes: parsed.estimated_minutes,
        task_description: parsed.task_description,
        timestamp: Date.now(),
        message_id: message.message_id,
        date: new Date().toISOString().split('T')[0]
      });
    }
    
    if (parsed.type === 'task_completion') {
      const completedTask = await completeTask(message.from.id, parsed.actual_minutes);
      
      // Send confirmation with accuracy feedback
      if (completedTask && completedTask.estimated_minutes) {
        const accuracy = completedTask.accuracy_percentage;
        const estimated = completedTask.estimated_minutes;
        const actual = parsed.actual_minutes;
        
        // Determine motivational message based on timing
        let motivationalMessage = '';
        let mainEmoji = '🎯';
        
        if (actual < estimated) {
          // Finished early
          motivationalMessage = '🚀 Nice efficiency!';
          mainEmoji = '⚡';
        } else if (actual > estimated) {
          // Took longer than expected
          motivationalMessage = '⏰ Took a bit longer than expected';
        } else {
          // Perfect timing
          motivationalMessage = '🎯 Perfect estimate!';
          mainEmoji = '✨';
        }
        
        const accuracyEmoji = accuracy >= 90 ? '🎯' : accuracy >= 70 ? '👍' : '📊';
        
        await sendMessage(message.chat.id, 
          `${mainEmoji} Task completed! Est: ${estimated}m, Actual: ${actual}m\n${motivationalMessage}\n${accuracyEmoji} Accuracy: ${accuracy}%`
        );
      }
    }
    
    res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}