import * as vscode from "vscode";

export interface CodeContext {
  file: string | null;
  selection: string | null;
  diagnostics: string[] | null;
}

export function getCodeContext(): CodeContext {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return { file: null, selection: null, diagnostics: null };

  const file = editor.document.uri.fsPath;
  const sel = editor.selection;
  const selection = sel.isEmpty ? null : editor.document.getText(sel);

  const range = sel.isEmpty ? new vscode.Range(sel.active, sel.active) : sel;
  const diagnostics = vscode.languages
    .getDiagnostics(editor.document.uri)
    .filter(
      (d) =>
        d.severity === vscode.DiagnosticSeverity.Error &&
        range.intersection(d.range) !== undefined,
    )
    .slice(0, 5)
    .map((d) => d.message);

  return {
    file,
    selection,
    diagnostics: diagnostics.length > 0 ? diagnostics : null,
  };
}
