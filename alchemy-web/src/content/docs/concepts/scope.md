---
title: Scope
description: Learn how Alchemy uses hierarchical scopes to organize and manage infrastructure resources. 
sidebar:
  order: 0.4
---

Scopes in Alchemy are hierarchical containers that organize resources and other scopes, similar to a file system.

```typescript
// Scope hierarchy
app (Application Scope)
├── dev (Stage Scope)
│   ├── api (Nested Scope)
│   └── database (Resource)
└── prod (Stage Scope)
```

## Application Scope

The top-level scope created using the `alchemy()` function:

```typescript
import alchemy from "alchemy";

// Create root scope
const app = await alchemy("my-app");

// Create a resource in this scope
const file = await File("config", { path: "./config.json", content: "{}" });
```

State directory structure:

```
.alchemy/
  my-app/  # Application scope
    $USER/ # Default stage (username)
      config.json
```

## Stage Scope

A scope directly under the application scope for separating environments:

```typescript
// Create app with explicit stage
const app = await alchemy("my-app", {
  stage: "prod"
});

// Resource in prod stage
const database = await Database("main", { /* props */ });
```

```
.alchemy/
  my-app/
    prod/  ## Stage scope
      main.json
```

### Understanding `local` vs `stage`

Alchemy separates two independent concepts that are often confused:

- **`local`**: Whether resources run locally (on your machine) or remotely (in production/cloud)
- **`stage`**: A label for different environments (dev, staging, prod, e2e, pr-123, etc.)

These properties are **completely independent** - you can be in local mode with any stage name.

:::caution[Avoid Using Environment Variables for Stages]
Don't use environment variables like `E2E_MODE=true` to mimic stages. This bypasses Alchemy's state isolation and can cause resource conflicts. Instead, use the built-in `--stage` flag:

```bash
# ❌ Don't do this
E2E_MODE=true bun alchemy dev

# ✅ Do this instead
bun alchemy dev --stage e2e
```

:::

#### CLI Usage

You can run local development with either `bun alchemy dev` (the common command) or `bun alchemy.run.ts --dev` (explicit). Below examples use the short `dev` form:

```bash
# Local development (default stage uses your username)
bun alchemy dev
# → app.local = true, app.stage = "dev" (or $USER)

# Local E2E testing
bun alchemy dev --stage e2e
# → app.local = true, app.stage = "e2e"

# Local staging environment
bun alchemy dev --stage staging
# → app.local = true, app.stage = "staging"

# Production deployment (no 'dev' or --dev flag)
bun alchemy.run.ts --stage prod
# → app.local = false, app.stage = "prod"
```

#### State Isolation

Each stage gets its own state file, allowing multiple environments to coexist without conflicts:

```
.alchemy/
  my-app.dev.json      # Local dev stage
  my-app.e2e.json      # Local E2E stage
  my-app.staging.json  # Could be local or remote
  my-app.prod.json     # Usually remote/production
```

#### Common Pattern

Use both properties together to conditionally configure resources:

```typescript
const app = await alchemy("my-app");

if (app.local && app.stage === "e2e") {
  // Fast ephemeral setup for tests (e.g., in-memory database)
  const db = await setupInMemoryDatabase();
} else if (app.local) {
  // Local development with persistence (e.g., Docker)
  const db = await setupDockerDatabase();
} else {
  // Production cloud resources (e.g., managed database service)
  const db = await setupCloudDatabase();
}

await app.finalize();
```

This pattern is especially useful for:

- Running different infrastructure locally vs production
- Using lightweight alternatives for testing
- Managing multiple local environments simultaneously
- Avoiding resource conflicts during concurrent development

## Resource Scope

Each resource gets its own scope for managing child resources:

```typescript
export const WebApp = Resource(
  "my::WebApp",
  async function (this, id, props) {
    // Child resources automatically scoped to this WebApp
    const database = await Database("db", {});
    const apiGateway = await ApiGateway("api", {});
    
    return {
      id,
      url: apiGateway.url,
      dbConnectionString: database.connectionString
    };
  }
);

// Usage
const app = await WebApp("my-app", {});
```

```
.alchemy/
  my-app/
    dev/
      my-app.json
      my-app/  # Resource scope
        db.json
        api.json
```

## Nested Scope

Create custom nested scopes to organize related resources:

```typescript
// Create nested scopes
await alchemy.run("backend", async () => {
  await ApiGateway("api", {});
  await Function("handler", {});
});

await alchemy.run("frontend", async () => {
  await Bucket("assets", {});
});
```

```
.alchemy/
  my-app/
    dev/
      backend/
        api.json
        handler.json
      frontend/
        assets.json
```

## Scope Finalization

When finalized, scopes delete any orphaned resources (resources in state but not in code):

```typescript
const app = await alchemy("my-app");

await Bucket("assets", {});
// If a previously existing resource is removed from code,
// it will be deleted during finalization

await app.finalize(); // Manual finalization
```

Application scopes need manual finalization, but nested scopes finalize automatically when their execution completes.

## Test Scope

Alchemy provides isolated test scopes that automatically clean up after tests:

```typescript
import { alchemy } from "../../src/alchemy";
import "../../src/test/bun";

// Create test scope from filename
const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX
});

// Each test gets an isolated sub-scope
test("create resource", async (scope) => {
  const resource = await Resource("test-resource", {});
  expect(resource.id).toBeTruthy();
  // Resources auto-cleaned when test completes
});
```

Example from Cloudflare Worker tests:

```typescript
import { alchemy } from "../../src/alchemy";
import { Worker } from "../../src/cloudflare/worker";
import "../../src/test/bun";
import { BRANCH_PREFIX } from "../util";

const test = alchemy.test(import.meta, { prefix: BRANCH_PREFIX });

describe("Worker Resource", () => {
  test("create worker", async (scope) => {
    const worker = await Worker(`${BRANCH_PREFIX}-test-worker`, {
      script: "// Worker code",
      format: "esm",
    });
    
    expect(worker.id).toBeTruthy();
  });
});
```

For more details on testing with Alchemy, see [Testing in Alchemy](/concepts/testing).

## Destroy Strategy

By default, Alchemy will destroy scopes in a sequential order. You can change this behavior by passing the `destroyStrategy` option to the Scope constructor.

```typescript
const app = await alchemy("my-app", {
  destroyStrategy: "parallel"
});
```

You can also set the `destroyStrategy` option on the `alchemy.run` function.

```typescript
await alchemy.run("my-app", {
  destroyStrategy: "parallel"
}, async (scope) => {
  // resources will be deleted in parallel during scope deletion/finalization
  await Resource("resource1", {});
  await Resource("resource2", {});
});
```
