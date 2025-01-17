// Import necessary libraries
import { hash, compare } from 'bcryptjs';

// Define environment variables
const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN';
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';
const CHANNEL_ID = 'YOUR_TELEGRAM_CHANNEL_ID';
const WORKER_URL = 'YOUR_WORKER_URL';

// Initialize KV namespaces
const ADMIN_KV = KV_NAMESPACE_ADMIN;
const USERS_KV = KV_NAMESPACE_USERS;

// Add new state management
const UserState = {
    NONE: 'none',
    AWAITING_LOGIN_USERNAME: 'awaiting_login_username',
    AWAITING_LOGIN_PASSWORD: 'awaiting_login_password',
    AWAITING_REGISTER_USERNAME: 'awaiting_register_username',
    AWAITING_REGISTER_PASSWORD: 'awaiting_register_password',
    AWAITING_PORTFOLIO_NAME: 'awaiting_portfolio_name',
    AWAITING_PORTFOLIO_DESCRIPTION: 'awaiting_portfolio_description',
    AWAITING_PORTFOLIO_SKILLS: 'awaiting_portfolio_skills',
    AWAITING_RESUME_PERSONAL: 'awaiting_resume_personal',
    AWAITING_RESUME_EDUCATION: 'awaiting_resume_education',
    AWAITING_RESUME_EXPERIENCE: 'awaiting_resume_experience',
    AWAITING_RESUME_SKILLS: 'awaiting_resume_skills'
};

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
    // Check if user is logged in
    const isLoggedIn = await checkUserLogin(userId);
    const userState = await getUserState(userId);

    if (!isLoggedIn && userState === UserState.NONE) {
        return showLoginOptions(chatId);
    }

    // Handle authentication states
    if (!isLoggedIn) {
        return handleAuthFlow(message, chatId, userId, text, userState);
    }

    // Handle normal commands for logged in users
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

async function showLoginOptions(chatId) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '🔑 Login', callback_data: 'login' },
             { text: '📝 Register', callback_data: 'register' }],
            [{ text: '❓ Help', callback_data: 'help' }]
        ]
    };
    
    await sendMessage(chatId, 'Welcome! Please login or register to continue:', 
        { reply_markup: keyboard });
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

// Modify showAvailableCommands
async function showAvailableCommands(chatId, userId) {
    const isAdmin = await isUserAdmin(userId);
    const keyboard = {
        inline_keyboard: [
            [{ text: '📝 Create Portfolio', callback_data: 'create_portfolio' },
             { text: '📄 Create Resume', callback_data: 'create_resume' }],
            [{ text: '👤 My Profile', callback_data: 'profile' },
             { text: '📤 Logout', callback_data: 'logout' }],
            [{ text: '❓ Help', callback_data: 'help' }]
        ]
    };

    if (isAdmin) {
        keyboard.inline_keyboard.unshift([
            { text: '👥 Manage Users', callback_data: 'manage_users' },
            { text: '⚙️ Settings', callback_data: 'settings' }
        ]);
    }

    await sendMessage(chatId, 'Choose an action:', { reply_markup: keyboard });
}

// Modify handleCallbackQuery
async function handleCallbackQuery(callback) {
    const chatId = callback.message.chat.id;
    const userId = callback.from.id;
    const data = callback.data;

    switch (data) {
        case 'login':
            await setUserState(userId, UserState.AWAITING_LOGIN_USERNAME);
            return sendMessage(chatId, 'Please enter your username:');
        case 'register':
            await setUserState(userId, UserState.AWAITING_REGISTER_USERNAME);
            return sendMessage(chatId, 'Please enter your desired username:');
        case 'logout':
            await logout(userId);
            return showLoginOptions(chatId);
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
        case 'new_portfolio':
            await setUserState(userId, UserState.AWAITING_PORTFOLIO_NAME);
            return sendMessage(chatId, 'Please enter a name for your portfolio:');
        
        case 'new_resume':
            await setUserState(userId, UserState.AWAITING_RESUME_PERSONAL);
            return sendMessage(chatId, 'Please enter your personal information (name, email, phone):');
        
        case 'view_portfolios':
            return handleViewPortfolios(chatId, userId);
        
        case 'view_resumes':
            return handleViewResumes(chatId, userId);
        
        case 'back_to_main':
            await setUserState(userId, UserState.NONE);
            return showAvailableCommands(chatId, userId);
    }
}

