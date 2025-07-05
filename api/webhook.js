import { parseMessage } from '../lib/parser.js';
import { saveTask, completeTask, getUserSummary } from '../lib/storage.js';
import { sendMessage } from '../lib/telegram.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    
    // Debug logging
    console.log('=== WEBHOOK DEBUG ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    
    if (!message?.text) {
      console.log('No message text found, ignoring');
      return res.status(200).json({ ok: true });
    }
    
    // Log message details
    console.log('Message details:', {
      text: message.text,
      chatId: message.chat.id,
      chatType: message.chat.type,
      userId: message.from.id,
      username: message.from.username
    });
    
    const isGroupChat = message.chat.type === 'group' || message.chat.type === 'supergroup';
    console.log('Is group chat:', isGroupChat);
    
    // Check for /summary command
    if (message.text.toLowerCase().trim() === '/summary') {
      console.log('Processing /summary command');
      const summary = await getUserSummary(message.chat.id, message.from.id);
      console.log('Summary retrieved:', summary);
      
      // Format personal summary message
      let summaryText = `📊 Your Focus Summary\n`;
      summaryText += `🎯 Average accuracy: ${summary.averageAccuracy}%\n`;
      summaryText += `⏱️ Last 24 hours: ${summary.last24HoursFocus} minutes focused\n`;
      
      if (summary.recentTasks.length > 0) {
        summaryText += `📋 Recent tasks:\n`;
        summary.recentTasks.forEach(task => {
          const efficiency = task.actual_minutes < task.estimated_minutes ? ' ⚡' :
                           task.actual_minutes === task.estimated_minutes ? ' ✨' : '';
          summaryText += `• ${task.estimated_minutes}min task → ${task.actual_minutes}min (${task.accuracy_percentage}% accuracy)${efficiency}\n`;
        });
      } else {
        summaryText += `📋 No completed tasks yet - start tracking your focus! 🚀`;
      }
      
      console.log('Sending summary to chat:', message.chat.id);
      await sendMessage(message.chat.id, summaryText);
      console.log('Summary sent successfully');
      return res.status(200).json({ ok: true });
    }
    
    console.log('Parsing message:', message.text);
    const parsed = await parseMessage(message.text, message.from.username);
    console.log('Parse result:', parsed);
    
    if (parsed.type === 'task_start') {
      console.log('Saving task start for user:', message.from.id, 'in chat:', message.chat.id);
      await saveTask(message.chat.id, message.from.id, {
        type: 'start',
        username: message.from.username,
        estimated_minutes: parsed.estimated_minutes,
        task_description: parsed.task_description,
        timestamp: Date.now(),
        message_id: message.message_id,
        date: new Date().toISOString().split('T')[0]
      });
      console.log('Task start saved successfully');
      
      // In group chats, don't respond to task starts to avoid spam
      if (isGroupChat) {
        console.log('Group chat: silently tracking task start without response');
      } else {
        // For private chats, we could add a task start confirmation here if desired
        console.log('Private chat: task start tracked');
      }
    }
    
    if (parsed.type === 'task_completion') {
      console.log('Processing task completion for user:', message.from.id, 'in chat:', message.chat.id);
      const completedTask = await completeTask(message.chat.id, message.from.id, parsed.actual_minutes);
      console.log('Completed task result:', completedTask);
      
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
        
        const responseMessage = `${mainEmoji} Task completed! Est: ${estimated}m, Actual: ${actual}m\n${motivationalMessage}\n${accuracyEmoji} Accuracy: ${accuracy}%`;
        console.log('Sending completion message to chat:', message.chat.id, 'Message:', responseMessage);
        await sendMessage(message.chat.id, responseMessage);
        console.log('Completion message sent successfully');
      }
    }
    
    console.log('=== WEBHOOK PROCESSING COMPLETE ===');
    res.status(200).json({ ok: true });
    
  } catch (error) {
    console.error('=== WEBHOOK ERROR ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
}