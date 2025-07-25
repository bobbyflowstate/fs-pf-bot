import { sendMessage } from './telegram.js';

// Playlist API endpoints
const PLAYLIST_ENDPOINTS = [
  {
    url: 'https://fs-composer.onrender.com/api/pubPlaylist/daily?playlist_type=FSR&break_type=NONE',
    type: 'Music Only',
    emoji: '🎧'
  },
  {
    url: 'https://fs-composer.onrender.com/api/pubPlaylist/daily?playlist_type=FSR&break_type=AMBIENT',
    type: 'Music + Ambient',
    emoji: '🌊'
  },
  {
    url: 'https://fs-composer.onrender.com/api/pubPlaylist/daily?playlist_type=FSR&break_type=TALK',
    type: 'Music + Talk',
    emoji: '🗣️'
  }
];

// Check if a date string matches today's date
function isToday(dateString) {
  const today = new Date();
  const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  
  // Handle different date formats
  let playlistDate;
  if (dateString.includes('T')) {
    // ISO format with time
    playlistDate = dateString.split('T')[0];
  } else {
    // Assume already in YYYY-MM-DD format
    playlistDate = dateString;
  }
  
  return playlistDate === todayString;
}

// Fetch latest playlist from a single endpoint
async function fetchLatestPlaylist(endpoint) {
  try {
    console.log('Fetching playlist from:', endpoint.url);
    console.log('API Key available:', !!process.env.FS_COMPOSER_API_KEY);
    console.log('API Key preview:', process.env.FS_COMPOSER_API_KEY ? `${process.env.FS_COMPOSER_API_KEY.substring(0, 8)}...` : 'undefined');
    
    const response = await fetch(endpoint.url, {
      method: 'GET',
      headers: {
        'X-API-Key': process.env.FS_COMPOSER_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error for ${endpoint.type}:`, {
        status: response.status, 
        statusText: response.statusText,
        body: errorText,
        url: endpoint.url
      });
      return null;
    }
    
    const data = await response.json();
    console.log(`Raw API response for ${endpoint.type}:`, JSON.stringify(data, null, 2));
    
    // Check if response has playlists array
    if (!data.playlists || !Array.isArray(data.playlists)) {
      console.log(`Expected playlists array but got:`, typeof data.playlists, `for ${endpoint.type}`);
      return null;
    }
    
    console.log(`Received ${data.playlists.length} playlists for ${endpoint.type}`);
    
    // Get the latest playlist (first item in array)
    if (data.playlists.length > 0) {
      const latestPlaylist = data.playlists[0];
      console.log(`Latest ${endpoint.type} playlist:`, latestPlaylist.publish_date);
      
      // Check if it's from today
      if (isToday(latestPlaylist.publish_date)) {
        // Construct Spotify URL from playlist_id
        const spotifyUrl = `https://open.spotify.com/playlist/${latestPlaylist.playlist_id}`;
        
        return {
          ...latestPlaylist,
          url: spotifyUrl,
          type: endpoint.type,
          emoji: endpoint.emoji
        };
      } else {
        console.log(`${endpoint.type} playlist is not from today (${latestPlaylist.publish_date})`);
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`Error fetching ${endpoint.type} playlist:`, error);
    return null;
  }
}

// Fetch today's playlists from all endpoints
export const fetchDailyPlaylists = async () => {
  console.log('Fetching daily playlists from all endpoints...');
  
  // Fetch from all endpoints in parallel
  const playlistPromises = PLAYLIST_ENDPOINTS.map(endpoint => 
    fetchLatestPlaylist(endpoint)
  );
  
  const results = await Promise.all(playlistPromises);
  
  // Filter out null results (no playlist or not from today)
  const todaysPlaylists = results.filter(playlist => playlist !== null);
  
  console.log(`Found ${todaysPlaylists.length} playlists for today`);
  return todaysPlaylists;
};

// Format playlists into Telegram message
export const formatPlaylistMessage = (playlists) => {
  if (playlists.length === 0) {
    return null;
  }
  
  let message = '🎵 Today\'s Flow Playlists\n\n';
  
  playlists.forEach(playlist => {
    // URL should be constructed in fetchLatestPlaylist, but fallback just in case
    const url = playlist.url || `https://open.spotify.com/playlist/${playlist.playlist_id}`;
    
    if (url) {
      message += `${playlist.emoji} ${playlist.type}: ${url}\n`;
    }
  });
  
  message += '\nHappy flowing! 🌊';
  
  return message;
};

// Main function to post daily playlists
export const postDailyPlaylists = async () => {
  try {
    console.log('Starting daily playlist posting...');
    
    // Check required environment variables
    if (!process.env.FS_COMPOSER_API_KEY) {
      console.error('Missing FS_COMPOSER_API_KEY environment variable');
      return false;
    }
    
    if (!process.env.MUSIC_CHAT_ID || !process.env.MUSIC_TOPIC_ID) {
      console.error('Missing MUSIC_CHAT_ID or MUSIC_TOPIC_ID environment variables');
      return false;
    }
    
    // Fetch today's playlists
    const playlists = await fetchDailyPlaylists();
    
    if (playlists.length === 0) {
      console.log('No playlists found for today, skipping post');
      return false;
    }
    
    // Format and send message
    const message = formatPlaylistMessage(playlists);
    if (message) {
      await sendMessage(
        process.env.MUSIC_CHAT_ID,
        message,
        parseInt(process.env.MUSIC_TOPIC_ID)
      );
      console.log('Daily playlists posted successfully');
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error('Error posting daily playlists:', error);
    return false;
  }
};