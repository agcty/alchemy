import "../../src/test/vitest.ts";

import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { createNeonApi } from "../../src/neon/api.ts";
import { NeonBranch } from "../../src/neon/branch.ts";
import { NeonProject } from "../../src/neon/project.ts";
import { NeonRole } from "../../src/neon/role.ts";
import { BRANCH_PREFIX } from "../util.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

describe("NeonRole Resource", () => {
  const api = createNeonApi();

  test("create and delete neon role", async (scope) => {
    let project: NeonProject | undefined;
    let branch: NeonBranch | undefined;
    let role: NeonRole | undefined;

    try {
      // Create project and branch for testing
      project = await NeonProject("project", {});
      branch = await NeonBranch("branch", {
        project,
        endpoints: [{ type: "read_write" }],
      });

      // Create role
      role = await NeonRole("role", {
        project: project.id,
        branch: branch.id,
      });

      expect(role).toMatchObject({
        name: expect.any(String),
        projectId: project.id,
        branchId: branch.id,
        password: expect.any(Object),
        noLogin: false,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(role.password.unencrypted).toBeDefined();
      expect(typeof role.password.unencrypted).toBe("string");

      // Update should return the same state
      const updatedRole = await NeonRole("role", {
        project: project.id,
        branch: branch.id,
      });
      expect(updatedRole.name).toBe(role.name);
    } finally {
      await destroy(scope);

      // Verify role was deleted
      if (role && project && branch) {
        const { response } = await api.getProjectBranchRole({
          path: {
            project_id: project.id,
            branch_id: branch.id,
            role_name: role.name,
          },
          throwOnError: false,
        });
        expect(response.status).toEqual(404);
      }
    }
  });

  test("create no-login role", async (scope) => {
    let project: NeonProject | undefined;
    let branch: NeonBranch | undefined;
    let role: NeonRole | undefined;

    try {
      // Create project and branch for testing
      project = await NeonProject("project", {});
      branch = await NeonBranch("branch", {
        project,
        endpoints: [{ type: "read_write" }],
      });

      // Create no-login role
      role = await NeonRole("no-login-role", {
        project: project.id,
        branch: branch.id,
        noLogin: true,
      });

      expect(role).toMatchObject({
        name: expect.any(String),
        projectId: project.id,
        branchId: branch.id,
        noLogin: true,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    } finally {
      await destroy(scope);
    }
  });

  test("role with custom name", async (scope) => {
    let project: NeonProject | undefined;
    let branch: NeonBranch | undefined;
    let role: NeonRole | undefined;

    try {
      // Create project and branch for testing
      project = await NeonProject("project", {});
      branch = await NeonBranch("branch", {
        project,
        endpoints: [{ type: "read_write" }],
      });

      const customName = `${BRANCH_PREFIX}-custom-role`;

      // Create role with custom name
      role = await NeonRole("custom", {
        project: project.id,
        branch: branch.id,
        name: customName,
      });

      expect(role.name).toBe(customName);
    } finally {
      await destroy(scope);
    }
  });

  test("role with branch resource", async (scope) => {
    let project: NeonProject | undefined;
    let branch: NeonBranch | undefined;
    let role: NeonRole | undefined;

    try {
      // Create project and branch
      project = await NeonProject("project", {});
      branch = await NeonBranch("branch", {
        project,
        endpoints: [{ type: "read_write" }],
      });

      // Create role using branch resource
      role = await NeonRole("role", {
        project: project,
        branch: branch,
      });

      expect(role).toMatchObject({
        projectId: project.id,
        branchId: branch.id,
      });
    } finally {
      await destroy(scope);
    }
  });
});
