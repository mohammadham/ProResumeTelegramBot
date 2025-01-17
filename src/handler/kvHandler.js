class KVStore {
    constructor(ADMIN_KV, USERS_KV) {
        this.ADMIN_KV = ADMIN_KV;
        this.USERS_KV = USERS_KV;
    }

    async put(key, value) {
        await this.USERS_KV.put(key, JSON.stringify(value));
    }

    async get(key) {
        const data = await this.USERS_KV.get(key);
        return data ? JSON.parse(data) : null;
    }

    async delete(key) {
        await this.USERS_KV.delete(key);
    }

    // Additional methods for admin data
}