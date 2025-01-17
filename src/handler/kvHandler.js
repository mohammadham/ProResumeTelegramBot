class KVStore {
    constructor(namespace) {
        this.namespace = namespace;
    }

    async get(key) {
        return await this.namespace.get(key);
    }

    async put(key, value) {
        if (typeof value === 'object') {
            value = JSON.stringify(value);
        }
        await this.namespace.put(key, value);
    }

    async delete(key) {
        await this.namespace.delete(key);
    }

    async list(prefix) {
        const list = await this.namespace.list({ prefix });
        return list.keys;
    }
}

export default KVStore;