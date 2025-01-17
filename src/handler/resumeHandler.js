class ResumeHandler {
    constructor(botToken, userKV, workerUrl) {
        this.botToken = botToken;
        this.usersKV = userKV;
        this.workerUrl = workerUrl;
    }

    async handleViewResumes(chatId, userId) {
        const userData = JSON.parse(await this.usersKV.get(`user_${userId}`));
        if (!userData.resume || !userData.resume.personal) {
            return this.sendMessage(chatId, 'You haven\'t created any resumes yet.');
        }
        const resumeLink = await this.generateResumeLink(userId);
        return this.sendMessage(chatId, `Your resume\nLink: ${resumeLink}`);
    }

    async generateResumeLink(userId) {
        const token = this.generateToken();
        return `${this.workerUrl}/resume/${userId}/${token}`;
    }

    async updateUserResume(userId, field, value) {
        const userData = JSON.parse(await this.usersKV.get(`user_${userId}`));
        if (!userData.resume) userData.resume = {};
        userData.resume[field] = value;
        await this.usersKV.put(`user_${userId}`, JSON.stringify(userData));
    }

    async handleResumeCommand(chatId, userId) {
        const isLoggedIn = await this.checkUserLogin(userId);
        if (!isLoggedIn) {
            return this.showLoginOptions(chatId);
        }
    
        const keyboard = {
            inline_keyboard: [
                [{ text: '🆕 Create New Resume', callback_data: 'create_resume' }],
                [{ text: '📄 View My Resumes', callback_data: 'view_resumes' }],
                [{ text: '✏️ Edit Resume', callback_data: 'edit_resume' }],
                [{ text: '🔙 Back', callback_data: 'back_to_main' }]
            ]
        };
    
        await this.sendMessage(chatId, 'Resume Management:', { reply_markup: keyboard });
    }

    async startResumeCreation(chatId, userId, type) {
        await this.usersKV.put(`${userId}_resume_type`, type);
        await this.setUserState(userId, UserState.AWAITING_RESUME_PERSONAL);
        
        const message = `Let's create your ${type} resume!\n\n` +
            `Please enter your personal information in this format:\n` +
            `Name\nEmail\nPhone\nLocation`;
        
        await this.sendMessage(chatId, message);
    }

    async handleResumeCreationFlow(chatId, userId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '📄 Standard Resume', callback_data: 'resume_standard' }],
                [{ text: '🎯 Targeted Resume', callback_data: 'resume_targeted' }],
                [{ text: '💫 Modern Resume', callback_data: 'resume_modern' }],
                [{ text: '🌟 Custom Resume', callback_data: 'resume_custom' }],
                [{ text: '🔙 Back', callback_data: 'back_to_main' }]
            ]
        };
    
        const message = `Choose your resume type:\n\n` +
            `📄 Standard - Traditional format\n` +
            `🎯 Targeted - Industry-specific\n` +
            `💫 Modern - Contemporary design\n` +
            `🌟 Custom - Unique and Custom design` ;
    
        await this.sendMessage(chatId, message, { reply_markup: keyboard });
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

export default ResumeHandler;