import { Secret } from "../secret.ts";
import { poll } from "../util/poll.ts";
import type { NeonClient } from "./api/sdk.gen.ts";
import type * as neon from "./api/types.gen.ts";

export interface NeonConnectionUri {
  /**
   * Connection URI string
   */
  connection_uri: Secret;

  /**
   * Connection parameters
   */
  connection_parameters: {
    database: string;
    host: string;
    port: number;
    user: string;
    password: Secret;
  };
}

export function formatConnectionUri(
  details: neon.ConnectionDetails,
): NeonConnectionUri {
  return {
    connection_uri: new Secret(details.connection_uri),
    connection_parameters: {
      database: details.connection_parameters.database,
      host: details.connection_parameters.host,
      port: 5432,
      user: details.connection_parameters.role,
      password: new Secret(details.connection_parameters.password),
    },
  };
}

export interface NeonRoleData {
  /**
   * The ID of the branch to which the role belongs
   */
  branch_id: string;
  /**
   * The role name
   */
  name: string;
  /**
   * The role password
   */
  password?: Secret;
  /**
   * Whether or not the role is system-protected
   */
  protected?: boolean;
  /**
   * A timestamp indicating when the role was created
   */
  created_at: string;
  /**
   * A timestamp indicating when the role was last updated
   */
  updated_at: string;
}

export function formatRole(role: neon.Role): NeonRoleData {
  return {
    ...role,
    password: role.password ? new Secret(role.password) : undefined,
  };
}

/**
 * Creates a connection URI from individual components.
 * Used when constructing connection URIs for a specific role.
 */
export function createConnectionUri(
  host: string,
  database: string,
  roleName: string,
  password: string,
): NeonConnectionUri {
  const connectionString = `postgresql://${roleName}:${password}@${host}/${database}?sslmode=require`;
  return {
    connection_uri: new Secret(connectionString),
    connection_parameters: {
      database,
      host,
      port: 5432,
      user: roleName,
      password: new Secret(password),
    },
  };
}

export async function waitForOperations(
  api: NeonClient,
  operations: neon.Operation[],
) {
  for (const operation of operations) {
    if (isOperationComplete(operation)) {
      continue;
    }
    await poll({
      description: `operation "${operation.id}"`,
      fn: () =>
        api.getProjectOperation({
          path: {
            project_id: operation.project_id,
            operation_id: operation.id,
          },
        }),
      predicate: ({ data }) => {
        if (["error", "failed"].includes(data.operation.status)) {
          throw new Error(
            `Operation ${operation.id} (${operation.action}) failed: ${data.operation.error}`,
          );
        }
        return isOperationComplete(data.operation);
      },
    });
  }
}

const isOperationComplete = (operation: neon.Operation): boolean =>
  ["finished", "failed", "error", "cancelled", "skipped"].includes(
    operation.status,
  );
