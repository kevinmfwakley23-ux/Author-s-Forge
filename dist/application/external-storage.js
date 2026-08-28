"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalStorageService = void 0;
const external_storage_1 = require("../domain/external-storage");
class ExternalStorageService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    getProviderId() { return this.provider.id; }
    bind(binding) { if (binding.providerId !== this.provider.id)
        throw new Error("Storage binding provider does not match the configured provider."); return (0, external_storage_1.validateProjectStorageBinding)(binding); }
    async put(binding, key, content, mediaType) { this.bind(binding); return this.provider.put(`${binding.keyPrefix}/${key.replace(/^\/+/, "")}`, content, mediaType); }
    async get(binding, key) { this.bind(binding); return this.provider.get(`${binding.keyPrefix}/${key.replace(/^\/+/, "")}`); }
    async list(binding, prefix = "") { this.bind(binding); return this.provider.list(`${binding.keyPrefix}/${prefix.replace(/^\/+/, "")}`); }
}
exports.ExternalStorageService = ExternalStorageService;
//# sourceMappingURL=external-storage.js.map