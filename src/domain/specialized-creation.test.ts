import {
  SPECIALIZED_CREATION_MODES,
  createSpecializedCreationProject,
  validateSpecializedCreationProject,
} from "./specialized-creation";

describe("specialized creation office", () => {
  it("defines exactly the six canonical product modes", () => {
    expect(SPECIALIZED_CREATION_MODES).toEqual([
      "comic-book",
      "greeting-card",
      "birthday-card",
      "invitation",
      "flyer",
      "trading-card-game",
    ]);
  });

  it("creates a durable production-aware project", () => {
    const project = createSpecializedCreationProject({
      id: "special-1",
      projectId: "project-1",
      mode: "comic-book",
      title: "The Test Issue",
      now: "2026-08-30T00:00:00.000Z",
    });
    expect(project.status).toBe("draft");
    expect(project.bleedProfile.dpi).toBe(300);
    validateSpecializedCreationProject(project);
  });

  it("rejects invalid production dimensions", () => {
    const project = createSpecializedCreationProject({
      id: "special-1",
      projectId: "project-1",
      mode: "flyer",
      title: "Test",
    });
    expect(() => validateSpecializedCreationProject({ ...project, bleedProfile: { ...project.bleedProfile, widthInches: 0 } })).toThrow();
  });
});
