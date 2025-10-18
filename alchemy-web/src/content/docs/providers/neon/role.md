---
title: NeonRole
description: Learn how to create and manage Postgres database roles (users) in Neon branches using Alchemy.
---

The NeonRole resource lets you create and manage Postgres roles (database users) within a [Neon serverless PostgreSQL](https://neon.tech) branch. In Neon, the terms "role" and "user" are synonymous - a role is a database user with login credentials.

## Minimal Example

Create a basic database role in a branch:

```ts
import { NeonProject, NeonBranch, NeonRole } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const branch = await NeonBranch("main", {
  project,
  endpoints: [{ type: "read_write" }],
});

const role = await NeonRole("app-user", {
  project,
  branch,
});

console.log("Username:", role.name);
console.log("Password:", role.password.unencrypted);
```

## Using Role with External IDs

Create a role using project and branch IDs instead of resources:

```ts
import { NeonRole } from "alchemy/neon";

const role = await NeonRole("api-user", {
  project: "sunny-meadow-12345678",
  branch: "br-aged-wind-87654321",
});

console.log("Connection ready for:", role.name);
```

## No-Login Role

Create a role that cannot be used for login (useful for ownership and permissions):

```ts
import { NeonProject, NeonBranch, NeonRole } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const branch = await NeonBranch("main", {
  project,
  endpoints: [{ type: "read_write" }],
});

const owner = await NeonRole("owner", {
  project,
  branch,
  noLogin: true, // Cannot be used for login
});

console.log("Owner role created:", owner.name);
```

## Custom Role Name

Create a role with a specific name:

```ts
import { NeonProject, NeonBranch, NeonRole } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const branch = await NeonBranch("main", {
  project,
  endpoints: [{ type: "read_write" }],
});

const role = await NeonRole("app", {
  project,
  branch,
  name: "myapp_user",
});

console.log("Role name:", role.name); // "myapp_user"
```

## Multiple Roles for Different Services

Create different roles for different parts of your application:

```ts
import { NeonProject, NeonBranch, NeonRole } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const branch = await NeonBranch("prod", {
  project,
  endpoints: [{ type: "read_write" }],
});

// API service role
const apiRole = await NeonRole("api", {
  project,
  branch,
  name: "api_service",
});

// Worker service role
const workerRole = await NeonRole("worker", {
  project,
  branch,
  name: "worker_service",
});

// Read-only analytics role
const analyticsRole = await NeonRole("analytics", {
  project,
  branch,
  name: "analytics_readonly",
});

console.log("API credentials:", apiRole.password.unencrypted);
console.log("Worker credentials:", workerRole.password.unencrypted);
console.log("Analytics credentials:", analyticsRole.password.unencrypted);
```

## Using with Connection String

Access the role password securely for connection strings:

```ts
import { NeonProject, NeonBranch, NeonRole } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const branch = await NeonBranch("main", {
  project,
  endpoints: [{ type: "read_write" }],
});

const role = await NeonRole("app", {
  project,
  branch,
});

// Password is encrypted in state but accessible at runtime
const connectionString = `postgresql://${role.name}:${role.password.unencrypted}@${branch.endpoints[0].host}:5432/neondb`;

console.log("Connection string:", connectionString);
```

## Encrypting Role Password

Store the password securely using alchemy.secret:

```ts
import { NeonProject, NeonBranch, NeonRole } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const branch = await NeonBranch("main", {
  project,
  endpoints: [{ type: "read_write" }],
});

const role = await NeonRole("app", {
  project,
  branch,
});

// The password is automatically wrapped in a Secret and encrypted in state
console.log("Password (encrypted in state):", role.password);
console.log("Password (decrypted at runtime):", role.password.unencrypted);
```

## Resource Properties

### Input Properties (NeonRoleProps)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `project` | `string \| NeonProject` | Yes | The project containing the branch |
| `branch` | `string \| NeonBranch` | Yes | The branch to create the role in |
| `name` | `string` | No | Role name (max 63 bytes, default: `${app}-${stage}-${id}`) |
| `noLogin` | `boolean` | No | Whether to create a role that cannot login (default: `false`) |
| `apiKey` | `Secret` | No | Neon API key (overrides `NEON_API_KEY` env var) |

### Output Properties (NeonRole)

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | The role name |
| `projectId` | `string` | The project ID |
| `branchId` | `string` | The branch ID this role belongs to |
| `branch` | `string \| NeonBranch` | The branch reference from input |
| `password` | `Secret` | The role password (encrypted in state) |
| `noLogin` | `boolean` | Whether the role cannot login |
| `createdAt` | `Date` | When the role was created |
| `updatedAt` | `Date` | When the role was last updated |

## Important Notes

### Secret Encryption

Role passwords are automatically wrapped in Alchemy's `Secret` type and encrypted when stored in state files. To access the password at runtime:

```ts
const role = await NeonRole("app", {
  project: "project-id",
  branch: "branch-id",
});

// Encrypted in state, decrypted at runtime
const plainPassword = role.password.unencrypted;
```

### Immutable Properties

These properties cannot be changed after creation (they trigger replacement):
- `project` / `projectId`
- `branch` / `branchId`
- `name`
- `noLogin`

Roles do not have an update endpoint in the Neon API, so attempting to update a role will either keep the existing state or trigger a replacement.

### Role Names

Role names:
- Cannot exceed 63 bytes in length
- Must be unique within the branch
- Cannot be changed after creation

### No-Login Roles

No-login roles (`noLogin: true`) cannot be used to log into the database. They are useful for:
- Ownership of database objects
- Role hierarchies and permission inheritance
- System roles that shouldn't have direct login access

### Using Branch References

You can pass either a Branch resource or a branch ID string:

```ts
// Using Branch resource (recommended)
const branch = await NeonBranch("main", { project, endpoints: [...] });
const role = await NeonRole("app", {
  project,
  branch, // Pass the resource
});

// Using branch ID string
const role = await NeonRole("app", {
  project: "sunny-meadow-12345678",
  branch: "br-aged-wind-87654321", // Pass the ID
});
```

### Default Role

Every branch automatically gets a default role with the same name as the database. You don't need to create an additional role unless you want multiple users or specific permissions.

## Related Resources

- [NeonProject](./index) - Create a Neon serverless PostgreSQL project
- [NeonBranch](./branch) - Create and manage database branches
- [Neon Roles Documentation](https://neon.tech/docs/manage/roles) - Learn more about managing roles
