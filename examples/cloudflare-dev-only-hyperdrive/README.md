# Dev only hyperdrive example

This example provisions a Prisma Postgres database and reference it using hyperdrive ONLY in dev mode.
This may not be the most useful example for end users, it primarily serves to improve coverage during Alchemy's smoke tests.

## Usage

```bash
bun i
bun alchemy deploy
```

The script prints the generated database connection string to stdout.

To tear down the resources:

```bash
bun run destroy
```
