import { postDailyPlaylists } from '../lib/playlists.js';

export default async function handler(req, res) {
  // Verify this is a cron request from Vercel
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Cron job triggered: Daily playlist posting at 9 AM European time');
    
    const success = await postDailyPlaylists();
    
    if (success) {
      console.log('Daily playlists posted successfully via cron');
      return res.status(200).json({ 
        success: true, 
        message: 'Daily playlists posted successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      console.log('No playlists to post today or error occurred');
      return res.status(200).json({ 
        success: false, 
        message: 'No playlists available for today or error occurred',
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('Cron job error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}