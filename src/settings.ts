import { App, Notice, PluginSettingTab, Setting, type TextComponent } from "obsidian";
import type PolyphonPlugin from "./main";
import { readLocalToken } from "@polyphon-ai/js";

export const DEFAULT_SETTINGS = {
  host: "127.0.0.1",
  port: 7432,
  token: "",
  persistConversations: false,
  debugMode: false,
};

export class PolyphonSettingTab extends PluginSettingTab {
  plugin: PolyphonPlugin;

  constructor(app: App, plugin: PolyphonPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("polyphon-settings");

    new Setting(containerEl).setHeading().setName("Connection");

    new Setting(containerEl)
      .setName("Host")
      .setDesc("Hostname or IP address of the running instance.")
      .addText((text) =>
        text
          .setPlaceholder("127.0.0.1")
          .setValue(this.plugin.settings.host)
          .onChange(async (value) => {
            this.plugin.settings.host = value.trim() || "127.0.0.1";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Port")
      .setDesc("TCP port the service is listening on.")
      .addText((text) =>
        text
          .setPlaceholder("7432")
          .setValue(String(this.plugin.settings.port))
          .onChange(async (value) => {
            const port = parseInt(value, 10);
            if (!isNaN(port) && port > 0 && port < 65536) {
              this.plugin.settings.port = port;
              await this.plugin.saveSettings();
            }
          })
      );

    let tokenInput: TextComponent | undefined;
    new Setting(containerEl)
      .setName("API token")
      .setDesc("Authentication token. Use 'read local token' to auto-fill from the running instance.")
      .addText((text) => {
        tokenInput = text;
        text.inputEl.type = "password";
        text
          .setPlaceholder("Auto-detected from local install")
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value;
            await this.plugin.saveSettings();
          });
      })
      .addButton((btn) =>
        btn
          .setButtonText("Read local token")
          .setTooltip("Load token from ~/Library/Application Support/Polyphon/api.key")
          .onClick(async () => {
            try {
              const token = readLocalToken();
              this.plugin.settings.token = token;
              await this.plugin.saveSettings();
              tokenInput?.setValue(token);
              new Notice("Polyphon: token loaded from local install.");
            } catch (err) {
              new Notice(`Polyphon: could not read token — is Polyphon running? (${String(err)})`);
            }
          })
      );

    new Setting(containerEl).setHeading().setName("Options");

    new Setting(containerEl)
      .setName("Persist conversations")
      .setDesc("Save and restore conversation history across Obsidian restarts.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.persistConversations).onChange(async (value) => {
          this.plugin.settings.persistConversations = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Debug mode")
      .setDesc("Log raw protocol frames to the console.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.debugMode).onChange(async (value) => {
          this.plugin.settings.debugMode = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
