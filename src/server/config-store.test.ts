import { mkdtemp, readFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { getConfig, saveConfig } from "@/server/config-store";

describe("config-store", () => {
  let configPath = "";

  beforeEach(async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vibelatex-config-test-"));
    configPath = path.join(dir, "config.json");
    process.env.VIBELATEX_CONFIG_PATH = configPath;
  });

  afterEach(() => {
    delete process.env.VIBELATEX_CONFIG_PATH;
  });

  it("loads defaults and persists patches", async () => {
    const initial = await getConfig();
    expect(initial.provider.base_url).toBeTruthy();

    await saveConfig({
      provider: {
        model: "test-model",
      },
    });

    const updated = await getConfig();
    expect(updated.provider.model).toBe("test-model");

    const persisted = JSON.parse(await readFile(configPath, "utf8")) as { provider: { model: string } };
    expect(persisted.provider.model).toBe("test-model");
  });

  it("clamps retry attempts to PRD-safe max value", async () => {
    await saveConfig({
      provider: {
        retry_attempts: 9,
      },
    });

    const updated = await getConfig();
    expect(updated.provider.retry_attempts).toBe(1);
  });
});
