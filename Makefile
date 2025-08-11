# Image Editoo - Chrome Extension Build Script
# Chrome Web Store公開用のzipファイルを作成

# デフォルト設定
EXTENSION_NAME = image-editoo
SRC_DIR = src
DIST_DIR = dist
BUILD_DIR = build

# manifest.jsonからバージョンを取得
VERSION := $(shell grep '"version"' $(SRC_DIR)/manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')

# ビルド対象ファイル
SRC_FILES = $(SRC_DIR)/manifest.json \
            $(SRC_DIR)/index.html \
            $(SRC_DIR)/style.css \
            $(SRC_DIR)/script.js \
            $(SRC_DIR)/background.js \
            $(SRC_DIR)/icons

# 出力ファイル名
ZIP_FILE = $(EXTENSION_NAME)-v$(VERSION).zip
DIST_ZIP = $(DIST_DIR)/$(ZIP_FILE)

.PHONY: all clean build dist version help

# デフォルトターゲット
all: dist

# バージョン表示
version:
	@echo "Current version: $(VERSION)"

# ビルドディレクトリの作成と準備
build: clean
	@echo "Building $(EXTENSION_NAME) v$(VERSION)..."
	@mkdir -p $(BUILD_DIR)
	@cp -r $(SRC_DIR)/manifest.json $(BUILD_DIR)/
	@cp -r $(SRC_DIR)/index.html $(BUILD_DIR)/
	@cp -r $(SRC_DIR)/style.css $(BUILD_DIR)/
	@cp -r $(SRC_DIR)/script.js $(BUILD_DIR)/
	@cp -r $(SRC_DIR)/background.js $(BUILD_DIR)/
	@if [ -d "$(SRC_DIR)/icons" ]; then cp -r $(SRC_DIR)/icons $(BUILD_DIR)/; fi
	@echo "Build completed in $(BUILD_DIR)/"

# 配布用zipファイルの作成
dist: build
	@echo "Creating distribution package..."
	@mkdir -p $(DIST_DIR)
	@cd $(BUILD_DIR) && zip -r ../$(DIST_ZIP) . -x "*.DS_Store" "*Thumbs.db"
	@echo "Distribution package created: $(DIST_ZIP)"
	@echo "File size: $$(du -h $(DIST_ZIP) | cut -f1)"

# 開発用：ブラウザでテスト
test-browser:
	@echo "Opening Chrome extensions page..."
	@echo "Load the extension from: $$(pwd)/$(SRC_DIR)"
	@open "chrome://extensions/"

# バージョンアップ（パッチ）
bump-patch:
	@echo "Bumping patch version..."
	@python3 -c "import json, sys; \
	data = json.load(open('$(SRC_DIR)/manifest.json')); \
	v = data['version'].split('.'); \
	v[2] = str(int(v[2]) + 1); \
	data['version'] = '.'.join(v); \
	json.dump(data, open('$(SRC_DIR)/manifest.json', 'w'), indent=2, ensure_ascii=False)"
	@echo "Version updated to: $$(grep '"version"' $(SRC_DIR)/manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')"

# バージョンアップ（マイナー）
bump-minor:
	@echo "Bumping minor version..."
	@python3 -c "import json, sys; \
	data = json.load(open('$(SRC_DIR)/manifest.json')); \
	v = data['version'].split('.'); \
	v[1] = str(int(v[1]) + 1); v[2] = '0'; \
	data['version'] = '.'.join(v); \
	json.dump(data, open('$(SRC_DIR)/manifest.json', 'w'), indent=2, ensure_ascii=False)"
	@echo "Version updated to: $$(grep '"version"' $(SRC_DIR)/manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')"

# バージョンアップ（メジャー）
bump-major:
	@echo "Bumping major version..."
	@python3 -c "import json, sys; \
	data = json.load(open('$(SRC_DIR)/manifest.json')); \
	v = data['version'].split('.'); \
	v[0] = str(int(v[0]) + 1); v[1] = '0'; v[2] = '0'; \
	data['version'] = '.'.join(v); \
	json.dump(data, open('$(SRC_DIR)/manifest.json', 'w'), indent=2, ensure_ascii=False)"
	@echo "Version updated to: $$(grep '"version"' $(SRC_DIR)/manifest.json | sed 's/.*"version": "\([^"]*\)".*/\1/')"

# バージョンアップしてビルド
release-patch: bump-patch dist
	@echo "Patch release completed!"

release-minor: bump-minor dist  
	@echo "Minor release completed!"

release-major: bump-major dist
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
	@echo "  make build        - Build extension files"
	@echo "  make dist         - Create distribution zip file"
	@echo "  make clean        - Remove build files"
	@echo "  make clean-all    - Remove all generated files"
	@echo "  make validate     - Validate distribution package"
	@echo "  make inspect      - Show distribution package contents"
	@echo ""
	@echo "Version management:"
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