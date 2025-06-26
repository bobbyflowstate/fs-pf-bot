import { getAllCompletedTasks } from '../lib/storage.js';
import { sendMessage } from '../lib/telegram.js';

export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tasks = await getAllCompletedTasks(today);
    
    const summary = generateSimpleSummary(tasks);
    await sendMessage(process.env.CHAT_ID, summary);
    
    res.status(200).json({ ok: true, summary });
    
  } catch (error) {
    console.error('Daily summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function generateSimpleSummary(tasks) {
  const userStats = {};
  let totalTasks = 0;
  let totalAccuracySum = 0;
  let tasksWithAccuracy = 0;
  
  tasks.forEach(task => {
    if (!task.completed_at) return; // Skip incomplete tasks
    
    if (!userStats[task.username]) {
      userStats[task.username] = { 
        tasks: 0, 
        estimated: 0, 
        actual: 0, 
        accuracySum: 0,
        accuracyCount: 0
      };
    }
    
    const stats = userStats[task.username];
    stats.tasks++;
    stats.estimated += task.estimated_minutes || 0;
    stats.actual += task.actual_minutes || 0;
    
    if (task.accuracy_percentage) {
      stats.accuracySum += task.accuracy_percentage;
      stats.accuracyCount++;
      totalAccuracySum += task.accuracy_percentage;
      tasksWithAccuracy++;
    }
    
    totalTasks++;
  });
  
  const groupAccuracy = tasksWithAccuracy > 0 ? Math.round(totalAccuracySum / tasksWithAccuracy) : 0;
  
  let summary = `📊 Daily Summary - ${new Date().toLocaleDateString()}\n`;
  summary += `📈 ${totalTasks} tasks completed, ${groupAccuracy}% group accuracy\n\n`;
  
  // Sort users by accuracy for friendly competition
  const sortedUsers = Object.entries(userStats)
    .map(([username, stats]) => ({
      username,
      ...stats,
      avgAccuracy: stats.accuracyCount > 0 ? Math.round(stats.accuracySum / stats.accuracyCount) : 0
    }))
    .sort((a, b) => b.avgAccuracy - a.avgAccuracy);
  
  sortedUsers.forEach(user => {
    const accuracyDisplay = user.avgAccuracy > 0 ? ` (${user.avgAccuracy}% accuracy)` : '';
    const emoji = user.avgAccuracy >= 90 ? '🎯' : user.avgAccuracy >= 70 ? '👍' : '📊';
    
    summary += `${emoji} @${user.username}: ${user.tasks} tasks, ${user.actual}min total${accuracyDisplay}\n`;
  });
  
  // Add motivation
  if (sortedUsers.length > 1 && sortedUsers[0].avgAccuracy > 0) {
    summary += `\n🏆 Best estimator: @${sortedUsers[0].username}!`;
  }
  
  return summary;
}