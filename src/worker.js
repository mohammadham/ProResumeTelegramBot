// Import necessary libraries
import { hash } from 'bcryptjs';

// Define environment variables
const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';
const CHANNEL_ID = 'YOUR_TELEGRAM_CHANNEL_ID';
const WORKER_URL = 'YOUR_WORKER_URL';

// Initialize KV namespaces
const ADMIN_KV = KV_NAMESPACE_ADMIN;
const USERS_KV = KV_NAMESPACE_USERS;

// Event listener for incoming requests
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    // Handle webhook requests
    if (url.pathname.startsWith('/webhook')) {
        return handleWebhook(request);
    }

    if (request.method !== 'POST') {
        return new Response('Only POST requests allowed');
    }

    const data = await request.json();
    if (data.message) {
        const message = data.message;
        const chatId = message.chat.id;
        const userId = message.from.id;
        const text = message.text;

        // Check if the user is an admin
        const isAdmin = await isUserAdmin(userId);

        if (isAdmin) {
            await handleAdminCommands(message, chatId, text);
        } else {
            await handleUserInteraction(message, chatId, userId, text);
        }
    } else if (data.callback_query) {
        const callback = data.callback_query;
        await handleCallbackQuery(callback);
    } else {
        return new Response('OK');
    }
    return new Response('', { status: 200 });
}

// Webhook management
async function handleWebhook(request) {
    const url = new URL(request.url);
    const params = url.searchParams;
    const action = params.get('action');

    switch (action) {
        case 'set':
            return await setWebhook();
        case 'delete':
            return await deleteWebhook();
        case 'info':
            return await getWebhookInfo();
        default:
            return new Response('Invalid webhook action', { status: 400 });
    }
}

async function setWebhook() {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        method: 'POST',
        body: JSON.stringify({ url: WORKER_URL }),
        headers: { 'Content-Type': 'application/json' }
    });
    return new Response(JSON.stringify(await response.json()));
}

async function deleteWebhook() {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    return new Response(JSON.stringify(await response.json()));
}

async function getWebhookInfo() {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    return new Response(JSON.stringify(await response.json()));
}

// Admin identification function
async function isUserAdmin(userId) {
  const admins = await ADMIN_KV.get('admin_list');
  return admins ? admins.includes(userId) : false;
}

// Admin features
async function editMessageText(chatId, messageId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
    headers: { 'Content-Type': 'application/json' }
  });
}

async function editMessageCaption(chatId, messageId, caption) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageCaption`, {
    method: 'POST',
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption }),
    headers: { 'Content-Type': 'application/json' }
  });
}

async function editMessageMedia(chatId, messageId, media) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageMedia`, {
    method: 'POST',
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, media }),
    headers: { 'Content-Type': 'application/json' }
  });
}

// User registration function
async function registerUser(userId, username, password) {
  const hashedPassword = await hash(password, 10);
  const data = { username, password: hashedPassword, portfolio: {}, resume: {} };
  await USERS_KV.put(String(userId), JSON.stringify(data));
}

// Client interaction
async function handleUserInteraction(message, chatId, userId, text) {
    if (text?.startsWith('/')) {
        return handleCommands(message, chatId, userId, text);
    }
    
    // Handle special messages
    if (message.photo) {
        return handlePhotoMessage(message, chatId);
    }
    if (message.document) {
        return handleFileUpload(message, chatId);
    }
    if (message.contact) {
        return handleContactMessage(message, chatId);
    }

    // Default response with available commands
    return showAvailableCommands(chatId, userId);
}

async function handleCommands(message, chatId, userId, text) {
    const command = text.split(' ')[0].toLowerCase();
    
    switch (command) {
        case '/start':
            return showAvailableCommands(chatId, userId);
        case '/portfolio':
            return handlePortfolioCommand(chatId, userId);
        case '/resume':
            return handleResumeCommand(chatId, userId);
        case '/help':
            return showHelp(chatId);
        default:
            return sendMessage(chatId, 'Unknown command. Use /help to see available commands.');
    }
}

async function showAvailableCommands(chatId, userId) {
    const isAdmin = await isUserAdmin(userId);
    const keyboard = {
        inline_keyboard: [
            [{ text: '📝 Create Portfolio', callback_data: 'create_portfolio' },
             { text: '📄 Create Resume', callback_data: 'create_resume' }],
            [{ text: '❓ Help', callback_data: 'help' }]
        ]
    };

    if (isAdmin) {
        keyboard.inline_keyboard.push([
            { text: '👥 Manage Users', callback_data: 'manage_users' },
            { text: '⚙️ Settings', callback_data: 'settings' }
        ]);
    }

    await sendMessage(chatId, 'Choose an action:', { reply_markup: keyboard });
}

async function handleCallbackQuery(callback) {
    const chatId = callback.message.chat.id;
    const userId = callback.from.id;
    const data = callback.data;

    switch (data) {
        case 'create_portfolio':
            return handlePortfolioCommand(chatId, userId);
        case 'create_resume':
            return handleResumeCommand(chatId, userId);
        case 'help':
            return showHelp(chatId);
        case 'manage_users':
            if (await isUserAdmin(userId)) {
                return handleManageUsers(chatId);
            }
            break;
        case 'settings':
            if (await isUserAdmin(userId)) {
                return handleSettings(chatId);
            }
            break;
    }
}

async function sendMessage(chatId, text, options = {}) {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            ...options
        }),
        headers: { 'Content-Type': 'application/json' }
    });
}

// Special message handlers
async function handlePhotoMessage(message, chatId) {
    // Handle photo upload logic
    await sendMessage(chatId, 'Photo received! What would you like to do with it?', {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Add to Portfolio', callback_data: 'photo_to_portfolio' },
                 { text: 'Add to Resume', callback_data: 'photo_to_resume' }],
                [{ text: 'Cancel', callback_data: 'cancel' }]
            ]
        }
    });
}

async function handleContactMessage(message, chatId) {
    // Handle contact sharing logic
    await sendMessage(chatId, 'Contact information received! Adding to your profile...');
}

// AI integration function
async function getSummaryFromAI(data) {
  const response = await fetch('https://api.openai.com/v1/engines/davinci-codex/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      prompt: data,
      max_tokens: 150
    })
  });
  const result = await response.json();
  return result.choices[0].text;
}

// Error handling and logging
function handleError(error) {
  console.error('An error occurred:', error);
  // Implement logging to Cloudflare logs
}

// Main function to handle bot logic
async function handleBotLogic(message, chatId, userId, isAdmin) {
  try {
    // Implement bot logic based on message content
  } catch (error) {
    handleError(error);
  }
}

async function handleFileUpload(message, chatId) {
    if (message.document) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/forwardMessage`, {
        method: 'POST',
        body: JSON.stringify({
          chat_id: CHANNEL_ID,
          from_chat_id: message.chat.id,
          message_id: message.message_id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      await USERS_KV.put(String(message.from.id) + '_file_id', message.document.file_id);
    }
  }
  async function generatePortfolioLink(userId) {
    const token = generateToken();
    return `${WORKER_URL}/portfolio/${userId}/${token}`;
  }
