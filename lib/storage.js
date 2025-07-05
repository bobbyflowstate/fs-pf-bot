import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export const saveTask = async (userId, task) => {
  const key = `tasks:${userId}:${Date.now()}`;
  await redis.set(key, task);
  return task;
};

export const getUserTasks = async (userId, date) => {
  const pattern = `tasks:${userId}:*`;
  const keys = await redis.keys(pattern);
  const tasks = await Promise.all(keys.map(key => redis.get(key)));
  return tasks.filter(task => task && task.date === date);
};

export const getAllCompletedTasks = async (date) => {
  const pattern = `tasks:*`;
  const keys = await redis.keys(pattern);
  const tasks = await Promise.all(keys.map(key => redis.get(key)));
  return tasks.filter(task => task && task.date === date && task.completed_at);
};

export const completeTask = async (userId, actualMinutes) => {
  try {
    // Find the most recent incomplete task for this user
    const pattern = `tasks:${userId}:*`;
    const keys = await redis.keys(pattern);
    const tasks = await Promise.all(keys.map(async key => ({
      key,
      task: await redis.get(key)
    })));
    
    const incompleteTask = tasks
      .filter(({task}) => task && task.type === 'start' && !task.completed_at)
      .sort((a, b) => b.task.timestamp - a.task.timestamp)[0];
    
    if (incompleteTask) {
      const accuracyPercentage = incompleteTask.task.estimated_minutes 
        ? Math.round(100 - (Math.abs(incompleteTask.task.estimated_minutes - actualMinutes) / incompleteTask.task.estimated_minutes * 100))
        : null;
        
      const updatedTask = {
        ...incompleteTask.task,
        actual_minutes: actualMinutes,
        completed_at: Date.now(),
        accuracy_percentage: accuracyPercentage
      };
      
      await redis.set(incompleteTask.key, updatedTask);
      return updatedTask;
    }
    
    return null;
    
  } catch (error) {
    console.error('Complete task error:', error);
    return null;
  }
};

export const getUserSummary = async (userId) => {
  try {
    // Get all completed tasks for this user
    const pattern = `tasks:${userId}:*`;
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