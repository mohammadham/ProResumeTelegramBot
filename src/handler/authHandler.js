import Telegram from "./telegramHandler.js";
import KVStore from "./kvHandler.js";
import { hash, compare } from 'bcryptjs';
import { generateToken, showAvailableCommands } from '../utils/helpers';

class AuthHandler {
    constructor(botToken, adminKV,telegram, kvStore, stateManager) {
        this.telegram = telegram;
        this.kvStore = kvStore;
        this.stateManager = stateManager;
        this.botToken = botToken;
        // this.usersKV = usersKV;
        this.adminKV = adminKV;
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

    async checkUserLogin(userId) {
        const userData = await this.kvStore.get(`user_${userId}`);
        return !!userData;
    }

    async attemptLogin(userId, username, password) {
        const userData = await this.kvStore.get(`user_${username}`);
        if (!userData) return false;
        
        const user = JSON.parse(userData);
        const passwordMatch = await compare(password, user.password);
        
        if (passwordMatch) {
            await this.kvStore.put(`user_${userId}`, JSON.stringify({
                ...user,
                lastLogin: new Date().toISOString()
            }));
            return true;
        }
        return false;
    }

    async logout(userId) {
        // await this.usersKV.delete(`user_${userId}`);
        // await setUserState(userId, UserState.NONE);
        await this.kvStore.delete(`user_${userId}`);
        await this.stateManager.setUserState(userId, this.UserState.NONE);
    }

    async handleAuthFlow(message, chatId, userId, text, userState) {
        switch (userState) {
            case this.UserState.AWAITING_LOGIN_USERNAME:
                await this.kvStore.put(`${userId}_temp_username`, text);
                await this.setUserState(userId, this.UserState.AWAITING_LOGIN_PASSWORD);
                return this.telegram.sendMessage(chatId, 'Please enter your password:');

            case this.UserState.AWAITING_LOGIN_PASSWORD:
                const loginUsername = await this.kvStore.get(`${userId}_temp_username`);
                const loginSuccess = await this.attemptLogin(userId, loginUsername, text);
                if (loginSuccess) {
                    await this.setUserState(userId, this.UserState.NONE);
                    await this.kvStore.delete(`${userId}_temp_username`);
                    return showAvailableCommands(chatId, userId);
                }
                await this.setUserState(userId, this.UserState.NONE);
                return showLoginOptions(chatId);

            case this.UserState.AWAITING_REGISTER_USERNAME:
                await this.kvStore.put(`${userId}_temp_username`, text);
                await this.setUserState(userId, this.UserState.AWAITING_REGISTER_PASSWORD);
                return this.telegram.sendMessage(chatId, 'Please enter your desired password:');

            case this.UserState.AWAITING_REGISTER_PASSWORD:
                const regUsername = await this.kvStore.get(`${userId}_temp_username`);
                await this.registerUser(userId, regUsername, text);
                await this.setUserState(userId, this.UserState.NONE);
                await this.kvStore.delete(`${userId}_temp_username`);
                return showAvailableCommands(chatId, userId);

            case this.UserState.AWAITING_PORTFOLIO_NAME:
                const portfolioType = await this.kvStore.get(`${userId}_portfolio_type`);
                await this.updateUserPortfolio(userId, 'type', portfolioType);
                await this.updateUserPortfolio(userId, 'name', text);
                await this.setUserState(userId, this.UserState.AWAITING_PORTFOLIO_DESCRIPTION);
                return this.telegram.sendMessage(chatId, 'Great! Now please enter a description for your portfolio:');

            case this.UserState.AWAITING_PORTFOLIO_DESCRIPTION:
                await this.updateUserPortfolio(userId, 'description', text);
                await this.setUserState(userId, this.UserState.AWAITING_PORTFOLIO_SKILLS);
                return this.telegram.sendMessage(chatId, 'Please enter your skills (comma-separated):');

            case this.UserState.AWAITING_PORTFOLIO_SKILLS:
                await this.updateUserPortfolio(userId, 'skills', text.split(',').map(s => s.trim()));
                await this.setUserState(userId, this.UserState.NONE);
                const portfolioLink = await this.generatePortfolioLink(userId);
                return this.telegram.sendMessage(chatId, `Portfolio created! You can view it here: ${portfolioLink}`);

            case this.UserState.AWAITING_RESUME_PERSONAL:
                const resumeType = await this.kvStore.get(`${userId}_resume_type`);
                await this.updateUserResume(userId, 'type', resumeType);
                await this.updateUserResume(userId, 'personal', text);
                await this.setUserState(userId, this.UserState.AWAITING_RESUME_EDUCATION);
                return this.telegram.sendMessage(chatId, 'Please enter your education history:');

            case this.UserState.AWAITING_RESUME_EDUCATION:
                await this.updateUserResume(userId, 'education', text);
                await this.setUserState(userId, this.UserState.AWAITING_RESUME_EXPERIENCE);
                return this.telegram.sendMessage(chatId, 'Please enter your work experience:');

            case this.UserState.AWAITING_RESUME_EXPERIENCE:
                await this.updateUserResume(userId, 'experience', text);
                await this.setUserState(userId, this.UserState.AWAITING_RESUME_SKILLS);
                return this.telegram.sendMessage(chatId, 'Finally, please enter your skills:');

            case this.UserState.AWAITING_RESUME_SKILLS:
                await this.updateUserResume(userId, 'skills', text.split(',').map(s => s.trim()));
                await this.setUserState(userId, this.UserState.NONE);
                const resumeLink = await this.generateResumeLink(userId);
                return this.telegram.sendMessage(chatId, `Resume created! You can view it here: ${resumeLink}`);
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
        
        await this.telegram.sendMessage(chatId, 'Welcome! Please login or register to continue:', 
            { reply_markup: keyboard });
    }

    async registerUser(userId, username, password) {
        const hashedPassword = await hash(password, 10);
        const data = { username, password: hashedPassword, portfolio: {}, resume: {} };
        // await this.usersKV.put(String(userId), JSON.stringify(data));
        await this.kvStore.put(`user_${userId}`, data);
    }

    async isUserAdmin(userId) {
        const admins = await this.adminKV.get('admin_list');
        return admins ? admins.includes(userId) : false;
    }

    async setUserState(userId, state) {
        await this.stateManager.setUserState(userId, state);
    }

    async updateUserPortfolio(userId, field, value) {
        const userData = JSON.parse(await this.kvStore.get(`user_${userId}`));
        if (!userData.portfolio) userData.portfolio = {};
        userData.portfolio[field] = value;
        await this.kvStore.put(`user_${userId}`, JSON.stringify(userData));
    }

    async updateUserResume(userId, field, value) {
        const userData = JSON.parse(await this.kvStore.get(`user_${userId}`));
        if (!userData.resume) userData.resume = {};
        userData.resume[field] = value;
        await this.kvStore.put(`user_${userId}`, JSON.stringify(userData));
    }

    async generatePortfolioLink(userId) {
        const token = generateToken();
        return `${this.workerUrl}/portfolio/${userId}/${token}`;
    }

    async generateResumeLink(userId) {
        const token = generateToken();
        return `${this.workerUrl}/resume/${userId}/${token}`;
    }

    async handleAuthCallback(chatId, userId, action) {
        switch (action) {
            case 'login':
                await this.setUserState(userId, this.UserState.AWAITING_LOGIN_USERNAME);
                return this.telegram.sendMessage(chatId, 'Please enter your username:');
            case 'register':
                await this.setUserState(userId, this.UserState.AWAITING_REGISTER_USERNAME);
                return this.telegram.sendMessage(chatId, 'Please choose a username:');
            case 'logout':
                await this.logout(userId);
                return this.showLoginOptions(chatId);
            default:
                return this.telegram.sendMessage(chatId, 'Invalid auth action');
        }
    }
}

export default AuthHandler;