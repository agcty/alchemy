---
title: Neon
description: Learn how to manage Neon serverless PostgreSQL projects and database branches using Alchemy.
---

Neon is a serverless PostgreSQL database platform that separates compute and storage, enabling instant scaling, database branching, and point-in-time restore capabilities. Alchemy provides resources to manage Neon projects and branches programmatically.

[Official Neon Documentation](https://neon.tech/docs) | [Neon API Reference](https://api-docs.neon.tech/)

## Resources

- [Project](/providers/neon/project) - Create and manage Neon serverless PostgreSQL projects with multiple regions and PostgreSQL versions
- [Branch](/providers/neon/branch) - Create and manage database branches for development, testing, and preview environments
- [Role](/providers/neon/role) - Create and manage Postgres database roles (users) with encrypted passwords

## Authentication

Neon authentication uses API keys that can be generated in the [Neon Console](https://console.neon.tech/app/settings/api-keys).

### Using Environment Variables

The recommended approach is to use the `NEON_API_KEY` environment variable:

```bash
export NEON_API_KEY="your-api-key-here"
```

Alchemy will automatically use this environment variable for all Neon resources.

### Using Encrypted Secrets

For better security, use Alchemy's secret encryption:

```ts
import { alchemy } from "alchemy";
import { NeonProject } from "alchemy/neon";

const app = await alchemy("my-app");

const project = await NeonProject("db", {
  name: "My Database",
  apiKey: alchemy.secret.env.NEON_API_KEY, // Encrypted in state
});

await app.finalize();
```

### Overriding Per Resource

You can override authentication for individual resources to support multiple Neon accounts:

```ts
const project1 = await NeonProject("db1", {
  name: "Project 1",
  apiKey: alchemy.secret.env.NEON_API_KEY_ACCOUNT_1,
});

const project2 = await NeonProject("db2", {
  name: "Project 2",
  apiKey: alchemy.secret.env.NEON_API_KEY_ACCOUNT_2,
});
```

## Example Usage

### Basic Project and Branch

```ts
import { alchemy } from "alchemy";
import { NeonProject, NeonBranch } from "alchemy/neon";

const app = await alchemy("my-app");

// Create a Neon project
const project = await NeonProject("db", {
  name: "My Database",
  region_id: "aws-us-east-1",
  pg_version: 16,
});

// Create a development branch
const dev = await NeonBranch("dev", {
  project,
  name: "development",
  endpoints: [
    { type: "read_write" }
  ],
});

console.log("Connection URI:", dev.connectionUris[0].connection_uri);

await app.finalize();
```

### Git-Style Database Workflow

```ts
import { alchemy } from "alchemy";
import { NeonProject, NeonBranch } from "alchemy/neon";

const app = await alchemy("my-app");

// Create project
const project = await NeonProject("db", {
  name: "My App Database",
});

// Main production branch (created automatically with project)
const mainBranchId = project.branch.id;

// Development branch from main
const dev = await NeonBranch("dev", {
  project,
  name: "development",
  parentBranch: mainBranchId,
  endpoints: [
    { type: "read_write" }
  ],
});

// Feature branch from dev
const feature = await NeonBranch("feature", {
  project,
  name: "feature-new-auth",
  parentBranch: dev,
  endpoints: [
    { type: "read_write" }
  ],
});

console.log("Feature branch connection:", feature.connectionUris[0].connection_uri);

await app.finalize();
```

### Preview Deployments

```ts
import { alchemy } from "alchemy";
import { NeonProject, NeonBranch } from "alchemy/neon";

const app = await alchemy("my-app");

const project = await NeonProject("db", {
  name: "My App Database",
});

// Get PR number from environment (e.g., GitHub Actions)
const prNumber = process.env.PR_NUMBER;

// Create temporary preview branch that expires in 7 days
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const preview = await NeonBranch(`preview-${prNumber}`, {
  project,
  name: `preview-pr-${prNumber}`,
  parentBranch: project.branch.id,
  expiresAt: expiresAt.toISOString(),
  endpoints: [
    { type: "read_write" }
  ],
});

console.log(`Preview environment for PR #${prNumber}:`, preview.connectionUris[0].connection_uri);

await app.finalize();
```

### Production with Read Replicas

```ts
import { alchemy } from "alchemy";
import { NeonProject, NeonBranch } from "alchemy/neon";

const app = await alchemy("my-app");

const project = await NeonProject("prod-db", {
  name: "Production Database",
  region_id: "aws-us-east-1",
  pg_version: 16,
  history_retention_seconds: 604800, // 7 days
});

// Production branch with read-write and read-only endpoints
const prod = await NeonBranch("prod", {
  project,
  name: "production",
  protected: true, // Prevent accidental deletion
  endpoints: [
    { type: "read_write" },  // For application writes
    { type: "read_only" },   // For analytics/reporting
  ],
});

console.log("Application (read-write):", prod.connectionUris[0].connection_uri);
console.log("Analytics (read-only):", prod.connectionUris[1].connection_uri);

await app.finalize();
```

### Point-in-Time Recovery

```ts
import { alchemy } from "alchemy";
import { NeonProject, NeonBranch } from "alchemy/neon";

const app = await alchemy("my-app");

const project = await NeonProject("db", {
  name: "My Database",
});

// Create a branch from 2 hours ago to recover from an incident
const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

const recovery = await NeonBranch("recovery", {
  project,
  name: "recovery-branch",
  parentTimestamp: twoHoursAgo.toISOString(),
  endpoints: [
    { type: "read_write" }
  ],
});

console.log("Recovery branch:", recovery.connectionUris[0].connection_uri);

await app.finalize();
```

## Key Features

### Instant Database Branching

Create isolated database copies in seconds without duplicating storage. Perfect for:
- Development and testing environments
- Feature branches that mirror your Git workflow
- Preview deployments for pull requests
- Safe schema migration testing

### Point-in-Time Restore

Branch from any point in your database's history (within retention period):
- Recover from accidental data changes
- Test with production data at specific timestamps
- Debug issues by recreating the exact database state

### Automatic Secret Encryption

All sensitive data is automatically encrypted in Alchemy state files:
- Database passwords
- Connection strings
- API keys

### Multiple PostgreSQL Versions

Support for PostgreSQL 14, 15, 16, 17, and 18 with easy version selection.

### Global Region Support

Deploy your database close to your users with regions in:
- AWS (US, EU, APAC, South America)
- Azure (US, Europe)

## Common Patterns

### Branch Per Environment

```ts
const envs = ["dev", "staging", "prod"];

for (const env of envs) {
  await NeonBranch(env, {
    project,
    name: env,
    protected: env === "prod",
    endpoints: [{ type: "read_write" }],
  });
}
```

### Schema-Only Test Branch

```ts
const test = await NeonBranch("test", {
  project,
  name: "test-schema-only",
  initSource: "schema-only", // No data, just schema
  endpoints: [{ type: "read_write" }],
});
```

### Temporary CI Branch

```ts
const ci = await NeonBranch("ci", {
  project,
  name: "ci-test-branch",
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
  endpoints: [{ type: "read_write" }],
});
```

## Best Practices

1. **Use Secret Encryption**: Always use `alchemy.secret.env.X` for API keys
2. **Protect Production**: Set `protected: true` on production branches
3. **Set Expiration**: Use `expiresAt` for temporary preview/test branches
4. **Name Branches Clearly**: Use descriptive names that match your workflow
5. **Use Read Replicas**: Create read-only endpoints for analytics/reporting
6. **Leverage History Retention**: Configure appropriate retention for point-in-time recovery

## Migration from Other Platforms

Neon branches make it easy to adopt a database-per-environment workflow without the cost and complexity of managing multiple database servers. If you're migrating from platforms like Heroku, AWS RDS, or other PostgreSQL providers, Neon branches provide instant environment isolation at a fraction of the cost.
