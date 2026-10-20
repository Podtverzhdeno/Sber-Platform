import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "Sber-Platform";
export default defineRailway(() => {
  const SberPlatform = service("Sber-Platform", {
    source: github("Podtverzhdeno/Sber-Platform", { branch: "main", checkSuites: false }),
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/health/ready",
    healthcheckTimeout: 300,
    preDeploy: "alembic upgrade head && impulse-demo-seed",
    replicas: { "iad": 1 },
    networking: { privateNetworkEndpoint: "sber-platform" },
  });

  return project("optimistic-energy", {
    variables: { managed: false },
    resources: [SberPlatform],
  });
});
