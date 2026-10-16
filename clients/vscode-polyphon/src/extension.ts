import * as vscode from "vscode";
import { PolyphonManager } from "./PolyphonManager";
import { SidebarProvider } from "./SidebarProvider";
import { PolyphonStatusBarItem } from "./StatusBarItem";

export function activate(context: vscode.ExtensionContext): void {
  const manager = new PolyphonManager(context);
  const sidebar = new SidebarProvider(context.extensionUri, manager);
  const statusBar = new PolyphonStatusBarItem();

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, sidebar),
    statusBar,
    manager,
  );

  manager.on("stateChange", (state: string) => {
    statusBar.update(state as Parameters<typeof statusBar.update>[0]);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("polyphon.connect", () => void manager.connect()),
    vscode.commands.registerCommand("polyphon.disconnect", () => manager.disconnect()),
    vscode.commands.registerCommand("polyphon.newSession", () => void sidebar.newSession()),
    vscode.commands.registerCommand("polyphon.askAboutSelection", () => void sidebar.askAboutSelection()),
    vscode.commands.registerCommand("polyphon.readToken", () => void manager.readAndSaveToken()),
  );

  void manager.connect();
}

export function deactivate(): void {}
