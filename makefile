# Atari Night Drive -- thin wrapper over the npm/Vite scripts in package.json.
# Every target here shells out to npm; package.json stays the source of truth.

NPM  ?= npm
PORT ?= 8000

.PHONY: help all deps dev build preview playtest verify typecheck clean distclean

help:
	@echo "targets:"
	@sed -n 's/^## //p' $(MAKEFILE_LIST)

## all: install dependencies and produce a production build
all: build

## deps: install node dependencies
deps: node_modules

node_modules: package.json package-lock.json
	$(NPM) install
	@touch $@

## dev: start the Vite dev server on http://localhost:$(PORT)/
dev: | node_modules
	$(NPM) run dev -- --port $(PORT)

## build: typecheck, then build into dist/
build: | node_modules
	$(NPM) run build

## preview: serve the contents of dist/ as it will ship
preview: build
	$(NPM) run preview -- --port $(PORT)

## playtest: boot the game headless in Chromium and assert it actually plays
playtest: | node_modules
	$(NPM) run playtest

## verify: typecheck, build, then playtest -- the full gate
verify: | node_modules
	$(NPM) run verify

## typecheck: run tsc --noEmit without emitting a build
typecheck: | node_modules
	$(NPM) run typecheck

## clean: remove the build output
clean:
	rm -rf dist

## distclean: clean, and drop node_modules too
distclean: clean
	rm -rf node_modules
