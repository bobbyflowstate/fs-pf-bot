import { parseMessage, categorizeTask, parseCompoundMessage } from '../lib/parser.js';
import { saveTask, completeTask, getUserSummary, setPendingCompletion, getPendingCompletion, clearPendingCompletion, findTaskToComplete } from '../lib/storage.js';
import { sendMessage } from '../lib/telegram.js';

// Helper function to generate motivational message based on timing
function generateMotivationalMessage(actual, estimated) {
  let motivationalMessage = '';
  let mainEmoji = '🎯';
  
  if (actual < estimated) {
    motivationalMessage = '🚀 Nice efficiency!';
    mainEmoji = '⚡';
  } else if (actual > estimated) {
    motivationalMessage = '⏰ Took a bit longer than expected';
  } else {
    motivationalMessage = '🎯 Perfect estimate!';
    mainEmoji = '✨';
  }
  
  return { motivationalMessage, mainEmoji };
}

// Helper function to format completion response message
function formatCompletionResponse(completedTask, actual, suffix = '') {
  const accuracy = completedTask.accuracy_percentage;
  const estimated = completedTask.estimated_minutes;
  const { motivationalMessage, mainEmoji } = generateMotivationalMessage(actual, estimated);
  
  const accuracyEmoji = accuracy >= 90 ? '🎯' : accuracy >= 70 ? '👍' : '📊';
  const replyIndicator = completedTask.completed_via_reply ? ' (via reply)' : '';
  
  return `✅ Task: "${completedTask.task_description}"\n${mainEmoji} Est: ${estimated}m, Actual: ${actual}m${replyIndicator}${suffix}\n${motivationalMessage}\n${accuracyEmoji} Accuracy: ${accuracy}%`;
}

// Helper function to handle task completion and send response
async function handleTaskCompletion(chatId, userId, actualMinutes, replyToMessageId, suffix = '', messageThreadId = null) {
  // First, find the task to get its description for categorization
  const taskToComplete = await findTaskToComplete(chatId, userId, replyToMessageId);
  
  let category = 'Other';
  if (taskToComplete && taskToComplete.task_description) {
    category = await categorizeTask(taskToComplete.task_description);
  }
  
  const completedTask = await completeTask(chatId, userId, actualMinutes, replyToMessageId, category);
  console.log('Completed task result:', completedTask);
  
  if (completedTask && completedTask.estimated_minutes) {
    const responseMessage = formatCompletionResponse(completedTask, actualMinutes, suffix);
    await sendMessage(chatId, responseMessage, messageThreadId);
    return true;
  }
  return false;
}

