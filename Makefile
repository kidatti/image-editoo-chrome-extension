# Image Editoo - Chrome Extension Build Script
# Chrome Web Store公開用のzipファイルを作成

# デフォルト設定
EXTENSION_NAME = image-editoo
SRC_DIR = src
DIST_DIR = dist
BUILD_DIR = build
VERSION_FILE = .version

# .versionからバージョンを取得
VERSION := $(strip $(shell cat $(VERSION_FILE) 2>/dev/null))

# ビルド対象ファイル
SRC_FILES = $(SRC_DIR)/manifest.json \
            $(SRC_DIR)/index.html \
            $(SRC_DIR)/env.js \
            $(SRC_DIR)/style.css \
            $(SRC_DIR)/script.js \
            $(SRC_DIR)/background.js \
            $(SRC_DIR)/_locales \
            $(SRC_DIR)/icons

# 出力ファイル名
ZIP_FILE = $(EXTENSION_NAME)-v$(VERSION).zip
DIST_ZIP = $(DIST_DIR)/$(ZIP_FILE)

.PHONY: all clean build dist version validate-version help

# デフォルトターゲット
all: dist

# バージョン形式の検証（Chrome拡張機能向けの3要素バージョン）
validate-version:
	@python3 -c "import pathlib, re, sys; \
	p = pathlib.Path('$(VERSION_FILE)'); \
	v = p.read_text().strip() if p.is_file() else ''; \
	valid = bool(re.fullmatch(r'(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)', v)) and all(int(n) <= 65535 for n in v.split('.')) and v != '0.0.0'; \
	sys.exit(0) if valid else sys.exit('Invalid version in $(VERSION_FILE): %s (expected x.y.z, each number 0-65535, not 0.0.0)' % (v or '<empty>'))"

# バージョン表示
version: validate-version
	@echo "Current version: $(VERSION)"

# ビルドディレクトリの作成と配布用zipファイルの生成
build: validate-version clean
	@echo "Building $(EXTENSION_NAME) v$(VERSION)..."
	@mkdir -p $(BUILD_DIR)
	@python3 -c "import json; \
	data = json.load(open('$(SRC_DIR)/manifest.json')); \
	data['version'] = open('$(VERSION_FILE)').read().strip(); \
	json.dump(data, open('$(BUILD_DIR)/manifest.json', 'w'), indent=2, ensure_ascii=False); \
	open('$(BUILD_DIR)/manifest.json', 'a').write('\\n')"
	@cp -r $(SRC_DIR)/index.html $(BUILD_DIR)/
	@cp -r $(SRC_DIR)/env.js $(BUILD_DIR)/
	@cp -r $(SRC_DIR)/style.css $(BUILD_DIR)/
	@cp -r $(SRC_DIR)/script.js $(BUILD_DIR)/
	@cp -r $(SRC_DIR)/background.js $(BUILD_DIR)/
	@if [ -d "$(SRC_DIR)/_locales" ]; then cp -r $(SRC_DIR)/_locales $(BUILD_DIR)/; fi
	@if [ -d "$(SRC_DIR)/icons" ]; then cp -r $(SRC_DIR)/icons $(BUILD_DIR)/; fi
	@printf "window.IMAGE_EDITOO_ENV = {\\n    localDevelopment: false\\n};\\n" > $(BUILD_DIR)/env.js
	@echo "Creating distribution package..."
	@mkdir -p $(DIST_DIR)
	@cd $(BUILD_DIR) && zip -r -FS ../$(DIST_ZIP) . -x "*.DS_Store" "*Thumbs.db"
	@echo "Distribution package created: $(DIST_ZIP)"
	@echo "File size: $$(du -h $(DIST_ZIP) | cut -f1)"
	@echo "Unpacked extension available in $(BUILD_DIR)/"

# 配布用zipファイルの作成後、作業ディレクトリを削除
dist: build
	@rm -rf $(BUILD_DIR)
	@echo "Removed $(BUILD_DIR)/"

