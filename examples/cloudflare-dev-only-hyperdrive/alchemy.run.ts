import alchemy from "alchemy";
import { Hyperdrive, Worker } from "alchemy/cloudflare";
import { Connection, Database, Project } from "alchemy/prisma-postgres";

const app = await alchemy("alchemy-dev-only-hyperdrive");

const project = await Project("project");

const database = await Database("database", {
  project,
  region: "us-east-1",
});

const connection = await Connection("connection", { database });

const db = await Hyperdrive("dev-only-hyperdrive", {
  origin: app.local ? undefined : connection.connectionString.unencrypted,
  dev: {
    origin: connection.connectionString.unencrypted,
  },
});

await app.finalize();
