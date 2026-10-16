import * as vscode from "vscode";
import type { ConnectionState } from "./PolyphonManager";

export class PolyphonStatusBarItem implements vscode.Disposable {
  private readonly _item: vscode.StatusBarItem;

  constructor() {
    this._item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this._item.command = "polyphon.connect";
    this.update("disconnected");
    this._item.show();
  }

  update(state: ConnectionState): void {
    const labels: Record<ConnectionState, string> = {
      disconnected: "$(debug-disconnect) Polyphon",
      connecting: "$(sync~spin) Polyphon",
      connected: "$(radio-tower) Polyphon",
      error: "$(error) Polyphon",
    };
    const tooltips: Record<ConnectionState, string> = {
      disconnected: "Polyphon: disconnected. Click to connect.",
      connecting: "Polyphon: connecting…",
      connected: "Polyphon: connected",
      error: "Polyphon: auth error. Run 'Polyphon: Read Local API Token'.",
    };
    this._item.text = labels[state];
    this._item.tooltip = tooltips[state];
    this._item.backgroundColor =
      state === "error"
        ? new vscode.ThemeColor("statusBarItem.errorBackground")
        : undefined;
  }

  dispose(): void {
    this._item.dispose();
  }
}
