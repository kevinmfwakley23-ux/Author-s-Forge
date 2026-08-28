"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectPackageService = void 0;
const project_package_1 = require("../domain/project-package");
class ProjectPackageService {
    export(input) { return (0, project_package_1.createProjectPackage)(input); }
    serialize(pkg) { return (0, project_package_1.serializeProjectPackage)(pkg); }
    import(serialized) { return (0, project_package_1.deserializeProjectPackage)(serialized); }
    validate(pkg) { return (0, project_package_1.validateProjectPackage)(pkg); }
}
exports.ProjectPackageService = ProjectPackageService;
//# sourceMappingURL=project-package.js.map