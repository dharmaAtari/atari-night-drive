# Atari Night Drive -- build, run and packaging targets.

PHASER_SRC := node_modules/phaser/dist/phaser.esm.js
PHASER_DST := bin/lib/phaser.esm.js
PORT       ?= 8000
DIST       ?= dist

.PHONY: all build run serve clean package deps

all: build

## deps: fetch node dependencies (Phaser)
deps: node_modules

node_modules: package.json
	npm install
	@touch $@

## build: vendor the Phaser runtime into bin/lib/ so the game can be served statically
build: $(PHASER_DST)

$(PHASER_DST): $(PHASER_SRC) | node_modules
	@mkdir -p $(dir $@)
	cp $< $@
	@echo "vendored $< -> $@"

$(PHASER_SRC): | node_modules

## run: build, then serve the game at http://localhost:$(PORT)/
run: serve

serve: build
	@echo "serving http://localhost:$(PORT)/  (ctrl-c to stop)"
	python3 -m http.server $(PORT)

## package: produce a self-contained dist/ tree
package: build
	rm -rf $(DIST)
	mkdir -p $(DIST)
	cp index.html $(DIST)/
	cp -r src bin $(DIST)/
	@echo "packaged into $(DIST)/"

## clean: remove generated files
clean:
	rm -rf bin/lib $(DIST)
