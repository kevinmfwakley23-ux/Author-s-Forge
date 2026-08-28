"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectHealthService = void 0;
const project_health_1 = require("../domain/project-health");
class ProjectHealthService {
    report(projectId, metrics, generatedAt) { return (0, project_health_1.createProjectHealthReport)({ projectId, metrics, generatedAt }); }
}
exports.ProjectHealthService = ProjectHealthService;
//# sourceMappingURL=project-health.js.map