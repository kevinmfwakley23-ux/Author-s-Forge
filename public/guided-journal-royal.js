(() => {
  "use strict";
  document.documentElement.dataset.forgeCoreOffice = "guided-journal";
  document.body?.setAttribute("data-forge-core-office", "guided-journal");

  const projectId = new URLSearchParams(location.search).get("project")?.trim();
  const studioLink = document.getElementById("main-studio-link");
  if (studioLink) studioLink.href = projectId ? `/?project=${encodeURIComponent(projectId)}` : "/";

  const coverLink = document.getElementById("cover-studio-link");
  if (coverLink && projectId) coverLink.href = `/?project=${encodeURIComponent(projectId)}#cover`;
})();
