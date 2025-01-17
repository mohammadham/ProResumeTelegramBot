class Telegram {
    constructor(BOT_TOKEN) {
        this.BOT_TOKEN = BOT_TOKEN;
    }

    async sendMessage(chatId, text, options = {}) {
        await fetch(`https://api.telegram.org/bot${this.BOT_TOKEN}/sendMessage`, {
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

    async editMessageText(chatId, messageId, text) {
        await fetch(`https://api.telegram.org/bot${this.BOT_TOKEN}/editMessageText`, {
            method: 'POST',
            body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async editMessageCaption(chatId, messageId, caption) {
        await fetch(`https://api.telegram.org/bot${this.BOT_TOKEN}/editMessageCaption`, {
            method: 'POST',
            body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption }),
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async editMessageMedia(chatId, messageId, media) {
        await fetch(`https://api.telegram.org/bot${this.BOT_TOKEN}/editMessageMedia`, {
            method: 'POST',
            body: JSON.stringify({ chat_id: chatId, message_id: messageId, media }),
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export default Telegram;