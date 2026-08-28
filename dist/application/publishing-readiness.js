"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublishingReadinessService = void 0;
const publishing_readiness_1 = require("../domain/publishing-readiness");
class PublishingReadinessService {
    store;
    constructor(store) {
        this.store = store;
    }
    audit(input) { const report = (0, publishing_readiness_1.createPublishingReadinessReport)(input); if (this.store)
        this.store.save(report); return report; }
    get(id) { return this.store?.get(id); }
    list(projectId) { return this.store?.list(projectId) ?? []; }
    validate(report) { return (0, publishing_readiness_1.validatePublishingReadinessReport)(report); }
}
exports.PublishingReadinessService = PublishingReadinessService;
//# sourceMappingURL=publishing-readiness.js.map