async function handleAuthFlow(message, chatId, userId, text, userState) {
    switch (userState) {
        case UserState.AWAITING_LOGIN_USERNAME:
            await USERS_KV.put(`${userId}_temp_username`, text);
            await setUserState(userId, UserState.AWAITING_LOGIN_PASSWORD);
            return sendMessage(chatId, 'Please enter your password:');

        case UserState.AWAITING_LOGIN_PASSWORD:
            const loginUsername = await USERS_KV.get(`${userId}_temp_username`);
            const loginSuccess = await attemptLogin(userId, loginUsername, text);
            if (loginSuccess) {
                await setUserState(userId, UserState.NONE);
                await USERS_KV.delete(`${userId}_temp_username`);
                return showAvailableCommands(chatId, userId);
            }
            await setUserState(userId, UserState.NONE);
            return showLoginOptions(chatId);

        case UserState.AWAITING_REGISTER_USERNAME:
            await USERS_KV.put(`${userId}_temp_username`, text);
            await setUserState(userId, UserState.AWAITING_REGISTER_PASSWORD);
            return sendMessage(chatId, 'Please enter your desired password:');

        case UserState.AWAITING_REGISTER_PASSWORD:
            const regUsername = await USERS_KV.get(`${userId}_temp_username`);
            await registerUser(userId, regUsername, text);
            await setUserState(userId, UserState.NONE);
            await USERS_KV.delete(`${userId}_temp_username`);
            return showAvailableCommands(chatId, userId);

        case UserState.AWAITING_PORTFOLIO_NAME:
            await updateUserPortfolio(userId, 'name', text);
            await setUserState(userId, UserState.AWAITING_PORTFOLIO_DESCRIPTION);
            return sendMessage(chatId, 'Great! Now please enter a description for your portfolio:');

        case UserState.AWAITING_PORTFOLIO_DESCRIPTION:
            await updateUserPortfolio(userId, 'description', text);
            await setUserState(userId, UserState.AWAITING_PORTFOLIO_SKILLS);
            return sendMessage(chatId, 'Please enter your skills (comma-separated):');

        case UserState.AWAITING_PORTFOLIO_SKILLS:
            await updateUserPortfolio(userId, 'skills', text.split(',').map(s => s.trim()));
            await setUserState(userId, UserState.NONE);
            const portfolioLink = await generatePortfolioLink(userId);
            return sendMessage(chatId, `Portfolio created! You can view it here: ${portfolioLink}`);

        case UserState.AWAITING_RESUME_PERSONAL:
            await updateUserResume(userId, 'personal', text);
            await setUserState(userId, UserState.AWAITING_RESUME_EDUCATION);
            return sendMessage(chatId, 'Please enter your education history:');

        case UserState.AWAITING_RESUME_EDUCATION:
            await updateUserResume(userId, 'education', text);
            await setUserState(userId, UserState.AWAITING_RESUME_EXPERIENCE);
            return sendMessage(chatId, 'Please enter your work experience:');

        case UserState.AWAITING_RESUME_EXPERIENCE:
            await updateUserResume(userId, 'experience', text);
            await setUserState(userId, UserState.AWAITING_RESUME_SKILLS);
            return sendMessage(chatId, 'Finally, please enter your skills:');

        case UserState.AWAITING_RESUME_SKILLS:
            await updateUserResume(userId, 'skills', text.split(',').map(s => s.trim()));
            await setUserState(userId, UserState.NONE);
            const resumeLink = await generateResumeLink(userId);
            return sendMessage(chatId, `Resume created! You can view it here: ${resumeLink}`);
    }
}

