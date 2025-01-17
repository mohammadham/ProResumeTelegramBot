import Telegram from './telegramHandler.js';
import KVStore from './kvHandler.js';
import { generateToken } from '../utils/helpers';

class PortfolioHandler {
    constructor(botToken, workerUrl, telegram, kvStore) {
        this.telegram = telegram;
        this.kvStore = kvStore;
        this.botToken = botToken;
        this.workerUrl = workerUrl;
    }
    UserState = {
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
    async generatePortfolioLink(userId) {
        const token = generateToken();
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

        await this.telegram.sendMessage(chatId, 'Portfolio Management:', { reply_markup: keyboard });
    }

    async updateUserPortfolio(userId, field, value) {
        const userData = JSON.parse(await this.kvStore.get(`user_${userId}`));
        if (!userData.portfolio) userData.portfolio = {};
        userData.portfolio[field] = value;
        await this.kvStore.put(`user_${userId}`, JSON.stringify(userData));
    }

    async handleViewPortfolios(chatId, userId) {
        const userData = JSON.parse(await this.kvStore.get(`user_${userId}`));
        if (!userData.portfolio || !userData.portfolio.name) {
            return this.telegram.sendMessage(chatId, 'You haven\'t created any portfolios yet.');
        }
        const portfolioLink = await this.generatePortfolioLink(userId);
        return this.telegram.sendMessage(chatId, `Your portfolio: ${userData.portfolio.name}\nLink: ${portfolioLink}`);
    }

    async startPortfolioCreation(chatId, userId, type) {
        await this.kvStore.put(`${userId}_portfolio_type`, type);
        await this.setUserState(userId, this.UserState.AWAITING_PORTFOLIO_NAME);
        
        const message = `Let's create your ${type} portfolio!\n\n` +
            `First, please enter a name for your portfolio:`;
        
        await this.telegram.sendMessage(chatId, message);
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

        await this.telegram.sendMessage(chatId, message, { reply_markup: keyboard });
    }

    async showLoginOptions(chatId) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '🔑 Login', callback_data: 'login' }],
                [{ text: '❓ Help', callback_data: 'help' }]
            ]
        };
        await this.telegram.sendMessage(chatId, 'Please login to continue:', { reply_markup: keyboard });
    }

    async checkUserLogin(userId) {
        const userData = await this.kvStore.get(`user_${userId}`);
        return !!userData;
    }

    async setUserState(userId, state) {
        await this.kvStore.put(`${userId}_state`, state);
    }

    async handlePortfolioCallback(chatId, userId, data) {
        switch (data) {
            case 'create_portfolio':
                return this.handlePortfolioCreationFlow(chatId, userId);
            case 'view_portfolios':
                return this.handleViewPortfolios(chatId, userId);
            case 'edit_portfolio':
                return this.handlePortfolioEdit(chatId, userId);
            case 'portfolio_basic':
            case 'portfolio_pro':
            case 'portfolio_creative':
            case 'portfolio_custom':
                return this.startPortfolioCreation(chatId, userId, data.split('_')[1]);
            default:
                return this.telegram.sendMessage(chatId, 'Invalid portfolio action');
        }
    }

    async handlePortfolioEdit(chatId, userId) {
        const userData = JSON.parse(await this.kvStore.get(`user_${userId}`));
        if (!userData.portfolio || !userData.portfolio.name) {
            return this.telegram.sendMessage(chatId, 'No portfolio found to edit.');
        }

        const keyboard = {
            inline_keyboard: [
                [{ text: '✏️ Edit Name', callback_data: 'edit_portfolio_name' }],
                [{ text: '📝 Edit Description', callback_data: 'edit_portfolio_description' }],
                [{ text: '🔧 Edit Skills', callback_data: 'edit_portfolio_skills' }],
                [{ text: '🔙 Back', callback_data: 'back_to_portfolio' }]
            ]
        };

        await this.telegram.sendMessage(chatId, 'Choose what to edit:', { reply_markup: keyboard });
    }
}

export default PortfolioHandler;