import { kv } from '@vercel/kv';

export const saveTask = async (userId, task) => {
  const key = `tasks:${userId}:${Date.now()}`;
  await kv.set(key, task);
  return task;
};

export const getUserTasks = async (userId, date) => {
  const pattern = `tasks:${userId}:*`;
  const keys = await kv.keys(pattern);
  const tasks = await Promise.all(keys.map(key => kv.get(key)));
  return tasks.filter(task => task && task.date === date);
};

export const getAllCompletedTasks = async (date) => {
  const pattern = `tasks:*`;
  const keys = await kv.keys(pattern);
  const tasks = await Promise.all(keys.map(key => kv.get(key)));
  return tasks.filter(task => task && task.date === date && task.completed_at);
};

export const completeTask = async (userId, actualMinutes) => {
  try {
    // Find the most recent incomplete task for this user
    const pattern = `tasks:${userId}:*`;
    const keys = await kv.keys(pattern);
    const tasks = await Promise.all(keys.map(async key => ({
      key,
      task: await kv.get(key)
    })));
    
    const incompleteTask = tasks
      .filter(({task}) => task && task.type === 'start' && !task.completed_at)
      .sort((a, b) => b.task.timestamp - a.task.timestamp)[0];
    
    if (incompleteTask) {
      const accuracyPercentage = incompleteTask.task.estimated_minutes 
        ? Math.round((incompleteTask.task.estimated_minutes / actualMinutes) * 100)
        : null;
        
      const updatedTask = {
        ...incompleteTask.task,
        actual_minutes: actualMinutes,
        completed_at: Date.now(),
        accuracy_percentage: accuracyPercentage
      };
      
      await kv.set(incompleteTask.key, updatedTask);
      return updatedTask;
    }
    
    return null;
    
  } catch (error) {
    console.error('Complete task error:', error);
    return null;
  }
};