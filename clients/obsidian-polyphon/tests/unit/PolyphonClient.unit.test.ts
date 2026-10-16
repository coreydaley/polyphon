import { describe, it, expect } from "vitest";
import { PolyphonClient, defaultTokenPath, RpcError } from "@polyphon-ai/js";
import * as path from "path";
import * as os from "os";

// ---- defaultTokenPath -------------------------------------------------------

describe("defaultTokenPath", () => {
  it("resolves to the correct macOS path", () => {
    const p = defaultTokenPath();
    if (os.platform() === "darwin") {
      expect(p).toBe(path.join(os.homedir(), "Library", "Application Support", "Polyphon", "api.key"));
    } else {
      expect(p).toContain(path.join("Polyphon", "api.key"));
    }
  });

  it("respects POLYPHON_DATA_DIR override", () => {
    const orig = process.env.POLYPHON_DATA_DIR;
    process.env.POLYPHON_DATA_DIR = "/tmp/polyphon-test";
    expect(defaultTokenPath()).toBe(path.join("/tmp/polyphon-test", "api.key"));
    if (orig === undefined) delete process.env.POLYPHON_DATA_DIR;
    else process.env.POLYPHON_DATA_DIR = orig;
  });
});

// ---- PolyphonClient construction --------------------------------------------

describe("PolyphonClient", () => {
  it("can be constructed with explicit host/port/token", () => {
    const client = new PolyphonClient({ host: "127.0.0.1", port: 7432, token: "test-token" });
    expect(client.getState()).toBe("idle");
  });

  it("uses defaults when host/port are omitted", () => {
    const client = new PolyphonClient({ token: "test" });
    expect(client.getState()).toBe("idle");
  });
});

// ---- RpcError ---------------------------------------------------------------

describe("RpcError", () => {
  it("is an Error subclass with a numeric code", () => {
    const err = new RpcError(-32001, "Unauthorized");
    expect(err instanceof Error).toBe(true);
    expect(err instanceof RpcError).toBe(true);
    expect(err.code).toBe(-32001);
    expect(err.message).toBe("Unauthorized");
    expect(err.name).toBe("RpcError");
  });

  it("carries optional data", () => {
    const err = new RpcError(-32000, "oops", { detail: "x" });
    expect(err.data).toEqual({ detail: "x" });
  });
});

// ---- side-mapping logic (plugin layer) --------------------------------------
//
// The side assignment (left/right alternating by voice index) lives in
// PolyphonSidebarView.loadCompositions(), not in the SDK client.
// These tests verify the transformation in isolation.

describe("voice side assignment", () => {
  function assignSides(voices: { id: string; displayName: string }[]) {
    return voices.map((v, i) => ({ ...v, side: (i % 2 === 0 ? "left" : "right") as "left" | "right" }));
  }

  it("alternates left/right starting with left", () => {
    const result = assignSides([
      { id: "v1", displayName: "A" },
      { id: "v2", displayName: "B" },
      { id: "v3", displayName: "C" },
    ]);
    expect(result[0].side).toBe("left");
    expect(result[1].side).toBe("right");
    expect(result[2].side).toBe("left");
  });

  it("single voice is left", () => {
    const result = assignSides([{ id: "v1", displayName: "Solo" }]);
    expect(result[0].side).toBe("left");
  });

  it("empty voices array", () => {
    expect(assignSides([])).toHaveLength(0);
  });
});
