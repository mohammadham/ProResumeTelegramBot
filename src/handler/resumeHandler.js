import Telegram from './telegramHandler.js';
import KVStore from './kvHandler.js';
import { generateToken } from '../utils/helpers';

class ResumeHandler {
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
    async handleViewResumes(chatId, userId) {
        const userData = JSON.parse(await this.kvStore.get(`user_${userId}`));
        if (!userData.resume || !userData.resume.personal) {
            return this.telegram.sendMessage(chatId, 'You haven\'t created any resumes yet.');
        }
        const resumeLink = await this.generateResumeLink(userId);
        return this.telegram.sendMessage(chatId, `Your resume\nLink: ${resumeLink}`);
    }

    async generateResumeLink(userId) {
        const token = this.generateToken();
        return `${this.workerUrl}/resume/${userId}/${token}`;
    }

    async updateUserResume(userId, field, value) {
        const userData = JSON.parse(await this.kvStore.get(`user_${userId}`));
        if (!userData.resume) userData.resume = {};
        userData.resume[field] = value;
        await this.kvStore.put(`user_${userId}`, JSON.stringify(userData));
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
    
        await this.telegram.sendMessage(chatId, 'Resume Management:', { reply_markup: keyboard });
    }

    async startResumeCreation(chatId, userId, type) {
        await this.kvStore.put(`${userId}_resume_type`, type);
        await this.setUserState(userId, this.UserState.AWAITING_RESUME_PERSONAL);
        
        const message = `Let's create your ${type} resume!\n\n` +
            `Please enter your personal information in this format:\n` +
            `Name\nEmail\nPhone\nLocation`;
        
        await this.telegram.sendMessage(chatId, message);
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
    
        await this.telegram.sendMessage(chatId, message, { reply_markup: keyboard });
    }

    async handleResumeCallback(chatId, userId, data) {
        switch (data) {
            case 'create_resume':
                return this.handleResumeCreationFlow(chatId, userId);
            case 'view_resumes':
                return this.handleViewResumes(chatId, userId);
            case 'edit_resume':
                return this.handleResumeEdit(chatId, userId);
            case 'resume_standard':
            case 'resume_targeted':
            case 'resume_modern':
            case 'resume_custom':
                return this.startResumeCreation(chatId, userId, data.split('_')[1]);
            default:
                return this.telegram.sendMessage(chatId, 'Invalid resume action');
        }
    }

    async setUserState(userId, state) {
        await this.kvStore.put(`${userId}_state`, state);
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
}

export default ResumeHandler;