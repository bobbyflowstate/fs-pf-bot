export const sendMessage = async (chatId, text, messageThreadId = null) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return;
  }
  
  try {
    const requestBody = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    };
    
    // Add message_thread_id for forum groups
    if (messageThreadId) {
      requestBody.message_thread_id = messageThreadId;
    }
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('Telegram API error:', result);
      
      // Handle specific errors gracefully
      if (result.description === 'Bad Request: TOPIC_CLOSED') {
        console.log('Topic is closed, but task completion was logged successfully');
      }
      
      return null;
    }
    
    return result;
    
  } catch (error) {
    console.error('Send message error:', error);
    return null;
  }
};