# 開発用：ブラウザでテスト
test-browser:
	@echo "Opening Chrome extensions page..."
	@echo "Load the extension from: $$(pwd)/$(SRC_DIR)"
	@open "chrome://extensions/"

# バージョンアップ（パッチ）
bump-patch: validate-version
	@echo "Bumping patch version..."
	@python3 -c "from pathlib import Path; \
	p = Path('$(VERSION_FILE)'); \
	v = p.read_text().strip().split('.'); \
	v[2] = str(int(v[2]) + 1); \
	p.write_text('.'.join(v) + '\\n')"
	@echo "Version updated to: $$(cat $(VERSION_FILE))"

# バージョンアップ（マイナー）
bump-minor: validate-version
	@echo "Bumping minor version..."
	@python3 -c "from pathlib import Path; \
	p = Path('$(VERSION_FILE)'); \
	v = p.read_text().strip().split('.'); \
	v[1] = str(int(v[1]) + 1); v[2] = '0'; \
	p.write_text('.'.join(v) + '\\n')"
	@echo "Version updated to: $$(cat $(VERSION_FILE))"

# バージョンアップ（メジャー）
bump-major: validate-version
	@echo "Bumping major version..."
	@python3 -c "from pathlib import Path; \
	p = Path('$(VERSION_FILE)'); \
	v = p.read_text().strip().split('.'); \
	v[0] = str(int(v[0]) + 1); v[1] = '0'; v[2] = '0'; \
	p.write_text('.'.join(v) + '\\n')"
	@echo "Version updated to: $$(cat $(VERSION_FILE))"

# バージョンアップしてビルド（更新後の.versionを再読み込み）
release-patch: bump-patch
	@$(MAKE) dist
	@echo "Patch release completed!"

release-minor: bump-minor
	@$(MAKE) dist
	@echo "Minor release completed!"

release-major: bump-major
	@$(MAKE) dist
	@echo "Major release completed!"

# クリーンアップ
clean:
	@echo "Cleaning up build files..."
	@rm -rf $(BUILD_DIR)
	@echo "Clean completed."

# 全削除（distフォルダも含む）
clean-all: clean
	@echo "Cleaning up all generated files..."
	@rm -rf $(DIST_DIR)
	@echo "All clean completed."

# 配布ファイルの検証
validate: dist
	@echo "Validating distribution package..."
	@unzip -t $(DIST_ZIP)
	@echo "Validation completed."

# 配布ファイルの内容確認
inspect: dist
	@echo "Contents of $(DIST_ZIP):"
	@unzip -l $(DIST_ZIP)

# ヘルプ
help:
	@echo "Image Editoo Chrome Extension Build Script"
	@echo ""
	@echo "Available commands:"
	@echo "  make              - Build and create distribution package"
	@echo "  make version      - Show current version"
	@echo "  make build        - Build extension files and create distribution zip"
	@echo "  make dist         - Create distribution zip file"
	@echo "  make clean        - Remove build files"
	@echo "  make clean-all    - Remove all generated files"
	@echo "  make validate     - Validate distribution package"
	@echo "  make inspect      - Show distribution package contents"
	@echo ""
	@echo "Version management:"
	@echo "  Edit .version     - Set the version used for builds (x.y.z)"
	@echo "  make bump-patch   - Increment patch version (0.1.0 -> 0.1.1)"
	@echo "  make bump-minor   - Increment minor version (0.1.0 -> 0.2.0)"
	@echo "  make bump-major   - Increment major version (0.1.0 -> 1.0.0)"
	@echo ""
	@echo "Release commands:"
	@echo "  make release-patch - Bump patch version and build"
	@echo "  make release-minor - Bump minor version and build"
	@echo "  make release-major - Bump major version and build"
	@echo ""
	@echo "Testing:"
	@echo "  make test-browser - Open Chrome extensions page"
	@echo ""
	@echo "Current version: $(VERSION)"
	@echo "Output file: $(DIST_ZIP)"
