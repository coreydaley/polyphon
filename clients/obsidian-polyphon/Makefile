PLUGIN_ID        := polyphon
VAULT_DIR        := vault
VAULT_PLUGIN_DIR := $(VAULT_DIR)/.obsidian/plugins/$(PLUGIN_ID)
HOT_RELOAD_DIR   := $(VAULT_DIR)/.obsidian/plugins/hot-reload
HOT_RELOAD_VER   := 0.3.0
HOT_RELOAD_BASE  := https://github.com/pjeby/hot-reload/releases/download/$(HOT_RELOAD_VER)

.PHONY: dev vault-setup build clean test test-unit test-integration lint help

dev: vault-setup
	@echo "Starting watcher — changes to src/ will sync to $(VAULT_PLUGIN_DIR) automatically."
	npm run dev

vault-setup: clean build
	@echo "Creating sample vault..."
	mkdir -p $(VAULT_PLUGIN_DIR)
	mkdir -p $(HOT_RELOAD_DIR)
	@echo '["hot-reload","$(PLUGIN_ID)"]' > $(VAULT_DIR)/.obsidian/community-plugins.json
	curl -fsSL $(HOT_RELOAD_BASE)/main.js -o $(HOT_RELOAD_DIR)/main.js
	curl -fsSL $(HOT_RELOAD_BASE)/manifest.json -o $(HOT_RELOAD_DIR)/manifest.json
	touch $(VAULT_PLUGIN_DIR)/.hotreload
	@printf '# Polyphon — Test Vault\n\nThis is a sample vault for testing the Polyphon plugin.\n\nOpen the sidebar using the icon in the ribbon or via the command palette: **Polyphon: Open sidebar**.\n\nMake sure Polyphon is running before opening the sidebar.\n' > "$(VAULT_DIR)/Welcome.md"
	cp main.js manifest.json styles.css $(VAULT_PLUGIN_DIR)/
	@echo "Vault ready. Open vault/ in Obsidian to test."

build:
	npm run build

test: lint test-unit test-integration

test-unit:
	npm run test-unit

test-integration:
	npm run test-integration

lint:
	npm run lint

clean:
	rm -f main.js
	rm -rf $(VAULT_DIR)

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  dev               Build and start watch mode with hot-reload vault"
	@echo "  build             Type-check and bundle (production)"
	@echo "  test              Run unit and integration tests"
	@echo "  test-unit         Run unit tests only"
	@echo "  test-integration  Run integration tests (requires a running Polyphon instance)"
	@echo "  lint              Lint source files"
	@echo "  vault-setup       Create sample Obsidian vault with plugin installed"
	@echo "  clean             Remove build output and vault directory"
	@echo "  help              Show this help message"
