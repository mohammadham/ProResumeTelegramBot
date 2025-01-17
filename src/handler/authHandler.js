class AuthHandler {
    constructor(botToken, usersKV, adminKV) {
        this.botToken = botToken;
        this.usersKV = usersKV;
        this.adminKV = adminKV;
    }

    async checkUserLogin(userId) {
        const userData = await this.usersKV.get(`user_${userId}`);
        return !!userData;
    }

    async attemptLogin(userId, username, password) {
        const userData = await this.usersKV.get(`user_${username}`);
        if (!userData) return false;
        
        const user = JSON.parse(userData);
        const passwordMatch = await compare(password, user.password);
        
        if (passwordMatch) {
            await this.usersKV.put(`user_${userId}`, JSON.stringify({
                ...user,
                lastLogin: new Date().toISOString()
            }));
            return true;
        }
        return false;
    }

    async logout(userId) {
        await this.usersKV.delete(`user_${userId}`);
        await setUserState(userId, UserState.NONE);
    }

    async handleAuthFlow(message, chatId, userId, text, userState) {
        switch (userState) {
            case UserState.AWAITING_LOGIN_USERNAME:
                await this.usersKV.put(`${userId}_temp_username`, text);
                await setUserState(userId, UserState.AWAITING_LOGIN_PASSWORD);
                return this.sendMessage(chatId, 'Please enter your password:');

            case UserState.AWAITING_LOGIN_PASSWORD:
                const loginUsername = await this.usersKV.get(`${userId}_temp_username`);
                const loginSuccess = await this.attemptLogin(userId, loginUsername, text);
                if (loginSuccess) {
                    await setUserState(userId, UserState.NONE);
                    await this.usersKV.delete(`${userId}_temp_username`);
                    return showAvailableCommands(chatId, userId);
                }
                await setUserState(userId, UserState.NONE);
                return showLoginOptions(chatId);

            case UserState.AWAITING_REGISTER_USERNAME:
                await this.usersKV.put(`${userId}_temp_username`, text);
                await setUserState(userId, UserState.AWAITING_REGISTER_PASSWORD);
                return this.sendMessage(chatId, 'Please enter your desired password:');

            case UserState.AWAITING_REGISTER_PASSWORD:
                const regUsername = await this.usersKV.get(`${userId}_temp_username`);
                await registerUser(userId, regUsername, text);
                await setUserState(userId, UserState.NONE);
                await this.usersKV.delete(`${userId}_temp_username`);
                return showAvailableCommands(chatId, userId);

            case UserState.AWAITING_PORTFOLIO_NAME:
                const portfolioType = await this.usersKV.get(`${userId}_portfolio_type`);
                await updateUserPortfolio(userId, 'type', portfolioType);
                await updateUserPortfolio(userId, 'name', text);
                await setUserState(userId, UserState.AWAITING_PORTFOLIO_DESCRIPTION);
                return this.sendMessage(chatId, 'Great! Now please enter a description for your portfolio:');

            case UserState.AWAITING_PORTFOLIO_DESCRIPTION:
                await updateUserPortfolio(userId, 'description', text);
                await setUserState(userId, UserState.AWAITING_PORTFOLIO_SKILLS);
                return this.sendMessage(chatId, 'Please enter your skills (comma-separated):');

            case UserState.AWAITING_PORTFOLIO_SKILLS:
                await updateUserPortfolio(userId, 'skills', text.split(',').map(s => s.trim()));
                await setUserState(userId, UserState.NONE);
                const portfolioLink = await generatePortfolioLink(userId);
                return this.sendMessage(chatId, `Portfolio created! You can view it here: ${portfolioLink}`);

            case UserState.AWAITING_RESUME_PERSONAL:
                const resumeType = await this.usersKV.get(`${userId}_resume_type`);
                await updateUserResume(userId, 'type', resumeType);
                await updateUserResume(userId, 'personal', text);
                await setUserState(userId, UserState.AWAITING_RESUME_EDUCATION);
                return this.sendMessage(chatId, 'Please enter your education history:');

            case UserState.AWAITING_RESUME_EDUCATION:
                await updateUserResume(userId, 'education', text);
                await setUserState(userId, UserState.AWAITING_RESUME_EXPERIENCE);
                return this.sendMessage(chatId, 'Please enter your work experience:');

            case UserState.AWAITING_RESUME_EXPERIENCE:
                await updateUserResume(userId, 'experience', text);
                await setUserState(userId, UserState.AWAITING_RESUME_SKILLS);
                return this.sendMessage(chatId, 'Finally, please enter your skills:');

            case UserState.AWAITING_RESUME_SKILLS:
                await updateUserResume(userId, 'skills', text.split(',').map(s => s.trim()));
                await setUserState(userId, UserState.NONE);
                const resumeLink = await generateResumeLink(userId);
                return this.sendMessage(chatId, `Resume created! You can view it here: ${resumeLink}`);
        }
    }

    async showLoginOptions(chatId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '🔑 Login', callback_data: 'login' },
                { text: '📝 Register', callback_data: 'register' }],
                [{ text: '❓ Help', callback_data: 'help' }]
            ]
        };
        
        await this.sendMessage(chatId, 'Welcome! Please login or register to continue:', 
            { reply_markup: keyboard });
    }

    async registerUser(userId, username, password) {
        const hashedPassword = await hash(password, 10);
        const data = { username, password: hashedPassword, portfolio: {}, resume: {} };
        await this.usersKV.put(String(userId), JSON.stringify(data));
    }

    async isUserAdmin(userId) {
        const admins = await this.adminKV.get('admin_list');
        return admins ? admins.includes(userId) : false;
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

export default AuthHandler;