// Helper function to extract time from message text
function extractTimeFromText(text) {
  const timeMatch = text.match(/(\d+)\s*(minutes?|mins?|m(?:\s|$))/i);
  return timeMatch ? parseInt(timeMatch[1]) : null;
}

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
      username: message.from.username,
      replyToMessageId: message.reply_to_message?.message_id || null,
      messageThreadId: message.message_thread_id || null,
      isTopicMessage: message.is_topic_message || false
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
      
      // Add category breakdown if there are categories
      if (summary.categoryBreakdown && summary.categoryBreakdown.length > 0) {
        summaryText += `\n📋 Time by Category (Last 24h):\n`;
        summary.categoryBreakdown.forEach(cat => {
          // Add emoji for each category
          const categoryEmoji = {
            'Communication': '📧',
            'Development': '💻',
            'Learning': '📚',
            'Planning': '📋',
            'Administrative': '📄',
            'Problem Solving': '🛠️',
            'Review': '🔍',
            'Maintenance': '🔧',
            'Other': '📌'
          };
          const emoji = categoryEmoji[cat.category] || '📌';
          summaryText += `• ${emoji} ${cat.category}: ${cat.minutes} min (${cat.percentage}%)\n`;
        });
      }
      
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
      await sendMessage(message.chat.id, summaryText, message.message_thread_id);
      console.log('Summary sent successfully');
      return res.status(200).json({ ok: true });
    }
    
    console.log('Parsing message:', message.text);
    
    // First check if this might be a compound message (completion + start)
    const compoundResult = await parseCompoundMessage(message.text, message.from.username);
    
    if (compoundResult.isCompound) {
      console.log('Processing compound message: completion + start');
      console.log('Completion part:', compoundResult.completion);
      console.log('Start part:', compoundResult.start);
      
      const replyToMessageId = message.reply_to_message?.message_id || null;
      
      // First, handle the completion
      if (compoundResult.completion.actual_minutes) {
        console.log('Processing completion part of compound message');
        const success = await handleTaskCompletion(
          message.chat.id, 
          message.from.id, 
          compoundResult.completion.actual_minutes, 
          replyToMessageId, 
          '', 
          message.message_thread_id
        );
        
        if (success) {
          console.log('Completion part processed successfully');
        } else {
          console.log('Completion part failed, but continuing with start');
        }
      }
      
      // Then, handle the task start
      if (compoundResult.start.estimated_minutes && compoundResult.start.task_description) {
        console.log('Processing start part of compound message');
        await saveTask(message.chat.id, message.from.id, {
          type: 'start',
          username: message.from.username,
          estimated_minutes: compoundResult.start.estimated_minutes,
          task_description: compoundResult.start.task_description,
          timestamp: Date.now(),
          message_id: message.message_id,
          date: new Date().toISOString().split('T')[0]
        });
        console.log('New task started from compound message');
      }
      
      return res.status(200).json({ ok: true });
    }
    
    // If not compound, use regular parsing
    const parsed = await parseMessage(message.text, message.from.username);
    console.log('Parse result:', parsed);
    
    // Check if user has pending completion first
    const pendingCompletion = await getPendingCompletion(message.chat.id, message.from.id);
    console.log('Pending completion for user:', pendingCompletion);
    
    // Handle pending completion responses
    if (pendingCompletion) {
      console.log('User has pending completion, checking response');
      
      if (parsed.actual_minutes) {
        // User provided time, complete the task
        console.log('User provided time for pending completion:', parsed.actual_minutes);
        await handleTaskCompletion(message.chat.id, message.from.id, parsed.actual_minutes, pendingCompletion.reply_to_message_id, '', message.message_thread_id);
        await clearPendingCompletion(message.chat.id, message.from.id);
        return res.status(200).json({ ok: true });
        
      } else if (parsed.type === 'task_completion') {
        // User said "Done" again without time, use estimated time
        console.log('User said Done again without time, using estimated time');
        const estimatedTime = pendingCompletion.estimated_minutes;
        
        // Categorize the task before completing it
        const category = await categorizeTask(pendingCompletion.task_description);
        
        const completedTask = await completeTask(message.chat.id, message.from.id, estimatedTime, pendingCompletion.reply_to_message_id, category);
        await clearPendingCompletion(message.chat.id, message.from.id);
        
        if (completedTask && completedTask.estimated_minutes) {
          const responseMessage = `✅ Task: "${completedTask.task_description}"\n✨ Est: ${estimatedTime}m, Actual: ${estimatedTime}m (assumed estimate)\n🎯 Perfect timing!\n🎯 Accuracy: 100%`;
          await sendMessage(message.chat.id, responseMessage, message.message_thread_id);
        }
        return res.status(200).json({ ok: true });
        
      } else {
        // Fallback: try to extract time from message text directly
        console.log('Fallback: trying to extract time from message text');
        const extractedTime = extractTimeFromText(message.text);
        
        if (extractedTime) {
          console.log('Extracted time via fallback:', extractedTime);
          await handleTaskCompletion(message.chat.id, message.from.id, extractedTime, pendingCompletion.reply_to_message_id, ' (fallback)', message.message_thread_id);
          await clearPendingCompletion(message.chat.id, message.from.id);
          return res.status(200).json({ ok: true });
        }
        
        console.log('No time found in pending completion response, continuing with normal flow');
      }
    }
    
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
      const replyToMessageId = message.reply_to_message?.message_id || null;
      console.log('Reply to message ID:', replyToMessageId);
      
      // Check if user provided actual time
      if (parsed.actual_minutes === null) {
        console.log('User said Done without time, asking for clarification');
        
        // Find the task that would be completed
        const taskToComplete = await findTaskToComplete(message.chat.id, message.from.id, replyToMessageId);
        
        if (taskToComplete) {
          // Store pending completion with the task info
          await setPendingCompletion(message.chat.id, message.from.id, {
            estimated_minutes: taskToComplete.estimated_minutes,
            task_description: taskToComplete.task_description,
            message_id: taskToComplete.message_id,
            reply_to_message_id: replyToMessageId
          });
          
          // Ask for time
          const askMessage = `How long did "${taskToComplete.task_description}" take? Please respond with the time (e.g., "25 minutes")`;
          await sendMessage(message.chat.id, askMessage, message.message_thread_id);
        } else {
          console.log('No incomplete task found for user');
          await sendMessage(message.chat.id, 'No active task found to complete.', message.message_thread_id);
        }
        return res.status(200).json({ ok: true });
      }
      
      await handleTaskCompletion(message.chat.id, message.from.id, parsed.actual_minutes, replyToMessageId, '', message.message_thread_id);
    }
    
    // Handle time-only responses when no pending completion exists
    if (parsed.type === 'other' && parsed.actual_minutes) {
      console.log('Time-only response without pending completion, ignoring');
      // This is intentionally ignored - time without context shouldn't do anything
    }
    
    // Fallback: Handle time-only responses that weren't caught by parser
    if (!pendingCompletion && parsed.type === 'other') {
      const extractedTime = extractTimeFromText(message.text);
      if (extractedTime) {
        console.log('Extracted time from text but no pending completion, ignoring');
        // This is intentionally ignored - time without context shouldn't do anything
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