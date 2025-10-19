---
title: R2Bucket
description: Learn how to create, configure, and manage Cloudflare R2 Buckets using Alchemy for scalable object storage.
---

Creates and manages [Cloudflare R2 Buckets](https://developers.cloudflare.com/r2/buckets/) for object storage with S3 compatibility.

## Minimal Example

Create a basic R2 bucket with default settings:

```ts
import { R2Bucket } from "alchemy/cloudflare";

const bucket = await R2Bucket("my-bucket", {
  name: "my-bucket",
});
```

## Bind to a Worker

```ts
import { Worker, R2Bucket } from "alchemy/cloudflare";

const bucket = await R2Bucket("my-bucket", {
  name: "my-bucket",
});

await Worker("my-worker", {
  name: "my-worker",
  script: "console.log('Hello, world!')",
  bindings: {
    BUCKET: bucket,
  },
});
```

## With Location Hint

Create a bucket with location hint for optimal performance:

```ts
import { R2Bucket } from "alchemy/cloudflare";

const euBucket = await R2Bucket("eu-bucket", {
  name: "eu-bucket",
  locationHint: "eu",
  jurisdiction: "eu",
});
```

## With Public Access

Create a development bucket with public access enabled:

```ts
import { R2Bucket } from "alchemy/cloudflare";

const publicBucket = await R2Bucket("public-assets", {
  name: "public-assets",
  allowPublicAccess: true,
});
console.log(publicBucket.domain); // [random-id].r2.dev
```

This enables the `r2.dev` domain for the bucket. This URL is rate-limited and not recommended for production use.

## With Custom Domain

Serve bucket content through your own domain with automatic DNS configuration:

```ts
import { R2Bucket, Zone } from "alchemy/cloudflare";

// Option 1: Using a Zone resource (domain can be derived from zone)
const zone = await Zone("my-zone", { name: "example.com" });

const cdnBucket = await R2Bucket("cdn-assets", {
  name: "cdn-assets",
  customDomain: {
    domain: "cdn.example.com", // Optional when using Zone resource
    zone: zone, // Pass the Zone resource directly
    enabled: true,
    minTLS: "1.2", // Minimum TLS version (1.0, 1.1, 1.2, 1.3)
  },
});

// Option 2: Using a zone ID string (domain is required)
const cdnBucket2 = await R2Bucket("cdn-assets-2", {
  name: "cdn-assets-2",
  customDomain: {
    domain: "cdn2.example.com", // Required when using zone ID string
    zone: "your-zone-id", // Cloudflare Zone ID as string
    enabled: true,
    minTLS: "1.2",
  },
});

// DNS record is automatically created as a proxied CNAME to public.r2.dev
console.log(cdnBucket.customDomain?.domain); // "cdn.example.com"
```

The custom domain feature:

- Automatically creates a proxied CNAME DNS record pointing to `public.r2.dev`
- Handles DNS record cleanup when the custom domain is removed
- Supports TLS configuration and cipher suite customization
- Provides ownership verification and SSL certificate status
- Accepts either a Zone resource or zone ID string for the `zone` property
- When using a Zone resource, the `domain` can be derived from the zone's name if not explicitly provided

## With CORS

Create a bucket with CORS rules:

```ts
import { R2Bucket } from "alchemy/cloudflare";

const corsBucket = await R2Bucket("cors-bucket", {
  name: "cors-bucket",
  cors: [
    {
      allowed: {
        origins: ["https://example.com"],
        methods: ["GET", "POST", "PUT", "DELETE", "HEAD"],
        headers: ["*"],
      },
    },
  ],
});
```

## With Auto-Emptying

Create a bucket that will be automatically emptied when deleted:

```ts
import { R2Bucket } from "alchemy/cloudflare";

const tempBucket = await R2Bucket("temp-storage", {
  name: "temp-storage",
  empty: true, // All objects will be deleted when this resource is destroyed
});
```

## With Lifecycle Rules

Configure automatic transitions like aborting multipart uploads, deleting objects after an age or date, or moving objects to Infrequent Access.

```ts
import { R2Bucket } from "alchemy/cloudflare";

const bucket = await R2Bucket("logs", {
  name: "logs",
  lifecycle: [
    // Abort incomplete multipart uploads after 7 days
    {
      id: "abort-mpu-7d",
      conditions: { prefix: "" }, // empty means apply to all objects/uploads
      enabled: true,
      abortMultipartUploadsTransition: {
        condition: { type: "Age", maxAge: 7 * 24 * 60 * 60 },
      },
    },
    // Delete objects after 30 days
    {
      id: "delete-30d",
      conditions: { prefix: "archive/" },
      deleteObjectsTransition: {
        condition: { type: "Age", maxAge: 30 * 24 * 60 * 60 },
      },
    },
    // Transition storage class to InfrequentAccess after 60 days
    {
      id: "ia-60d",
      conditions: { prefix: "cold/" },
      storageClassTransitions: [
        {
          condition: { type: "Age", maxAge: 60 * 24 * 60 * 60 },
          storageClass: "InfrequentAccess",
        },
      ],
    },
  ],
});
```

- **conditions.prefix**: Scope rule to keys beginning with a prefix. Use "" for all keys.
- **enabled**: Defaults to `true` when omitted.
- **Age condition fields**: lifecycle uses `maxAge` (seconds).
- **Date condition fields**: use ISO strings like `"2025-01-01T00:00:00Z"`.

## With Object Lock Rules

Apply retention locks to objects by age, until a fixed date, or indefinitely.

```ts
import { R2Bucket } from "alchemy/cloudflare";

const bucket = await R2Bucket("legal-holds", {
  name: "legal-holds",
  lock: [
    // Lock all objects for 7 days
    {
      id: "retain-7d",
      prefix: "",
      enabled: true,
      condition: { type: "Age", maxAgeSeconds: 7 * 24 * 60 * 60 },
    },
    // Indefinite lock for the legal prefix
    {
      id: "legal-indef",
      prefix: "legal/",
      condition: { type: "Indefinite" },
    },
    // Retain until a specific date
    {
      id: "retain-until-2025",
      prefix: "exports/",
      condition: { type: "Date", date: "2025-01-01T00:00:00Z" },
    },
  ],
});
```

- **prefix**: Scope the lock rule to objects starting with the prefix. Omit or set to "" for all keys.
- **enabled**: Defaults to `true` when omitted.
- **Age condition fields**: lock uses `maxAgeSeconds` (seconds).

## With Data Catalog

Enable data catalog for the bucket.

```ts
import { R2Bucket } from "alchemy/cloudflare";

const bucket = await R2Bucket("my-bucket", {
  name: "my-bucket",
  dataCatalog: true,
});

console.log(bucket.catalog);
```

## Object Operations

Use the returned `R2Bucket` instance to work with objects directly from your scripts.

```ts
import { R2Bucket } from "alchemy/cloudflare";

const bucket = await R2Bucket("my-bucket", {
  name: "my-bucket",
});
```

### `head`

Retrieve metadata about an object.

```ts
const head = await bucket.head("example.txt");
if (head) {
  console.log(head.etag, head.size);
}
```

### `get`

Retrieve an object from the bucket.

```ts
const obj = await bucket.get("example.txt");
const text = await obj?.text();
```

### `put`

Upload an object to the bucket.

```ts
const putInfo = await bucket.put("example.txt", "Hello, R2!\n");
```

### `delete`

Delete an object from the bucket.

```ts
await bucket.delete("example.txt");
```

### `list`  

List objects in the bucket.

```ts
const list = await bucket.list();
console.log(list.objects.length);
```
