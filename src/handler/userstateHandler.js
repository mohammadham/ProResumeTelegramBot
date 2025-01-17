class StateManager {
    // Add new state management
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
    constructor(kvStore) {
        this.kvStore = kvStore;
    }

    async setUserState(userId, state) {
        await this.kvStore.put(`${userId}_state`, state);
    }

    async getUserState(userId) {
        return (await this.kvStore.get(`${userId}_state`)) || this.UserState.NONE;
    }
}