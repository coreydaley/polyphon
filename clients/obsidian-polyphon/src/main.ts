import { Plugin } from "obsidian";
import { PolyphonClient } from "@polyphon-ai/js";
import { PolyphonSidebarView, POLYPHON_SIDEBAR_VIEW_TYPE } from "./PolyphonSidebarView";
import { DEFAULT_SETTINGS, PolyphonSettingTab } from "./settings";
import type { PluginSettings } from "./types";

export default class PolyphonPlugin extends Plugin {
  settings: PluginSettings = { ...DEFAULT_SETTINGS };
  client: PolyphonClient = new PolyphonClient(this.settings);

  async onload(): Promise<void> {
    await this.loadSettings();
    this.client = new PolyphonClient(this.settings);

    this.registerView(
      POLYPHON_SIDEBAR_VIEW_TYPE,
      (leaf) => new PolyphonSidebarView(leaf, this)
    );

    this.addRibbonIcon("message-square", "Open sidebar", () => {
      void this.activateSidebar();
    });

    this.addCommand({
      id: "open",
      name: "Open sidebar",
      callback: () => void this.activateSidebar(),
    });

    this.addSettingTab(new PolyphonSettingTab(this.app, this));
  }

  onunload(): void {
    this.client.disconnect();
  }

  getSidebarView(): PolyphonSidebarView | null {
    const leaf = this.app.workspace.getLeavesOfType(POLYPHON_SIDEBAR_VIEW_TYPE)[0];
    return leaf?.view instanceof PolyphonSidebarView ? leaf.view : null;
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<PluginSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Reconnect with updated config
    this.client.disconnect();
    this.client = new PolyphonClient(this.settings);
    this.getSidebarView()?.onClientReplaced(this.client);
  }

  private async activateSidebar(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(POLYPHON_SIDEBAR_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
      await leaf.setViewState({ type: POLYPHON_SIDEBAR_VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }
}
