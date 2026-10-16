.PHONY: build test lint clean verify-dist

build:
	npm run build

test:
	npm test

lint:
	npm run lint

clean:
	rm -rf dist

verify-dist:
	test -d dist/testing && test -z "$$(find dist -name '*.test.js')" && echo "dist/ ok"
