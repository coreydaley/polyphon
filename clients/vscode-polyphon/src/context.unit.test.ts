import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("vscode", () => {
  class MockRange {
    constructor(
      public start: unknown,
      public end: unknown,
    ) {}
    intersection() {
      return {}; // always intersects — tests control outcomes via getDiagnostics mock
    }
  }

  return {
    window: { activeTextEditor: undefined as unknown },
    languages: { getDiagnostics: vi.fn(() => []) },
    DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2, Hint: 3 },
    Range: MockRange,
  };
});

import { getCodeContext } from "./context";
import * as vscode from "vscode";

interface MockDiagnostic {
  message: string;
  severity: number;
  range?: unknown;
}

function makeDiagnostics(items: MockDiagnostic[]) {
  return items.map((d) => ({ message: d.message, severity: d.severity, range: d.range ?? {} }));
}

function makeEditor(options: {
  file?: string;
  isEmpty?: boolean;
  selectedText?: string;
  diagnostics?: MockDiagnostic[];
}) {
  const { file = "/test/file.ts", isEmpty = true, selectedText = "", diagnostics = [] } = options;

  vi.mocked(vscode.languages.getDiagnostics).mockReturnValue(
    makeDiagnostics(diagnostics) as unknown as ReturnType<typeof vscode.languages.getDiagnostics>,
  );

  return {
    document: {
      uri: { fsPath: file },
      getText: vi.fn(() => selectedText),
    },
    selection: {
      isEmpty,
      active: { line: 0, character: 0 },
      // When not empty, range = sel, so intersection is called on sel
      intersection: vi.fn(() => (isEmpty ? undefined : {})),
    },
  };
}

describe("getCodeContext", () => {
  beforeEach(() => {
    vi.mocked(vscode.languages.getDiagnostics).mockReturnValue([]);
    (vscode.window as Record<string, unknown>).activeTextEditor = undefined;
  });

  it("returns all null when there is no active editor", () => {
    expect(getCodeContext()).toEqual({ file: null, selection: null, diagnostics: null });
  });

  it("returns the file path when an editor is open", () => {
    (vscode.window as Record<string, unknown>).activeTextEditor = makeEditor({
      file: "/src/foo.ts",
    });
    const ctx = getCodeContext();
    expect(ctx.file).toBe("/src/foo.ts");
    expect(ctx.selection).toBeNull();
    expect(ctx.diagnostics).toBeNull();
  });

  it("returns selected text when the selection is non-empty", () => {
    (vscode.window as Record<string, unknown>).activeTextEditor = makeEditor({
      isEmpty: false,
      selectedText: "const x = 1;",
    });
    expect(getCodeContext().selection).toBe("const x = 1;");
  });

  it("returns null selection when the selection is empty", () => {
    (vscode.window as Record<string, unknown>).activeTextEditor = makeEditor({ isEmpty: true });
    expect(getCodeContext().selection).toBeNull();
  });

  it("returns error diagnostics that overlap the selection", () => {
    (vscode.window as Record<string, unknown>).activeTextEditor = makeEditor({
      isEmpty: false,
      diagnostics: [
        { message: "Type mismatch", severity: 0 },
        { message: "Cannot find name", severity: 0 },
      ],
    });
    const ctx = getCodeContext();
    expect(ctx.diagnostics).toEqual(["Type mismatch", "Cannot find name"]);
  });

  it("excludes non-error diagnostics", () => {
    (vscode.window as Record<string, unknown>).activeTextEditor = makeEditor({
      isEmpty: false,
      diagnostics: [
        { message: "unused variable", severity: 1 }, // Warning
        { message: "consider refactoring", severity: 2 }, // Information
      ],
    });
    expect(getCodeContext().diagnostics).toBeNull();
  });

  it("limits diagnostics to 5 even when more exist", () => {
    (vscode.window as Record<string, unknown>).activeTextEditor = makeEditor({
      isEmpty: false,
      diagnostics: Array.from({ length: 8 }, (_, i) => ({ message: `error ${i}`, severity: 0 })),
    });
    expect(getCodeContext().diagnostics?.length).toBe(5);
  });

  it("returns null diagnostics when the list is empty", () => {
    (vscode.window as Record<string, unknown>).activeTextEditor = makeEditor({ isEmpty: false });
    expect(getCodeContext().diagnostics).toBeNull();
  });

  it("includes errors even with no text selection (point range check)", () => {
    // When isEmpty=true, context.ts creates a point range via new vscode.Range(...)
    // MockRange.intersection always returns {}, so errors at any position are included
    (vscode.window as Record<string, unknown>).activeTextEditor = makeEditor({
      isEmpty: true,
      diagnostics: [{ message: "error at cursor", severity: 0 }],
    });
    const ctx = getCodeContext();
    expect(ctx.diagnostics).toEqual(["error at cursor"]);
  });
});
