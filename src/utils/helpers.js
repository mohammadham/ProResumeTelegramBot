import StateManager from '../handler/userstateHandler';
import Telegram from '../handler/telegramHandler';
import KVStore from '../handler/kvHandler';

const kvStore = new KVStore(KV_NAMESPACE_USERS);
const stateManager = new StateManager(kvStore);
const telegram = new Telegram(BOT_TOKEN);

export function generateToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

export async function showHelp(chatId, telegram) {
    const helpText = `
Available Commands:
/start - Start the bot
/portfolio - Manage your portfolios
/resume - Manage your resumes
/profile - View your profile
/help - Show this help message

For more assistance, contact our support.
    `;
    
    await telegram.sendMessage(chatId, helpText);
}

export async function handleManageUsers(chatId, telegram, kvStore) {
    const users = await kvStore.list('user_');
    const userCount = users.length;
    
    const message = `
👥 User Management
Total Users: ${userCount}

Select an action:
    `;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '📊 View Users', callback_data: 'view_users' }],
            [{ text: '🚫 Ban User', callback_data: 'ban_user' }],
            [{ text: '🔙 Back', callback_data: 'back_to_main' }]
        ]
    };
    
    await telegram.sendMessage(chatId, message, { reply_markup: keyboard });
}

export async function handleSettings(chatId, telegram) {
    const keyboard = {
        inline_keyboard: [
            [{ text: '🔔 Notifications', callback_data: 'settings_notifications' }],
            [{ text: '🔒 Privacy', callback_data: 'settings_privacy' }],
            [{ text: '🌐 Language', callback_data: 'settings_language' }],
            [{ text: '🔙 Back', callback_data: 'back_to_main' }]
        ]
    };
    
    await telegram.sendMessage(chatId, '⚙️ Settings:', { reply_markup: keyboard });
}

export async function getUserState(kvStore, userId) {
    return (await kvStore.get(`${userId}_state`)) || 'NONE';
}

export async function setUserState(kvStore, userId, state) {
    await kvStore.put(`${userId}_state`, state);
}

export async function showAvailableCommands(chatId, userId, isAdmin, telegram) {
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

    await telegram.sendMessage(chatId, 'Choose an action:', { reply_markup: keyboard });
}

export async function handleAdminCommands(message, chatId, text, telegram, kvStore) {
    if (text.startsWith('/broadcast')) {
        const broadcastMessage = text.substring(10);
        const users = await kvStore.list('user_');
        for (const user of users) {
            await telegram.sendMessage(user.name, broadcastMessage);
        }
        return telegram.sendMessage(chatId, 'Broadcast sent successfully!');
    }
}
