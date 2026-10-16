.PHONY: dev build package test typecheck test-unit test-integration lint clean help

dev:
	npm run dev

build:
	npm run build

package: build
	npx vsce package --no-dependencies

test: lint typecheck test-unit test-integration

typecheck:
	npx tsc --noEmit --skipLibCheck

test-unit:
	npm run test-unit

test-integration:
	npm run test-integration

lint:
	npm run lint

clean:
	rm -rf dist *.vsix

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  dev               One-shot build (non-production)"
	@echo "  build             Type-check + production build"
	@echo "  package           Build and package as .vsix"
	@echo "  test              Run lint + typecheck + unit + integration tests"
	@echo "  typecheck         Run TypeScript type-check only"
	@echo "  test-unit         Run unit tests only"
	@echo "  test-integration  Run integration tests (requires a running Polyphon instance)"
	@echo "  lint              Type-check and lint source files"
	@echo "  clean             Remove dist/ and .vsix files"
	@echo "  help              Show this help message"
