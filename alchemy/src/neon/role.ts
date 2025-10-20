import { Secret } from "../secret.ts";
import type { Context } from "../context.ts";
import { Resource } from "../resource.ts";
import { createNeonApi, type NeonApiOptions } from "./api.ts";
import type { NeonBranch } from "./branch.ts";
import type { NeonProject } from "./project.ts";
import {
  createConnectionUri,
  waitForOperations,
  type NeonConnectionUri,
} from "./utils.ts";

export interface NeonRoleProps extends NeonApiOptions {
  /**
   * The project containing the branch.
   * This can be a Project object or an ID string.
   */
  project: string | NeonProject;
  /**
   * The branch to create the role in.
   * This can be a Branch object or an ID string beginning with `br-`.
   */
  branch: string | NeonBranch;
  /**
   * The role name. Cannot exceed 63 bytes in length.
   * @default `${app}-${stage}-${id}`
   */
  name?: string;
  /**
   * Whether to create a role that cannot login.
   * @default false
   */
  noLogin?: boolean;
}

export type NeonRole = Omit<NeonRoleProps, "project" | "branch"> & {
  /**
   * The role name
   */
  name: string;
  /**
   * The ID of the branch to which the role belongs
   */
  branchId: string;
  /**
   * The ID of the project to which the role belongs
   */
  projectId: string;
  /**
   * The role password
   */
  password: Secret<string>;
  /**
   * Whether the role cannot login (no_login flag)
   */
  noLogin: boolean;
  /**
   * A timestamp indicating when the role was created
   */
  createdAt: Date;
  /**
   * A timestamp indicating when the role was last updated
   */
  updatedAt: Date;
  /**
   * The connection URIs for the role.
   * Generated from the branch's endpoints and databases.
   */
  connectionUris: NeonConnectionUri[];
};

/**
 * Creates a Postgres role in a Neon branch.
 *
 * In Neon, the terms "role" and "user" are synonymous. A role is a database user
 * with login credentials that can be used to connect to the database.
 *
 * @example
 * ```ts
 * const role = await NeonRole("app-role", {
 *   project: "project-id",
 *   branch: "branch-id",
 * });
 *
 * console.log(`Password: ${role.password.unencrypted}`);
 * ```
 *
 * @example
 * ```ts
 * const role = await NeonRole("owner", {
 *   project: "project-id",
 *   branch: "branch-id",
 *   noLogin: true,
 * });
 * ```
 *
 * @example
 * ```ts
 * const branch = await NeonBranch("dev", {
 *   project: "project-id",
 *   endpoints: [{ type: "read-write" }],
 * });
 *
 * const role = await NeonRole("app-user", {
 *   project: branch.projectId,
 *   branch: branch,
 * });
 * ```
 */
export const NeonRole = Resource(
  "neon::Role",
  async function (
    this: Context<NeonRole>,
    id: string,
    props: NeonRoleProps,
  ): Promise<NeonRole> {
    const api = createNeonApi(props);
    const name =
      props.name ?? this.output?.name ?? this.scope.createPhysicalName(id);
    const projectId =
      typeof props.project === "string" ? props.project : props.project.id;
    const branchId =
      typeof props.branch === "string" ? props.branch : props.branch.id;

    switch (this.phase) {
      case "delete": {
        if (this.output) {
          const res = await api.deleteProjectBranchRole({
            path: {
              project_id: this.output.projectId,
              branch_id: this.output.branchId,
              role_name: this.output.name,
            },
            throwOnError: false,
          });
          if (res.error && res.response.status !== 404) {
            throw new Error(`Failed to delete role: ${res.error.message}`, {
              cause: res.error,
            });
          }
        }
        return this.destroy();
      }
      case "create": {
        const { data } = await api.createProjectBranchRole({
          path: {
            project_id: projectId,
            branch_id: branchId,
          },
          body: {
            role: {
              name,
              no_login: props.noLogin,
            },
          },
        });

        // Wait for operations to complete
        await waitForOperations(api, data.operations);

        // Fetch the role password
        const passwordRes = await api.getProjectBranchRolePassword({
          path: {
            project_id: projectId,
            branch_id: branchId,
            role_name: data.role.name,
          },
        });

        // Fetch endpoints and databases for the branch to generate connection URIs
        const [endpointsRes, databasesRes] = await Promise.all([
          api.listProjectBranchEndpoints({
            path: {
              project_id: projectId,
              branch_id: branchId,
            },
          }),
          api.listProjectBranchDatabases({
            path: {
              project_id: projectId,
              branch_id: branchId,
            },
          }),
        ]);

        // Generate connection URIs for each endpoint × database combination
        const connectionUris: NeonConnectionUri[] = [];
        const password = passwordRes.data.password;
        for (const endpoint of endpointsRes.data.endpoints) {
          if (endpoint.host) {
            for (const database of databasesRes.data.databases) {
              connectionUris.push(
                createConnectionUri(
                  endpoint.host,
                  database.name,
                  data.role.name,
                  password,
                ),
              );
            }
          }
        }

        return {
          name: data.role.name,
          projectId,
          branchId,
          password: new Secret(password),
          noLogin: props.noLogin ?? false,
          createdAt: new Date(data.role.created_at),
          updatedAt: new Date(data.role.updated_at),
          connectionUris,
        };
      }
      case "update": {
        if (
          this.output.projectId !== projectId ||
          this.output.branchId !== branchId ||
          this.output.name !== name
        ) {
          this.replace();
        }

        // Roles don't have an update endpoint, so return current state
        // The connectionUris are already in this.output from creation
        return this.output;
      }
    }
  },
);
