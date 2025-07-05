import { parseMessage } from '../lib/parser.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message } = req.body;
    
    if (!message?.text) {
      return res.status(200).json({ ok: true, debug: 'No text message' });
    }
    
    console.log('🔍 DEBUG - Received message:', message.text);
    
    const parsed = await parseMessage(message.text, message.from.username);
    
    console.log('🎯 DEBUG - Parsed result:', JSON.stringify(parsed, null, 2));
    
    return res.status(200).json({ 
      ok: true, 
      debug: {
        originalMessage: message.text,
        parsedResult: parsed
      }
    });
    
  } catch (error) {
    console.error('DEBUG webhook error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      debug: error.message 
    });
  }
}