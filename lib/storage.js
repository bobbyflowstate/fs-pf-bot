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

export const completeTask = async (chatId, userId, actualMinutes, replyToMessageId = null, category = null) => {
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
        ? Math.round((Math.min(incompleteTask.task.estimated_minutes, actualMinutes) / Math.max(incompleteTask.task.estimated_minutes, actualMinutes)) * 100)
        : null;
        
      const updatedTask = {
        ...incompleteTask.task,
        actual_minutes: actualMinutes,
        completed_at: Date.now(),
        accuracy_percentage: accuracyPercentage,
        completed_via_reply: !!replyToMessageId,
        category: category || 'Other'
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

export const setPendingCompletion = async (chatId, userId, taskData) => {
  try {
    const key = `pending_completion:${chatId}:${userId}`;
    await redis.set(key, taskData);
    console.log('Pending completion stored for user:', userId);
    return true;
  } catch (error) {
    console.error('Set pending completion error:', error);
    return false;
  }
};

export const getPendingCompletion = async (chatId, userId) => {
  try {
    const key = `pending_completion:${chatId}:${userId}`;
    const pendingTask = await redis.get(key);
    return pendingTask;
  } catch (error) {
    console.error('Get pending completion error:', error);
    return null;
  }
};

export const clearPendingCompletion = async (chatId, userId) => {
  try {
    const key = `pending_completion:${chatId}:${userId}`;
    await redis.del(key);
    console.log('Pending completion cleared for user:', userId);
    return true;
  } catch (error) {
    console.error('Clear pending completion error:', error);
    return false;
  }
};

export const findTaskToComplete = async (chatId, userId, replyToMessageId = null) => {
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
      return incompleteTask.task;
    }
    
    console.log('No incomplete tasks found');
    return null;
    
  } catch (error) {
    console.error('Find task to complete error:', error);
    return null;
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
        totalTasks: 0,
        categoryBreakdown: []
      };
    }
    
    // Calculate average accuracy from all completed tasks
    const accuracySum = completedTasks.reduce((sum, task) => sum + task.accuracy_percentage, 0);
    const averageAccuracy = Math.round(accuracySum / completedTasks.length);
    
    // Calculate focus time in last 24 hours
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);
    const recentCompletedTasks = completedTasks.filter(task => task.completed_at > last24Hours);
    const last24HoursFocus = recentCompletedTasks.reduce((sum, task) => sum + (task.actual_minutes || 0), 0);
    
    // Calculate time by category in last 24 hours
    const categoryBreakdown = {};
    recentCompletedTasks.forEach(task => {
      const category = task.category || 'Other';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + (task.actual_minutes || 0);
    });
    
    // Convert to array and sort by time spent
    const categoryArray = Object.entries(categoryBreakdown)
      .map(([category, minutes]) => ({
        category,
        minutes,
        percentage: last24HoursFocus > 0 ? Math.round((minutes / last24HoursFocus) * 100) : 0
      }))
      .sort((a, b) => b.minutes - a.minutes);
    
    // Get last 5 tasks for recent activity
    const recentTasks = completedTasks.slice(0, 5);
    
    return {
      averageAccuracy,
      last24HoursFocus,
      recentTasks,
      totalTasks: completedTasks.length,
      categoryBreakdown: categoryArray
    };
    
  } catch (error) {
    console.error('Get user summary error:', error);
    return {
      averageAccuracy: 0,
      last24HoursFocus: 0,
      recentTasks: [],
      totalTasks: 0,
      categoryBreakdown: []
    };
  }
};