async function setUserState(userId, state) {
    await USERS_KV.put(`${userId}_state`, state);
}

async function getUserState(userId) {
    return (await USERS_KV.get(`${userId}_state`)) || UserState.NONE;
}

async function checkUserLogin(userId) {
    const userData = await USERS_KV.get(`user_${userId}`);
    return !!userData;
}

async function attemptLogin(userId, username, password) {
    const userData = await USERS_KV.get(`user_${username}`);
    if (!userData) return false;
    
    const user = JSON.parse(userData);
    const passwordMatch = await compare(password, user.password);
    
    if (passwordMatch) {
        await USERS_KV.put(`user_${userId}`, JSON.stringify({
            ...user,
            lastLogin: new Date().toISOString()
        }));
        return true;
    }
    return false;
}

async function logout(userId) {
    await USERS_KV.delete(`user_${userId}`);
    await setUserState(userId, UserState.NONE);
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

async function handlePortfolioCommand(chatId, userId) {
    const isLoggedIn = await checkUserLogin(userId);
    if (!isLoggedIn) {
        return showLoginOptions(chatId);
    }

    const keyboard = {
        inline_keyboard: [
            [{ text: '🆕 Create New Portfolio', callback_data: 'new_portfolio' }],
            [{ text: '📂 View My Portfolios', callback_data: 'view_portfolios' }],
            [{ text: '✏️ Edit Portfolio', callback_data: 'edit_portfolio' }],
            [{ text: '🔙 Back', callback_data: 'back_to_main' }]
        ]
    };

    await sendMessage(chatId, 'Portfolio Management:', { reply_markup: keyboard });
}

async function handleResumeCommand(chatId, userId) {
    const isLoggedIn = await checkUserLogin(userId);
    if (!isLoggedIn) {
        return showLoginOptions(chatId);
    }

    const keyboard = {
        inline_keyboard: [
            [{ text: '🆕 Create New Resume', callback_data: 'new_resume' }],
            [{ text: '📄 View My Resumes', callback_data: 'view_resumes' }],
            [{ text: '✏️ Edit Resume', callback_data: 'edit_resume' }],
            [{ text: '🔙 Back', callback_data: 'back_to_main' }]
        ]
    };

    await sendMessage(chatId, 'Resume Management:', { reply_markup: keyboard });
}

async function updateUserPortfolio(userId, field, value) {
    const userData = JSON.parse(await USERS_KV.get(`user_${userId}`));
    if (!userData.portfolio) userData.portfolio = {};
    userData.portfolio[field] = value;
    await USERS_KV.put(`user_${userId}`, JSON.stringify(userData));
}

async function updateUserResume(userId, field, value) {
    const userData = JSON.parse(await USERS_KV.get(`user_${userId}`));
    if (!userData.resume) userData.resume = {};
    userData.resume[field] = value;
    await USERS_KV.put(`user_${userId}`, JSON.stringify(userData));
}

async function handleViewPortfolios(chatId, userId) {
    const userData = JSON.parse(await USERS_KV.get(`user_${userId}`));
    if (!userData.portfolio || !userData.portfolio.name) {
        return sendMessage(chatId, 'You haven\'t created any portfolios yet.');
    }
    const portfolioLink = await generatePortfolioLink(userId);
    return sendMessage(chatId, `Your portfolio: ${userData.portfolio.name}\nLink: ${portfolioLink}`);
}

async function handleViewResumes(chatId, userId) {
    const userData = JSON.parse(await USERS_KV.get(`user_${userId}`));
    if (!userData.resume || !userData.resume.personal) {
        return sendMessage(chatId, 'You haven\'t created any resumes yet.');
    }
    const resumeLink = await generateResumeLink(userId);
    return sendMessage(chatId, `Your resume\nLink: ${resumeLink}`);
}

async function generateResumeLink(userId) {
    const token = generateToken();
    return `${WORKER_URL}/resume/${userId}/${token}`;
}
