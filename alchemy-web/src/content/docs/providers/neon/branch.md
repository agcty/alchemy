---
title: NeonBranch
description: Learn how to create and manage Neon database branches for instant development environments and preview deployments using Alchemy.
---

The NeonBranch resource lets you create and manage database branches within a [Neon serverless PostgreSQL](https://neon.tech) project. Branches are instant, copy-on-write clones of your database that enable Git-like workflows for your data.

## Minimal Example

Create a basic development branch with a read-write endpoint:

```ts
import { NeonProject, NeonBranch } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const dev = await NeonBranch("dev", {
  project,
  endpoints: [{ type: "read_write" }],
});

console.log("Connection URI:", dev.connectionUris[0].connection_uri);
```

## Multiple Endpoints

Create a branch with both read-write and read-only endpoints:

```ts
import { NeonProject, NeonBranch } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const prod = await NeonBranch("prod", {
  project,
  name: "production",
  protected: true, // Prevent accidental deletion
  endpoints: [
    { type: "read_write" },
    { type: "read_only" },
  ],
});

// Read-write connection for application
console.log("Write endpoint:", prod.endpoints[0].host);

// Read-only connection for analytics
console.log("Read endpoint:", prod.endpoints[1].host);
```

## Feature Branch from Parent

Create a feature branch based on another branch:

```ts
import { NeonProject, NeonBranch } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const main = await NeonBranch("main", {
  project,
  endpoints: [{ type: "read_write" }],
});

const feature = await NeonBranch("feature", {
  project,
  name: "feature-new-schema",
  parentBranch: main,
  endpoints: [{ type: "read_write" }],
});
```

## Point-in-Time Branch

Create a branch from a specific point in time on the parent:

```ts
import { NeonProject, NeonBranch } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const restore = await NeonBranch("restore", {
  project,
  name: "restore-before-incident",
  parentTimestamp: "2024-10-17T12:00:00Z",
  endpoints: [{ type: "read_write" }],
});
```

## Schema-Only Branch

Create a branch with only the schema (no data):

```ts
import { NeonProject, NeonBranch } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const schema = await NeonBranch("schema", {
  project,
  name: "schema-only",
  initSource: "schema-only",
  endpoints: [{ type: "read_write" }],
});
```

## Temporary Preview Branch

Create a branch that automatically expires:

```ts
import { NeonProject, NeonBranch } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

// Expires in 7 days
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const preview = await NeonBranch("preview", {
  project,
  name: "preview-pr-123",
  expiresAt: expiresAt.toISOString(),
  endpoints: [{ type: "read_write" }],
});
```

## Using Connection Parameters

Access individual connection parameters for manual connection setup:

```ts
import { NeonProject, NeonBranch } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const branch = await NeonBranch("app", {
  project,
  endpoints: [{ type: "read_write" }],
});

const conn = branch.connectionUris[0].connection_parameters;

console.log(`Host: ${conn.host}`);
console.log(`Port: ${conn.port}`);
console.log(`Database: ${conn.database}`);
console.log(`User: ${conn.user}`);
// Password is encrypted in alchemy state
```

## Integration with External Branch

Reference an existing branch by its ID:

```ts
import { NeonProject, NeonBranch } from "alchemy/neon";

const project = await NeonProject("db", {
  name: "My Database",
});

const feature = await NeonBranch("feature", {
  project,
  parentBranch: "br-aged-wind-12345678", // Existing branch ID
  endpoints: [{ type: "read_write" }],
});
```

## Resource Properties

### Input Properties (NeonBranchProps)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `project` | `string \| NeonProject` | Yes | The project to create the branch in |
| `endpoints` | `BranchCreateRequestEndpointOptions[]` | Yes | Endpoints to create for the branch |
| `name` | `string` | No | Branch name (default: `${app}-${stage}-${id}`) |
| `protected` | `boolean` | No | Protect against accidental deletion (default: `false`) |
| `parentBranch` | `string \| NeonBranch \| Branch` | No | Parent branch to branch from (default: project's default branch) |
| `parentLsn` | `string` | No | Log Sequence Number on parent branch to branch from |
| `parentTimestamp` | `string` | No | ISO 8601 timestamp on parent branch to branch from |
| `initSource` | `"schema-only" \| "parent-data"` | No | Initialize with schema only or full data (default: `"parent-data"`) |
| `expiresAt` | `string` | No | When the branch should auto-delete (RFC 3339 format) |
| `apiKey` | `Secret` | No | Neon API key (overrides `NEON_API_KEY` env var) |

### Output Properties (NeonBranch)

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Branch ID (e.g., `br-small-term-683261`) |
| `name` | `string` | Branch name |
| `projectId` | `string` | Project ID this branch belongs to |
| `parentBranchId` | `string \| undefined` | ID of the parent branch |
| `parentLsn` | `string \| undefined` | LSN the branch was created from |
| `parentTimestamp` | `string \| undefined` | Timestamp the branch was created from |
| `initSource` | `"schema-only" \| "parent-data" \| undefined` | How the branch was initialized |
| `protected` | `boolean` | Whether the branch is protected |
| `default` | `boolean` | Whether this is the project's default branch |
| `createdAt` | `Date` | When the branch was created |
| `updatedAt` | `Date` | When the branch was last updated |
| `expiresAt` | `Date \| undefined` | When the branch will auto-delete |
| `endpoints` | `Endpoint[]` | Compute endpoints for the branch |
| `databases` | `Database[]` | Databases on the branch |
| `roles` | `NeonRole[]` | Database roles (passwords are encrypted) |
| `connectionUris` | `NeonConnectionUri[]` | Connection URIs (passwords are encrypted) |

## Important Notes

### Endpoints Required

You must configure at least one endpoint when creating a branch, otherwise you won't be able to connect to it:

```ts
// ✅ Correct
const branch = await NeonBranch("app", {
  project,
  endpoints: [{ type: "read_write" }],
});

// ❌ Will fail - no endpoints
const branch = await NeonBranch("app", {
  project,
  endpoints: [],
});
```

### Secret Encryption

All sensitive data (passwords, connection strings) is automatically encrypted when stored in Alchemy state files using the `Secret` type.

### Immutable Properties

These properties cannot be changed after creation (they trigger replacement):
- `project` / `projectId`
- `parentBranch` / `parentBranchId`
- `parentLsn`
- `parentTimestamp`
- `initSource`

### Branch Workflows

Branches are perfect for:
- **Development**: Create a dev branch for local development
- **Feature branches**: Mirror your Git workflow with database branches
- **Preview deployments**: Automatically create and destroy branches for PRs
- **Testing**: Create isolated test environments
- **Migrations**: Test schema changes before applying to production
- **Point-in-time restore**: Recover from accidents

## Related Resources

- [NeonProject](./project) - Create a Neon serverless PostgreSQL project
- [Neon Branching Guide](https://neon.tech/docs/guides/branching) - Learn more about database branching
