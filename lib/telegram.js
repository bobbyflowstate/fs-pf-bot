export const sendMessage = async (chatId, text) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  
  if (!botToken) {
    console.error('TELEGRAM_BOT_TOKEN not configured');
    return;
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Telegram API error:', error);
    }
    
    return response.json();
    
  } catch (error) {
    console.error('Send message error:', error);
  }
};