class ProfileHandler {
    constructor(botToken, userKV) {
        this.botToken = botToken;
        this.usersKV = userKV;
    }

    async handleProfileView(chatId, userId) {
        const userData = JSON.parse(await this.usersKV.get(`user_${userId}`));
        if (!userData) {
            return this.sendMessage(chatId, 'Profile not found. Please login again.');
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
    
        await this.sendMessage(chatId, profileText, { reply_markup: keyboard });
    }

    async sendMessage(chatId, text, options = {}) {
        await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
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
}

export default ProfileHandler;