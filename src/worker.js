//base run 

// Import necessary libraries

import AuthHandler from './handler/authHandler';
import PortfolioHandler from './handler/portfolioHandler';
import ResumeHandler from './handler/resumeHandler';
import ProfileHandler from './handler/profileHandler';
import Telegram from './handler/telegramHandler';
import KVStore from './handler/kvHandler';
import StateManager from './handler/userstateHandler';
import { showHelp, handleManageUsers, handleSettings } from './utils/helpers';
import { 
    showAvailableCommands, 
    handleAdminCommands
} from './utils/helpers';

// Define environment variables
const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';
const CHANNEL_ID = 'YOUR_TELEGRAM_CHANNEL_ID';  // Added missing parameter
const WORKER_URL = 'YOUR_WORKER_URL';

// Initialize handlers
const kvStore = new KVStore(KV_NAMESPACE_USERS);
const adminKvStore = new KVStore(KV_NAMESPACE_ADMIN);
const stateManager = new StateManager(kvStore);
const telegram = new Telegram(BOT_TOKEN);

const authHandler = new AuthHandler(BOT_TOKEN, adminKvStore, telegram, kvStore, stateManager,WORKER_URL);
const portfolioHandler = new PortfolioHandler(BOT_TOKEN, WORKER_URL, telegram, kvStore);
const resumeHandler = new ResumeHandler(BOT_TOKEN, WORKER_URL, telegram, kvStore);
const profileHandler = new ProfileHandler(BOT_TOKEN, telegram, kvStore);

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    
    if (url.pathname.startsWith('/webhook')) {
        return handleWebhook(request);
    }

    if (request.method !== 'POST') {
        return new Response('Only POST requests allowed');
    }

    const data = await request.json();
    if (data.message) {
        return handleMessage(data.message);
    } else if (data.callback_query) {
        return handleCallbackQuery(data.callback_query);
    }

    return new Response('OK');
}

async function handleMessage(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text;

    const isAdmin = await authHandler.isUserAdmin(userId);
    const userState = await stateManager.getUserState(userId);

    if (text?.startsWith('/')) {
        return handleCommands(message, chatId, userId, isAdmin);
    }

    // Handle authentication flow and state-based interactions
    const isLoggedIn = await authHandler.checkUserLogin(userId);
    if (!isLoggedIn && userState === 'NONE') {
        return authHandler.showLoginOptions(chatId);
    }

    if (!isLoggedIn) {
        return authHandler.handleAuthFlow(message, chatId, userId, text, userState);
    }

    // Handle special message types
    if (message.photo) {
        return handlePhotoMessage(message, chatId);
    }
    if (message.document) {
        return handleFileUpload(message, chatId);
    }
    if (message.contact) {
        return handleContactMessage(message, chatId);
    }

    return showAvailableCommands(chatId, userId, isAdmin);
}

async function handleCommands(message, chatId, userId, isAdmin) {
    const command = message.text.split(' ')[0].toLowerCase();
    
    switch (command) {
        case '/start':
            return showAvailableCommands(chatId, userId, isAdmin);
        case '/portfolio':
            return portfolioHandler.handlePortfolioCommand(chatId, userId);
        case '/resume':
            return resumeHandler.handleResumeCommand(chatId, userId);
        case '/profile':
            return profileHandler.handleProfileView(chatId, userId);
        case '/help':
            return showHelp(chatId, telegram);
        default:
            if (isAdmin && message.text.startsWith('/broadcast')) {
                return handleAdminCommands(message, chatId, message.text, telegram, kvStore);
            }
            return telegram.sendMessage(chatId, 'Unknown command. Use /help to see available commands.');
    }
}

async function handleCallbackQuery(callback) {
    const chatId = callback.message.chat.id;
    const userId = callback.from.id;
    const data = callback.data;

    switch (data) {
        case 'login':
        case 'register':
        case 'logout':
            return authHandler.handleAuthCallback(chatId, userId, data);

        case 'create_portfolio':
        case 'view_portfolios':
        case 'edit_portfolio':
        case 'portfolio_basic':
        case 'portfolio_pro':
        case 'portfolio_creative':
        case 'portfolio_custom':
            return portfolioHandler.handlePortfolioCallback(chatId, userId, data);

        case 'create_resume':
        case 'view_resumes':
        case 'edit_resume':
        case 'resume_standard':
        case 'resume_targeted':
        case 'resume_modern':
        case 'resume_custom':
            return resumeHandler.handleResumeCallback(chatId, userId, data);

        case 'profile':
            return profileHandler.handleProfileView(chatId, userId);

        case 'manage_users':
            return handleManageUsers(chatId, telegram, kvStore);

        case 'settings':
            return handleSettings(chatId, telegram);

        case 'back_to_main':
            return showAvailableCommands(chatId, userId, await authHandler.isUserAdmin(userId));

        default:
            return telegram.sendMessage(chatId, 'Unknown callback query');
    }
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

// Special message handlers
async function handlePhotoMessage(message, chatId) {
    // Handle photo upload logic
    await telegram.sendMessage(chatId, 'Photo received! What would you like to do with it?', {
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
    await telegram.sendMessage(chatId, 'Contact information received! Adding to your profile...');
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
      await kvStore.put(String(message.from.id) + '_file_id', message.document.file_id);
    }
}


