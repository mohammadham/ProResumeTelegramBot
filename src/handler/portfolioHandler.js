class PortfolioHandler {
    constructor(botToken, userKV, workerUrl) {
        this.botToken = botToken;
        this.usersKV = userKV;
        this.workerUrl = workerUrl;
    }

    async generatePortfolioLink(userId) {
        const token = this.generateToken();
        return `${this.workerUrl}/portfolio/${userId}/${token}`;
    }

    async handlePortfolioCommand(chatId, userId) {
        const isLoggedIn = await this.checkUserLogin(userId);
        if (!isLoggedIn) {
            return this.showLoginOptions(chatId);
        }

        const keyboard = {
            inline_keyboard: [
                [{ text: '🆕 Create New Portfolio', callback_data: 'create_portfolio' }],
                [{ text: '📂 View My Portfolios', callback_data: 'view_portfolios' }],
                [{ text: '✏️ Edit Portfolio', callback_data: 'edit_portfolio' }],
                [{ text: '🔙 Back', callback_data: 'back_to_main' }]
            ]
        };

        await this.sendMessage(chatId, 'Portfolio Management:', { reply_markup: keyboard });
    }

    async updateUserPortfolio(userId, field, value) {
        const userData = JSON.parse(await this.usersKV.get(`user_${userId}`));
        if (!userData.portfolio) userData.portfolio = {};
        userData.portfolio[field] = value;
        await this.usersKV.put(`user_${userId}`, JSON.stringify(userData));
    }

    async handleViewPortfolios(chatId, userId) {
        const userData = JSON.parse(await this.usersKV.get(`user_${userId}`));
        if (!userData.portfolio || !userData.portfolio.name) {
            return this.sendMessage(chatId, 'You haven\'t created any portfolios yet.');
        }
        const portfolioLink = await this.generatePortfolioLink(userId);
        return this.sendMessage(chatId, `Your portfolio: ${userData.portfolio.name}\nLink: ${portfolioLink}`);
    }

    async startPortfolioCreation(chatId, userId, type) {
        await this.usersKV.put(`${userId}_portfolio_type`, type);
        await this.setUserState(userId, UserState.AWAITING_PORTFOLIO_NAME);
        
        const message = `Let's create your ${type} portfolio!\n\n` +
            `First, please enter a name for your portfolio:`;
        
        await this.sendMessage(chatId, message);
    }

    async handlePortfolioCreationFlow(chatId, userId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '🎨 Basic Portfolio', callback_data: 'portfolio_basic' }],
                [{ text: '💼 Professional Portfolio', callback_data: 'portfolio_pro' }],
                [{ text: '🌟 Creative Portfolio', callback_data: 'portfolio_creative' }],
                [{ text: '🌟 Custom Portfolio', callback_data: 'portfolio_custom' }],
                [{ text: '🔙 Back', callback_data: 'back_to_main' }]
            ]
        };

        const message = `Choose your portfolio type:\n\n` +
            `🎨 Basic - Simple and clean design\n` +
            `💼 Professional - Formal and detailed\n` +
            `🌟 Creative - Unique and eye-catching\n`+
            `🌟 Custom - Unique and Custom design` 
            ;

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

export default PortfolioHandler;