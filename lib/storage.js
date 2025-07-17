import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export const saveTask = async (chatId, userId, task) => {
  const key = `tasks:${chatId}:${userId}:${Date.now()}`;
  await redis.set(key, task);
  return task;
};

export const getUserTasks = async (chatId, userId, date) => {
  const pattern = `tasks:${chatId}:${userId}:*`;
  const keys = await redis.keys(pattern);
  const tasks = await Promise.all(keys.map(key => redis.get(key)));
  return tasks.filter(task => task && task.date === date);
};

export const getAllCompletedTasks = async (chatId, date) => {
  const pattern = `tasks:${chatId}:*`;
  const keys = await redis.keys(pattern);
  const tasks = await Promise.all(keys.map(key => redis.get(key)));
  return tasks.filter(task => task && task.date === date && task.completed_at);
};

export const completeTask = async (chatId, userId, actualMinutes, replyToMessageId = null) => {
  try {
    // Find all incomplete tasks for this user in this chat
    const pattern = `tasks:${chatId}:${userId}:*`;
    const keys = await redis.keys(pattern);
    const tasks = await Promise.all(keys.map(async key => ({
      key,
      task: await redis.get(key)
    })));
    
    const incompleteTasks = tasks
      .filter(({task}) => task && task.type === 'start' && !task.completed_at)
      .sort((a, b) => b.task.timestamp - a.task.timestamp);
    
    let incompleteTask = null;
    
    // If replying to a specific message, try to find that task first
    if (replyToMessageId) {
      console.log('Looking for task with message_id:', replyToMessageId);
      incompleteTask = incompleteTasks.find(({task}) => task.message_id === replyToMessageId);
      
      if (incompleteTask) {
        console.log('Found matching task via reply:', incompleteTask.task.task_description);
      } else {
        console.log('No matching task found for reply, falling back to chronological');
      }
    }
    
    // Fallback to most recent incomplete task if no reply match found
    if (!incompleteTask && incompleteTasks.length > 0) {
      incompleteTask = incompleteTasks[0];
      console.log('Using chronological fallback for task:', incompleteTask.task.task_description);
    }
    
    if (incompleteTask) {
      const accuracyPercentage = incompleteTask.task.estimated_minutes 
        ? Math.round(100 - (Math.abs(incompleteTask.task.estimated_minutes - actualMinutes) / incompleteTask.task.estimated_minutes * 100))
        : null;
        
      const updatedTask = {
        ...incompleteTask.task,
        actual_minutes: actualMinutes,
        completed_at: Date.now(),
        accuracy_percentage: accuracyPercentage,
        completed_via_reply: !!replyToMessageId
      };
      
      await redis.set(incompleteTask.key, updatedTask);
      console.log('Task completed successfully:', updatedTask.task_description);
      return updatedTask;
    }
    
    console.log('No incomplete tasks found to complete');
    return null;
    
  } catch (error) {
    console.error('Complete task error:', error);
    return null;
  }
};

export const getAllActiveChatIds = async () => {
  try {
    // Get all task keys
    const pattern = `tasks:*`;
    const keys = await redis.keys(pattern);
    
    // Extract unique chat IDs from keys (format: tasks:chatId:userId:timestamp)
    const chatIds = new Set();
    keys.forEach(key => {
      const parts = key.split(':');
      if (parts.length >= 2) {
        chatIds.add(parts[1]); // chatId is the second part
      }
    });
    
    return Array.from(chatIds);
    
  } catch (error) {
    console.error('Get active chat IDs error:', error);
    return [];
  }
};

export const getUserSummary = async (chatId, userId) => {
  try {
    // Get all completed tasks for this user in this chat
    const pattern = `tasks:${chatId}:${userId}:*`;
    const keys = await redis.keys(pattern);
    const allTasks = await Promise.all(keys.map(key => redis.get(key)));
    
    // Filter to completed tasks only
    const completedTasks = allTasks
      .filter(task => task && task.completed_at && task.accuracy_percentage !== null)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    if (completedTasks.length === 0) {
      return {
        averageAccuracy: 0,
        last24HoursFocus: 0,
        recentTasks: [],
        totalTasks: 0
      };
    }
    
    // Calculate average accuracy from all completed tasks
    const accuracySum = completedTasks.reduce((sum, task) => sum + task.accuracy_percentage, 0);
    const averageAccuracy = Math.round(accuracySum / completedTasks.length);
    
    // Calculate focus time in last 24 hours
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentCompletedTasks = completedTasks.filter(task => task.completed_at > last24Hours);
    const last24HoursFocus = recentCompletedTasks.reduce((sum, task) => sum + (task.actual_minutes || 0), 0);
    
    // Get last 5 tasks for recent activity
    const recentTasks = completedTasks.slice(0, 5);
    
    return {
      averageAccuracy,
      last24HoursFocus,
      recentTasks,
      totalTasks: completedTasks.length
    };
    
  } catch (error) {
    console.error('Get user summary error:', error);
    return {
      averageAccuracy: 0,
      last24HoursFocus: 0,
      recentTasks: [],
      totalTasks: 0
    };
  }
};