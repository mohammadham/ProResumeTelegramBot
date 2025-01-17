import {Telegram} from "telegramHandler";
import {KVStore} from "kvHandler";
class ProfileHandler {
    constructor(botToken, telegram, kvStore) {
        this.telegram = telegram;
        this.kvStore = kvStore;
        this.botToken = botToken;
        // this.usersKV = userKV;
    }


    async handleProfileView(chatId, userId) {
        const userData = JSON.parse(await this.kvStore.get(`user_${userId}`));
        if (!userData) {
            return this.telegram.sendMessage(chatId, 'Profile not found. Please login again.');
        }
    
        const keyboard = {
            inline_keyboard: [
                [{ text: '📝 Edit Profile', callback_data: 'edit_profile' }],
                [{ text: '🔙 Back', callback_data: 'back_to_main' }]
            ]
        };
    
        const profileText = `👤 Your Profile\n\n` +
            `Username: ${userData.username}\n` +
            `Portfolios: ${userData.portfolio ? '1' : '0'}\n` +
            `Resumes: ${userData.resume ? '1' : '0'}\n` +
            `Last Login: ${new Date(userData.lastLogin).toLocaleString()}`;
    
        await this.telegram.sendMessage(chatId, profileText, { reply_markup: keyboard });
    }

   
}

export default ProfileHandler;