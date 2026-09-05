class ImageEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentTool = 'rectangle';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        // 初期値は一時的に設定（loadSettingsで上書きされる）
        this.currentColor = '#ff0000';
        this.strokeWidth = 4;
        this.fontSize = 16;
        
        this.backgroundImage = null;
        this.shapes = [];
        this.pendingText = null;
        this.selectedShape = null;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.isResizing = false;
        this.resizeHandle = null;
        this.resizeHandles = [];

        this.history = [];
        this.historyIndex = -1;
        this.historyLimit = 50;
        this.isRestoringHistory = false;
        this.backgroundIds = new WeakMap();
        this.nextBackgroundId = 1;

        this.cropSelection = null;
        this.isMovingCrop = false;
        this.cropDragOffsetX = 0;
        this.cropDragOffsetY = 0;

        this.zoom = 1;
        this.fitScale = 1;
        this.minZoom = 0.25;
        this.maxZoom = 8;
        this.panX = 0;
        this.panY = 0;
        this.isPanMode = false;
        this.isPanning = false;
        this.spacePressed = false;
        this.panStartClientX = 0;
        this.panStartClientY = 0;
        this.panStartX = 0;
        this.panStartY = 0;
        
        this.isLoadingSettings = false;
        
        this.setupDevEnvironmentBadge();
        this.setupCanvas();
        this.setupEventListeners();
        this.setupToolbar();
        this.recordHistory();
        
        // 設定読み込みは最後に実行（DOM要素が確実に利用可能になってから）
        setTimeout(() => {
            this.loadSettings();
        }, 500);
    }

    async setupDevEnvironmentBadge() {
        const badge = document.getElementById('devEnvironmentBadge');
        if (!badge) return;

        const environment = await this.getLocalDevelopmentEnvironment();
        if (!environment.isLocalDevelopment) return;

        badge.textContent = environment.label;
        badge.title = environment.description;
        badge.hidden = false;
    }

    async getLocalDevelopmentEnvironment() {
        const { protocol, hostname, search } = window.location;
        const params = new URLSearchParams(search);
        const forcedLocal = params.get('env') === 'local' || params.get('dev') === '1';
        const loopbackHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
        const isLoopback = loopbackHosts.includes(hostname) || hostname.endsWith('.localhost');
        const isFile = protocol === 'file:';

        if (forcedLocal) {
            return {
                isLocalDevelopment: true,
                label: 'LOCAL DEV',
                description: 'Forced local development display'
            };
        }

        if (isLoopback) {
            return {
                isLocalDevelopment: true,
                label: 'LOCAL DEV',
                description: `Local development environment: ${hostname}`
            };
        }

        if (isFile) {
            return {
                isLocalDevelopment: true,
                label: 'LOCAL FILE',
                description: 'Opened from a local file'
            };
        }

        const appEnvironment = window.IMAGE_EDITOO_ENV;
        if (appEnvironment && appEnvironment.localDevelopment) {
            return {
                isLocalDevelopment: true,
                label: appEnvironment.label || '開発版',
                description: appEnvironment.description || 'Local development build'
            };
        }

        return {
            isLocalDevelopment: false,
            label: '',
            description: ''
        };
    }
    
    setupCanvas() {
        this.canvas.width = Math.min(1200, window.innerWidth - 200);
        this.canvas.height = Math.min(800, window.innerHeight - 100);
        this.updateCanvasDisplaySize();
        this.redraw();
    }

    updateCanvasDisplaySize() {
        if (!this.canvas.width || !this.canvas.height) return;

        const container = this.canvas.parentElement;
        const maxWidth = Math.max(100, (container?.clientWidth || window.innerWidth - 200) - 48);
        const maxHeight = Math.max(100, (container?.clientHeight || window.innerHeight - 100) - 48);
        this.fitScale = Math.min(1, maxWidth / this.canvas.width, maxHeight / this.canvas.height);
        const displayScale = this.fitScale * this.zoom;
        const displayWidth = Math.max(1, Math.round(this.canvas.width * displayScale));
        const displayHeight = Math.max(1, Math.round(this.canvas.height * displayScale));

        this.canvas.style.width = `${displayWidth}px`;
        this.canvas.style.height = `${displayHeight}px`;
        this.canvas.style.aspectRatio = `${this.canvas.width} / ${this.canvas.height}`;
        this.canvas.style.setProperty('--pan-x', `${this.panX}px`);
        this.canvas.style.setProperty('--pan-y', `${this.panY}px`);
        this.updateZoomUI();
    }

    updateCanvasTransform() {
        this.canvas.style.setProperty('--pan-x', `${this.panX}px`);
        this.canvas.style.setProperty('--pan-y', `${this.panY}px`);
    }

    setZoom(value, clientX = null, clientY = null) {
        const nextZoom = Math.max(this.minZoom, Math.min(this.maxZoom, value));
        if (Math.abs(nextZoom - this.zoom) < 0.001) return;

        const previousZoom = this.zoom;
        const previousRect = this.canvas.getBoundingClientRect();
        this.zoom = nextZoom;

        if (clientX !== null && clientY !== null && previousRect.width > 0 && previousRect.height > 0) {
            const ratio = nextZoom / previousZoom;
            const distanceFromCenterX = clientX - (previousRect.left + previousRect.width / 2);
            const distanceFromCenterY = clientY - (previousRect.top + previousRect.height / 2);
            this.panX += distanceFromCenterX * (1 - ratio);
            this.panY += distanceFromCenterY * (1 - ratio);
        }

        this.updateCanvasDisplaySize();
    }

    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateCanvasDisplaySize();
    }

    updateZoomUI() {
        const zoomValue = document.getElementById('zoomResetBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const canvasDimensions = document.getElementById('canvasDimensions');
        if (zoomValue) zoomValue.textContent = `${Math.round(this.fitScale * this.zoom * 100)}%`;
        if (zoomInBtn) zoomInBtn.disabled = this.zoom >= this.maxZoom;
        if (zoomOutBtn) zoomOutBtn.disabled = this.zoom <= this.minZoom;
        if (canvasDimensions) {
            canvasDimensions.textContent = `${this.canvas.width} × ${this.canvas.height} px`;
        }
    }

    updateViewControlsVisibility() {
        const visible = this.canvas.classList.contains('visible');
        const zoomControls = document.getElementById('zoomControls');
        if (zoomControls) zoomControls.hidden = !visible;
        this.setCropControlsVisible(this.currentTool === 'crop');
    }

    updateCanvasCursor() {
        const pannable = this.spacePressed || this.isPanMode;
        this.canvas.classList.toggle('is-pannable', pannable && !this.isPanning);
        this.canvas.classList.toggle('is-panning', this.isPanning);

        if (this.isPanning) {
            this.canvas.style.cursor = 'grabbing';
        } else if (pannable) {
            this.canvas.style.cursor = 'grab';
        } else {
            this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
        }
    }

    createHistorySnapshot() {
        return {
            width: this.canvas.width,
            height: this.canvas.height,
            backgroundImage: this.backgroundImage,
            backgroundId: this.getBackgroundId(this.backgroundImage),
            shapes: JSON.parse(JSON.stringify(this.shapes)),
            canvasVisible: this.canvas.classList.contains('visible')
        };
    }

    getSnapshotSignature(snapshot) {
        return JSON.stringify({
            width: snapshot.width,
            height: snapshot.height,
            backgroundId: snapshot.backgroundId,
            shapes: snapshot.shapes,
            canvasVisible: snapshot.canvasVisible
        });
    }

    getBackgroundId(image) {
        if (!image) return 0;
        if (!this.backgroundIds.has(image)) {
            this.backgroundIds.set(image, this.nextBackgroundId++);
        }
        return this.backgroundIds.get(image);
    }

    recordHistory() {
        if (this.isRestoringHistory) return;

        const snapshot = this.createHistorySnapshot();
        snapshot.signature = this.getSnapshotSignature(snapshot);
        const currentSnapshot = this.history[this.historyIndex];
        if (currentSnapshot?.signature === snapshot.signature) {
            this.updateHistoryButtons();
            return;
        }

        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(snapshot);
        if (this.history.length > this.historyLimit) {
            this.history.shift();
        }
        this.historyIndex = this.history.length - 1;
        this.updateHistoryButtons();
    }

    undo() {
        if (this.historyIndex <= 0) return;
        this.historyIndex -= 1;
        this.restoreHistorySnapshot(this.history[this.historyIndex]);
    }

    redo() {
        if (this.historyIndex >= this.history.length - 1) return;
        this.historyIndex += 1;
        this.restoreHistorySnapshot(this.history[this.historyIndex]);
    }

    restoreHistorySnapshot(snapshot) {
        if (!snapshot) return;

        this.isRestoringHistory = true;
        this.cropSelection = null;
        this.isDrawing = false;
        this.isDragging = false;
        this.isResizing = false;
        this.isMovingCrop = false;
        this.selectedShape = null;
        this.canvas.width = snapshot.width;
        this.canvas.height = snapshot.height;
        this.backgroundImage = snapshot.backgroundImage;
        this.shapes = JSON.parse(JSON.stringify(snapshot.shapes));

        const dropZone = document.getElementById('dropZone');
        this.canvas.classList.toggle('visible', snapshot.canvasVisible);
        dropZone?.classList.toggle('hidden', snapshot.canvasVisible);

        this.updateCanvasDisplaySize();
        this.redraw();
        this.updateUIForSelectedShape();
        this.updateCropUI();
        this.updateViewControlsVisibility();
        this.updateHistoryButtons();
        this.isRestoringHistory = false;
    }

    updateHistoryButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
        if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }

    setCropControlsVisible(visible) {
        const controls = document.getElementById('cropControls');
        if (!controls) return;
        controls.hidden = !(visible && this.canvas.classList.contains('visible'));
        if (!controls.hidden) this.updateCropUI();
    }

    updateCropUI() {
        const applyButton = document.getElementById('applyCropBtn');
        const sizeLabel = document.getElementById('cropSize');
        const hasSelection = Boolean(this.cropSelection);
        const hasValidSelection = hasSelection && this.cropSelection.width > 5 && this.cropSelection.height > 5;
        if (applyButton) applyButton.disabled = !hasValidSelection;
        if (sizeLabel) {
            sizeLabel.textContent = hasSelection
                ? `${Math.round(this.cropSelection.width)} × ${Math.round(this.cropSelection.height)} px`
                : '範囲をドラッグして選択';
        }
    }

    getCropSelectionFromPoints(startX, startY, endX, endY, minimumSize = 0) {
        const clampedStartX = Math.max(0, Math.min(this.canvas.width, startX));
        const clampedStartY = Math.max(0, Math.min(this.canvas.height, startY));
        const clampedEndX = Math.max(0, Math.min(this.canvas.width, endX));
        const clampedEndY = Math.max(0, Math.min(this.canvas.height, endY));
        const left = Math.floor(Math.min(clampedStartX, clampedEndX));
        const top = Math.floor(Math.min(clampedStartY, clampedEndY));
        const right = Math.ceil(Math.max(clampedStartX, clampedEndX));
        const bottom = Math.ceil(Math.max(clampedStartY, clampedEndY));
        const width = right - left;
        const height = bottom - top;

        if (width <= minimumSize || height <= minimumSize) return null;
        return { x: left, y: top, width, height };
    }

    isPointInCropSelection(x, y) {
        if (!this.cropSelection) return false;
        return x >= this.cropSelection.x &&
            x <= this.cropSelection.x + this.cropSelection.width &&
            y >= this.cropSelection.y &&
            y <= this.cropSelection.y + this.cropSelection.height;
    }

    cancelCrop() {
        this.cropSelection = null;
        this.isDrawing = false;
        this.isMovingCrop = false;
        this.updateCropUI();
        this.redraw();
    }

    async applyCrop() {
        if (!this.cropSelection) return;

        const left = Math.max(0, Math.floor(this.cropSelection.x));
        const top = Math.max(0, Math.floor(this.cropSelection.y));
        const right = Math.min(this.canvas.width, Math.ceil(this.cropSelection.x + this.cropSelection.width));
        const bottom = Math.min(this.canvas.height, Math.ceil(this.cropSelection.y + this.cropSelection.height));
        const width = right - left;
        const height = bottom - top;
        if (width < 1 || height < 1) return;

        const originalWidth = this.canvas.width;
        const originalHeight = this.canvas.height;
        const croppedBackground = this.backgroundImage
            ? await this.createCroppedBackground(left, top, width, height, originalWidth, originalHeight)
            : null;

        const translatedShapes = this.shapes
            .filter(shape => this.shapeIntersectsRect(shape, left, top, right, bottom))
            .map(shape => this.translateShapeCopy(shape, -left, -top));

        this.canvas.width = width;
        this.canvas.height = height;
        this.backgroundImage = croppedBackground;
        this.shapes = translatedShapes;
        this.selectedShape = null;
        this.cropSelection = null;
        this.isMovingCrop = false;
        this.resetView();
        this.redraw();
        this.updateCropUI();
        this.updateUIForSelectedShape();
        this.recordHistory();
    }

    createCroppedBackground(left, top, width, height, originalWidth, originalHeight) {
        const offscreen = document.createElement('canvas');
        offscreen.width = width;
        offscreen.height = height;
        const context = offscreen.getContext('2d');
        context.drawImage(this.backgroundImage, -left, -top, originalWidth, originalHeight);

        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = offscreen.toDataURL('image/png');
        });
    }

    shapeIntersectsRect(shape, left, top, right, bottom) {
        const bounds = this.getShapeBounds(shape);
        if (!bounds) return false;
        return bounds.maxX >= left && bounds.minX <= right && bounds.maxY >= top && bounds.minY <= bottom;
    }

    translateShapeCopy(shape, deltaX, deltaY) {
        const copy = JSON.parse(JSON.stringify(shape));
        if (copy.type === 'text') {
            copy.x += deltaX;
            copy.y += deltaY;
        } else {
            copy.startX += deltaX;
            copy.startY += deltaY;
            copy.endX += deltaX;
            copy.endY += deltaY;
        }
        return copy;
    }
    
    setupEventListeners() {
        const dropZone = document.getElementById('dropZone');
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                this.loadImage(files[0]);
            }
        });
        
        // クリップボードからの貼り付けイベントリスナー
        document.addEventListener('paste', (e) => this.handlePaste(e));
        
        // フォーカス可能にするためのtabindex設定
        document.body.setAttribute('tabindex', '0');
        
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', (e) => this.stopDrawing(e));
        this.canvas.addEventListener('mouseout', (e) => this.stopDrawing(e));
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleCanvasDoubleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            this.setZoom(this.zoom * factor, e.clientX, e.clientY);
        }, { passive: false });
        
        window.addEventListener('keydown', (e) => {
            const isEditingText = e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement || e.target?.isContentEditable;

            if (!isEditingText && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.redo();
            } else if (!isEditingText && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            } else if (!isEditingText && (e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
                e.preventDefault();
                this.setZoom(this.zoom * 1.25);
            } else if (!isEditingText && (e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                this.setZoom(this.zoom / 1.25);
            } else if (!isEditingText && (e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                this.resetView();
            } else if (!isEditingText && e.code === 'Space') {
                e.preventDefault();
                this.spacePressed = true;
                this.updateCanvasCursor();
            } else if (!isEditingText && e.key === 'Enter' && this.currentTool === 'crop' && this.cropSelection) {
                e.preventDefault();
                this.applyCrop();
            } else if (e.key === 'Escape') {
                if (this.currentTool === 'crop') {
                    this.cancelCrop();
                }
                this.cancelCurrentAction();
            } else if (!isEditingText && (e.key === 'Delete' || e.key === 'Backspace') && this.selectedShape) {
                e.preventDefault();
                this.deleteSelectedShape();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.spacePressed = false;
                if (!this.isPanning) this.updateCanvasCursor();
            }
        });

        window.addEventListener('blur', () => {
            this.spacePressed = false;
            this.isPanning = false;
            this.updateCanvasCursor();
        });

        window.addEventListener('resize', () => {
            this.updateCanvasDisplaySize();
        });
    }
    
    setupToolbar() {
        const toolButtons = document.querySelectorAll('[data-tool]');
        const colorPicker = document.getElementById('colorPicker');
        const copyBtn = document.getElementById('copyBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const colorButton = document.getElementById('colorButton');
        const strokeButton = document.getElementById('strokeButton');
        const colorPickerPopup = document.getElementById('colorPickerPopup');
        const strokeWidthPopup = document.getElementById('strokeWidthPopup');
        const fontSizePopup = document.getElementById('fontSizePopup');
        const customColorPicker = document.getElementById('customColorPicker');
        const strokeDisplay = document.getElementById('strokeDisplay');
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        const panBtn = document.getElementById('panBtn');
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const zoomResetBtn = document.getElementById('zoomResetBtn');
        const applyCropBtn = document.getElementById('applyCropBtn');
        const cancelCropBtn = document.getElementById('cancelCropBtn');
        
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.currentTool === 'crop' && btn.dataset.tool !== 'crop') {
                    this.cancelCrop();
                }
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                console.log('Tool selected:', this.currentTool);
                this.isPanMode = false;
                panBtn?.classList.remove('active');
                
                // 選択を解除（selectツールが削除されたため、常に解除）
                if (this.selectedShape) {
                    this.selectedShape = null;
                    this.redraw();
                }
                
                this.updateStrokeDisplayForTool();
                this.setCropControlsVisible(this.currentTool === 'crop');
                this.updateCanvasCursor();
            });
        });
        
        colorPicker.addEventListener('change', (e) => {
            this.currentColor = e.target.value;
            colorButton.style.backgroundColor = e.target.value;
            if (this.selectedShape) {
                this.selectedShape.color = e.target.value;
                this.redraw();
                this.recordHistory();
            }
            this.updateActivePresetColor(e.target.value);
        });
        
        colorPicker.addEventListener('input', (e) => {
            this.currentColor = e.target.value;
            colorButton.style.backgroundColor = e.target.value;
            if (this.selectedShape) {
                this.selectedShape.color = e.target.value;
                this.redraw();
            }
        });
        
        // ポップアップ内のプリセットカラーとストロークオプション
        this.setupPopupEventListeners();
        
        // 初期値設定（保存された設定がない場合のみ設定）
        // this.setStrokeWidth(4); // loadSettings()で上書きされるため削除
        
        // clearBtn要素が削除されているため、この部分を削除
        
        copyBtn.addEventListener('click', async () => {
            try {
                await this.copyToClipboard();
                // 成功時の視覚フィードバック（ボタンの一時的な変更）
                copyBtn.style.backgroundColor = '#4CAF50';
                setTimeout(() => {
                    copyBtn.style.backgroundColor = '';
                }, 1000);
            } catch (error) {
                alert('Failed to copy image to clipboard. This feature requires HTTPS or localhost.');
            }
        });
        
        downloadBtn.addEventListener('click', () => this.downloadImage());
        
        deleteBtn.addEventListener('click', () => {
            if (this.selectedShape) {
                this.deleteSelectedShape();
            } else {
                this.clearCanvas();
            }
        });

        undoBtn?.addEventListener('click', () => this.undo());
        redoBtn?.addEventListener('click', () => this.redo());
        zoomInBtn?.addEventListener('click', () => this.setZoom(this.zoom * 1.25));
        zoomOutBtn?.addEventListener('click', () => this.setZoom(this.zoom / 1.25));
        zoomResetBtn?.addEventListener('click', () => this.resetView());
        panBtn?.addEventListener('click', () => {
            this.isPanMode = !this.isPanMode;
            panBtn.classList.toggle('active', this.isPanMode);
            this.updateCanvasCursor();
        });
        applyCropBtn?.addEventListener('click', () => this.applyCrop());
        cancelCropBtn?.addEventListener('click', () => this.cancelCrop());
        
        // カスタムカラーボタンのイベントリスナー
        colorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showColorPickerPopup(e.target);
        });
        
        // 太さボタンのイベントリスナー
        strokeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.currentTool === 'text') {
                this.showFontSizePopup(e.target);
            } else {
                this.showStrokeWidthPopup(e.target);
            }
        });
        
        // ポップアップ外クリックで閉じる
        document.addEventListener('click', (e) => {
            if (!colorPickerPopup.contains(e.target) && !colorButton.contains(e.target)) {
                colorPickerPopup.style.display = 'none';
            }
            if (!strokeWidthPopup.contains(e.target) && !strokeButton.contains(e.target)) {
                strokeWidthPopup.style.display = 'none';
            }
            if (!fontSizePopup.contains(e.target) && !strokeButton.contains(e.target)) {
                fontSizePopup.style.display = 'none';
            }
        });
        
        // フォントサイズオプションのイベントリスナー
        const fontSizeOptions = document.querySelectorAll('.font-size-option');
        fontSizeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                const fontSize = parseInt(e.target.dataset.size);
                this.setFontSize(fontSize);
                fontSizePopup.style.display = 'none';
            });
        });
        
        // カスタムカラーピッカーのイベントリスナー
        customColorPicker.addEventListener('change', (e) => {
            this.setColor(e.target.value);
            colorPickerPopup.style.display = 'none';
        });
        
        customColorPicker.addEventListener('input', (e) => {
            this.setColor(e.target.value, false);
        });
        
        
        // Drop zone buttons
        const imageInputDrop = document.getElementById('imageInputDrop');
        const pasteBtnDrop = document.getElementById('pasteBtnDrop');
        const createCanvasBtn = document.getElementById('createCanvasBtn');
        const createCanvasConfirm = document.getElementById('createCanvasConfirm');
        const createCanvasCancel = document.getElementById('createCanvasCancel');
        
        if (imageInputDrop) {
            imageInputDrop.addEventListener('change', (e) => this.handleImageUpload(e));
        }
        
        if (pasteBtnDrop) {
            pasteBtnDrop.addEventListener('click', async () => {
                try {
                    await this.pasteFromClipboard();
                } catch (error) {
                    alert('Could not paste image from clipboard.\nTry copying a screenshot first.');
                }
            });
        }
        
        if (createCanvasBtn) {
            createCanvasBtn.addEventListener('click', () => this.showCanvasSizeControls());
        }
        
        if (createCanvasConfirm) {
            createCanvasConfirm.addEventListener('click', () => this.createNewCanvas());
        }
        
        if (createCanvasCancel) {
            createCanvasCancel.addEventListener('click', () => this.hideCanvasSizeControls());
        }
        
        // Preset size buttons
        const presetSizeBtns = document.querySelectorAll('.preset-size-btn');
        presetSizeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const width = parseInt(btn.dataset.width);
                const height = parseInt(btn.dataset.height);
                this.createCanvasWithSize(width, height);
            });
        });
        
    }
    
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            this.loadImage(file);
        }
    }
    
    loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.backgroundImage = img;
                this.shapes = [];
                this.selectedShape = null;
                this.zoom = 1;
                this.panX = 0;
                this.panY = 0;
                this.resizeCanvasToImage(img);
                const dropZone = document.getElementById('dropZone');
                const canvas = document.getElementById('canvas');
                dropZone.classList.add('hidden');
                canvas.classList.add('visible');
                this.redraw();
                this.updateUIForSelectedShape();
                this.updateViewControlsVisibility();
                this.recordHistory();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    loadImageFromUrl(imageUrl) {
        const img = new Image();
        img.onload = () => {
            this.backgroundImage = img;
            this.shapes = [];
            this.selectedShape = null;
            this.zoom = 1;
            this.panX = 0;
            this.panY = 0;
            this.resizeCanvasToImage(img);
            const dropZone = document.getElementById('dropZone');
            const canvas = document.getElementById('canvas');
            dropZone.classList.add('hidden');
            canvas.classList.add('visible');
            this.redraw();
            this.updateUIForSelectedShape();
            this.updateViewControlsVisibility();
            this.recordHistory();
        };
        img.src = imageUrl;
    }
    
    resizeCanvasToImage(img) {
        this.canvas.width = img.naturalWidth || img.width;
        this.canvas.height = img.naturalHeight || img.height;
        this.updateCanvasDisplaySize();
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }
    
    startDrawing(e) {
        if (this.spacePressed || this.isPanMode || e.button === 1) {
            e.preventDefault();
            this.isPanning = true;
            this.panStartClientX = e.clientX;
            this.panStartClientY = e.clientY;
            this.panStartX = this.panX;
            this.panStartY = this.panY;
            this.updateCanvasCursor();
            return;
        }

        const pos = this.getMousePos(e);

        if (this.currentTool === 'crop') {
            this.selectedShape = null;

            if (this.cropSelection && this.isPointInCropSelection(pos.x, pos.y)) {
                this.isMovingCrop = true;
                this.cropDragOffsetX = pos.x - this.cropSelection.x;
                this.cropDragOffsetY = pos.y - this.cropSelection.y;
                this.canvas.style.cursor = 'grabbing';
                return;
            }

            this.isDrawing = true;
            this.startX = pos.x;
            this.startY = pos.y;
            this.cropSelection = null;
            this.updateCropUI();
            this.redraw();
            return;
        }
        
        // リサイズハンドルのチェック
        if (this.selectedShape) {
            const handle = this.getResizeHandleAt(pos.x, pos.y);
            if (handle) {
                this.isResizing = true;
                this.resizeHandle = handle;
                this.canvas.style.cursor = this.getResizeCursor(handle.type);
                return;
            }
        }
        
        // 既存の選択された図形をチェック（ドラッグ開始）
        if (this.selectedShape && this.isPointInShape(pos.x, pos.y, this.selectedShape)) {
            this.isDragging = true;
            this.dragOffsetX = pos.x - this.getShapeX(this.selectedShape);
            this.dragOffsetY = pos.y - this.getShapeY(this.selectedShape);
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        // 任意のツールで図形をクリックした場合の選択処理
        const clickedShape = this.getShapeAtPosition(pos.x, pos.y);
        if (clickedShape) {
            this.selectedShape = clickedShape;
            this.updateUIForSelectedShape();
            this.redraw();
            
            // 選択後即座にドラッグ開始
            this.isDragging = true;
            this.dragOffsetX = pos.x - this.getShapeX(clickedShape);
            this.dragOffsetY = pos.y - this.getShapeY(clickedShape);
            this.canvas.style.cursor = 'grabbing';
            return;
        }
        
        // 図形がクリックされていない場合は選択解除
        if (this.selectedShape) {
            this.selectedShape = null;
            this.updateUIForSelectedShape();
            this.redraw();
        }
        
        if (this.currentTool === 'text' || this.currentTool === 'select') return;
        
        this.isDrawing = true;
        this.startX = pos.x;
        this.startY = pos.y;
    }
    
    draw(e) {
        if (this.isPanning) {
            this.panX = this.panStartX + (e.clientX - this.panStartClientX);
            this.panY = this.panStartY + (e.clientY - this.panStartClientY);
            this.updateCanvasTransform();
            return;
        }

        const pos = this.getMousePos(e);

        if (this.isMovingCrop && this.cropSelection) {
            const maxX = Math.max(0, this.canvas.width - this.cropSelection.width);
            const maxY = Math.max(0, this.canvas.height - this.cropSelection.height);
            this.cropSelection.x = Math.round(Math.max(0, Math.min(maxX, pos.x - this.cropDragOffsetX)));
            this.cropSelection.y = Math.round(Math.max(0, Math.min(maxY, pos.y - this.cropDragOffsetY)));
            this.updateCropUI();
            this.redraw();
            return;
        }
        
        if (this.isResizing && this.selectedShape && this.resizeHandle) {
            // リサイズ中の場合、選択されたオブジェクトをリサイズ
            this.resizeShape(this.selectedShape, this.resizeHandle, pos.x, pos.y);
            this.redraw();
            return;
        }
        
        if (this.isDragging && this.selectedShape) {
            // ドラッグ中の場合、選択されたオブジェクトを移動
            this.moveShape(this.selectedShape, pos.x - this.dragOffsetX, pos.y - this.dragOffsetY);
            this.redraw();
            return;
        }
        
        if (!this.isDrawing) return;

        if (this.currentTool === 'crop') {
            this.cropSelection = this.getCropSelectionFromPoints(
                this.startX,
                this.startY,
                pos.x,
                pos.y
            );
            this.updateCropUI();
            this.redraw();
            return;
        }
        
        this.redraw();
        this.drawPreview(this.startX, this.startY, pos.x, pos.y);
    }
    
    stopDrawing(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.updateCanvasCursor();
            return;
        }

        if (this.isMovingCrop) {
            this.isMovingCrop = false;
            this.canvas.style.cursor = 'move';
            return;
        }

        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle = null;
            this.updateCanvasCursor();
            this.recordHistory();
            return;
        }
        
        if (this.isDragging) {
            this.isDragging = false;
            this.updateCanvasCursor();
            this.recordHistory();
            return;
        }
        
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        // イベントオブジェクトがない場合は最後の座標を使用
        let currentPos;
        if (e) {
            currentPos = this.getMousePos(e);
        } else {
            // イベントがない場合は描画開始点と同じ点を使用（キャンセル扱い）
            currentPos = { x: this.startX, y: this.startY };
        }

        if (this.currentTool === 'crop') {
            this.cropSelection = this.getCropSelectionFromPoints(
                this.startX,
                this.startY,
                currentPos.x,
                currentPos.y,
                5
            );
            this.updateCropUI();
            this.redraw();
            return;
        }
        
        if (Math.abs(currentPos.x - this.startX) > 5 || Math.abs(currentPos.y - this.startY) > 5) {
            const shape = {
                type: this.currentTool,
                startX: this.startX,
                startY: this.startY,
                endX: currentPos.x,
                endY: currentPos.y,
                color: this.currentColor,
                strokeWidth: this.strokeWidth
            };
            
            // モザイクの場合はブロックサイズを保存
            if (this.currentTool === 'mosaic') {
                shape.blockSize = this.strokeWidth * 2;
                console.log('Mosaic shape created:', shape);
            }
            
            console.log('Shape added:', shape);
            this.shapes.push(shape);
            this.redraw();
            this.updateUIForSelectedShape();
            this.recordHistory();
        }
    }
    
    handleCanvasDoubleClick(e) {
        e.preventDefault();
        const pos = this.getMousePos(e);
        const clickedShape = this.getShapeAtPosition(pos.x, pos.y);
        
        if (clickedShape && clickedShape.type === 'text') {
            this.editTextShape(clickedShape);
        }
    }
    
    handleCanvasClick(e) {
        if (this.currentTool === 'text') {
            const pos = this.getMousePos(e);
            
            // テキストツールでも既存図形をクリックした場合は選択
            const clickedShape = this.getShapeAtPosition(pos.x, pos.y);
            if (clickedShape) {
                this.selectedShape = clickedShape;
                this.updateUIForSelectedShape();
                this.redraw();
                return;
            }
            
            this.createInlineTextInput(pos.x, pos.y);
        }
    }
    
    createInlineTextInput(x, y) {
        // 既存のテキスト入力がある場合は削除
        const existingInput = document.querySelector('.inline-text-input');
        if (existingInput) {
            existingInput.remove();
        }
        
        // キャンバスの位置とスケールを計算
        const canvasRect = this.canvas.getBoundingClientRect();
        const displayScaleX = canvasRect.width / this.canvas.width;
        const displayScaleY = canvasRect.height / this.canvas.height;
        const displayFontSize = Math.max(10, Math.round(this.fontSize * displayScaleY));
        
        // テキスト入力要素を作成
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'inline-text-input';
        textInput.style.position = 'absolute';
        textInput.style.left = (canvasRect.left + x * displayScaleX) + 'px';
        textInput.style.top = (canvasRect.top + (y - 10) * displayScaleY) + 'px';
        textInput.style.border = '1px solid #3498db';
        textInput.style.borderRadius = '4px';
        textInput.style.padding = '4px 8px';
        textInput.style.fontSize = `${displayFontSize}px`;
        textInput.style.fontFamily = 'Arial, sans-serif';
        textInput.style.color = this.currentColor;
        textInput.style.backgroundColor = 'white';
        textInput.style.zIndex = '1000';
        textInput.style.minWidth = '100px';
        textInput.placeholder = 'Enter text';
        
        document.body.appendChild(textInput);
        textInput.focus();
        
        let textAdded = false;
        
        const addText = () => {
            if (textAdded) return;
            const text = textInput.value.trim();
            if (text) {
                const shape = {
                    type: 'text',
                    x: x,
                    y: y,
                    text: text,
                    color: this.currentColor,
                    fontSize: this.fontSize
                };
                this.shapes.push(shape);
                this.redraw();
                this.updateUIForSelectedShape();
                this.recordHistory();
                textAdded = true;
            }
            textInput.remove();
        };
        
        // Enterキーで確定
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                addText();
            } else if (e.key === 'Escape') {
                textAdded = true;
                textInput.remove();
            }
        });
        
        // フォーカスを失った時も確定
        textInput.addEventListener('blur', () => {
            addText();
        });
    }
    
    editTextShape(textShape) {
        // 既存のテキスト入力がある場合は削除
        const existingInput = document.querySelector('.inline-text-input');
        if (existingInput) {
            existingInput.remove();
        }
        
        // キャンバスの位置とスケールを計算
        const canvasRect = this.canvas.getBoundingClientRect();
        const displayScaleX = canvasRect.width / this.canvas.width;
        const displayScaleY = canvasRect.height / this.canvas.height;
        const displayFontSize = Math.max(10, Math.round((textShape.fontSize || 16) * displayScaleY));
        
        // テキスト入力要素を作成
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'inline-text-input';
        textInput.style.position = 'absolute';
        textInput.style.left = (canvasRect.left + textShape.x * displayScaleX) + 'px';
        textInput.style.top = (canvasRect.top + (textShape.y - 20) * displayScaleY) + 'px';
        textInput.style.border = '1px solid #3498db';
        textInput.style.borderRadius = '4px';
        textInput.style.padding = '4px 8px';
        textInput.style.fontSize = `${displayFontSize}px`;
        textInput.style.fontFamily = 'Arial, sans-serif';
        textInput.style.color = textShape.color;
        textInput.style.backgroundColor = 'white';
        textInput.style.zIndex = '1000';
        textInput.style.minWidth = '100px';
        textInput.value = textShape.text;
        
        document.body.appendChild(textInput);
        textInput.focus();
        textInput.select(); // 既存テキストを選択状態にする
        
        let textUpdated = false;
        
        const updateText = () => {
            if (textUpdated) return;
            const text = textInput.value.trim();
            if (text) {
                textShape.text = text;
                this.redraw();
                textUpdated = true;
            } else {
                // テキストが空の場合は図形を削除
                const index = this.shapes.indexOf(textShape);
                if (index > -1) {
                    this.shapes.splice(index, 1);
                    if (this.selectedShape === textShape) {
                        this.selectedShape = null;
                    }
                    this.redraw();
                    this.updateUIForSelectedShape();
                }
                textUpdated = true;
            }
            this.recordHistory();
            textInput.remove();
        };
        
        // Enterキーで確定
        textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                updateText();
            } else if (e.key === 'Escape') {
                textUpdated = true;
                textInput.remove();
            }
        });
        
        // フォーカスを失った時も確定
        textInput.addEventListener('blur', () => {
            updateText();
        });
    }
    
    drawPreview(startX, startY, endX, endY) {
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.strokeWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        switch (this.currentTool) {
            case 'rectangle':
                this.ctx.strokeRect(startX, startY, endX - startX, endY - startY);
                break;
            case 'roundedrectangle':
                this.drawRoundedRect(startX, startY, endX, endY, 20);
                break;
            case 'circle':
                this.drawEllipse(startX, startY, endX, endY);
                break;
            case 'arrow':
                this.drawArrowPreview(startX, startY, endX, endY);
                break;
            case 'mosaic':
                this.drawMosaicPreview(startX, startY, endX, endY);
                break;
            case 'crop':
                this.drawCropOverlay(
                    Math.min(startX, endX),
                    Math.min(startY, endY),
                    Math.abs(endX - startX),
                    Math.abs(endY - startY)
                );
                break;
        }
    }
    
    drawEllipse(startX, startY, endX, endY) {
        const centerX = (startX + endX) / 2;
        const centerY = (startY + endY) / 2;
        const radiusX = Math.abs(endX - startX) / 2;
        const radiusY = Math.abs(endY - startY) / 2;
        
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        this.ctx.stroke();
    }
    
    drawRoundedRect(startX, startY, endX, endY, radius) {
        const width = endX - startX;
        const height = endY - startY;
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const w = Math.abs(width);
        const h = Math.abs(height);
        const r = Math.min(radius, w / 2, h / 2);
        
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
        this.ctx.closePath();
        this.ctx.stroke();
    }
    
    drawArrow(startX, startY, endX, endY) {
        const angle = Math.atan2(endY - startY, endX - startX);
        const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        
        if (length < 10) return; // 短すぎる場合は描画しない
        
        const arrowWidth = this.ctx.lineWidth || this.strokeWidth;
        const tailWidth = Math.max(arrowWidth * 1.4, 6);
        const shaftWidth = Math.max(arrowWidth * 6.5, 22);
        const headLength = Math.min(Math.max(length * 0.28, arrowWidth * 12), length * 0.5, 110);
        const headWidth = Math.max(arrowWidth * 13, shaftWidth * 2.05, 58);
        const headBaseX = length - headLength;
        const tailHalf = tailWidth / 2;
        const shaftHalf = shaftWidth / 2;
        const headHalf = headWidth / 2;
        
        this.ctx.save();
        this.ctx.translate(startX, startY);
        this.ctx.rotate(angle);
        const arrowColor = this.ctx.strokeStyle;
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
        this.ctx.shadowBlur = Math.max(3, arrowWidth * 1.4);
        this.ctx.shadowOffsetX = Math.max(2, arrowWidth * 0.8);
        this.ctx.shadowOffsetY = Math.max(2, arrowWidth * 0.8);
        this.ctx.fillStyle = arrowColor;
        this.ctx.beginPath();

        // Arrow shape spec: the shaft must widen with smooth curves, and the
        // head base must face the shaft like the blue reference arrow.
        this.ctx.moveTo(0, -tailHalf);
        this.ctx.bezierCurveTo(
            headBaseX * 0.35, -tailHalf,
            headBaseX * 0.78, -shaftHalf * 0.72,
            headBaseX, -shaftHalf
        );
        this.ctx.lineTo(headBaseX, -headHalf);
        this.ctx.lineTo(length, 0);
        this.ctx.lineTo(headBaseX, headHalf);
        this.ctx.lineTo(headBaseX, shaftHalf);
        this.ctx.bezierCurveTo(
            headBaseX * 0.78, shaftHalf * 0.72,
            headBaseX * 0.35, tailHalf,
            0, tailHalf
        );
        this.ctx.quadraticCurveTo(-tailHalf, 0, 0, -tailHalf);
        this.ctx.closePath();
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawTaperedArrowBody(startX, startY, endX, endY, baseWidth, maxWidth, headLength) {
        const angle = Math.atan2(endY - startY, endX - startX);
        const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const bodyLength = length - headLength;
        
        if (bodyLength <= 0) return;
        
        // 矢印の本体の終点（先端の基点と一致）
        const bodyEndX = endX - headLength * Math.cos(angle);
        const bodyEndY = endY - headLength * Math.sin(angle);
        
        // 垂直方向のベクトル
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);
        
        this.ctx.beginPath();
        
        // 本体の形状を作成（徐々に太くなる）
        const segments = 20;
        const points = [];
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = startX + t * (bodyEndX - startX);
            const y = startY + t * (bodyEndY - startY);
            
            // 幅を徐々に大きくする（適度な変化）
            const widthProgress = this.easeInCubic(t);
            const currentWidth = baseWidth + (maxWidth - baseWidth) * widthProgress;
            
            const halfWidth = currentWidth / 2;
            
            // 上下の点を計算
            const topX = x + perpX * halfWidth;
            const topY = y + perpY * halfWidth;
            const bottomX = x - perpX * halfWidth;
            const bottomY = y - perpY * halfWidth;
            
            points.push({ top: { x: topX, y: topY }, bottom: { x: bottomX, y: bottomY } });
        }
        
        // 上側の曲線を描画
        this.ctx.moveTo(points[0].top.x, points[0].top.y);
        for (let i = 1; i < points.length; i++) {
            const cp1x = points[i-1].top.x + (points[i].top.x - points[i-1].top.x) * 0.5;
            const cp1y = points[i-1].top.y + (points[i].top.y - points[i-1].top.y) * 0.5;
            this.ctx.quadraticCurveTo(cp1x, cp1y, points[i].top.x, points[i].top.y);
        }
        
        // 下側の曲線を描画（逆順）
        for (let i = points.length - 1; i >= 0; i--) {
            if (i === points.length - 1) {
                this.ctx.lineTo(points[i].bottom.x, points[i].bottom.y);
            } else {
                const cp1x = points[i+1].bottom.x + (points[i].bottom.x - points[i+1].bottom.x) * 0.5;
                const cp1y = points[i+1].bottom.y + (points[i].bottom.y - points[i+1].bottom.y) * 0.5;
                this.ctx.quadraticCurveTo(cp1x, cp1y, points[i].bottom.x, points[i].bottom.y);
            }
        }
        
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    drawCurvedArrowHead(endX, endY, angle, headLength, headWidth) {
        // 垂直方向のベクトル
        const perpX = -Math.sin(angle);
        const perpY = Math.cos(angle);
        
        // 矢印先端の基点（本体の終端と一致させる）
        const baseX = endX - headLength * Math.cos(angle);
        const baseY = endY - headLength * Math.sin(angle);
        
        // シンプルな三角形の矢印先端
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY); // 先端
        
        // 左の角
        const leftX = baseX + perpX * headWidth / 2;
        const leftY = baseY + perpY * headWidth / 2;
        this.ctx.lineTo(leftX, leftY);
        
        // 右の角
        const rightX = baseX - perpX * headWidth / 2;
        const rightY = baseY - perpY * headWidth / 2;
        this.ctx.lineTo(rightX, rightY);
        
        // 先端に戻る
        this.ctx.lineTo(endX, endY);
        
        this.ctx.closePath();
        this.ctx.fill();
    }
    
    // イージング関数：適度な変化（3次関数）
    easeInCubic(t) {
        return t * t * t;
    }
    
    // イージング関数：遅い変化（4次関数）
    easeInQuart(t) {
        return t * t * t * t;
    }
    
    // イージング関数：より滑らかな変化
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    // イージング関数：徐々に加速
    easeOutQuad(t) {
        return 1 - (1 - t) * (1 - t);
    }
    
    drawArrowPreview(startX, startY, endX, endY) {
        // プレビュー時は少し透明にして視認性を向上
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        this.drawArrow(startX, startY, endX, endY);
        this.ctx.restore();
    }
    
    drawMosaicPreview(startX, startY, endX, endY) {
        // プレビューでは透明な四角形の枠のみ表示
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(startX, startY, endX - startX, endY - startY);
        this.ctx.setLineDash([]);
    }

    drawCropOverlay(x, y, width, height) {
        if (width <= 0 || height <= 0) return;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.rect(x, y, width, height);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        this.ctx.fill('evenodd');
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = Math.max(1, 2 / (this.fitScale * this.zoom));
        this.ctx.setLineDash([8, 5]);
        this.ctx.strokeRect(x, y, width, height);
        this.ctx.restore();
    }
    
    drawMosaic(startX, startY, endX, endY, blockSize = null) {
        console.log('drawMosaic called:', { startX, startY, endX, endY, blockSize });
        
        // キャンバスに何も描画されていない場合（背景画像も図形もない場合）はモザイクを適用できない
        if (!this.backgroundImage && this.shapes.length === 0) {
            console.log('No content to apply mosaic to');
            return;
        }
        
        // getImageData は整数ピクセルを返すため、表示倍率から生じる小数座標を
        // 先にキャンバスのピクセル境界へ揃える。
        const x = Math.max(0, Math.floor(Math.min(startX, endX)));
        const y = Math.max(0, Math.floor(Math.min(startY, endY)));
        const right = Math.min(this.canvas.width, Math.ceil(Math.max(startX, endX)));
        const bottom = Math.min(this.canvas.height, Math.ceil(Math.max(startY, endY)));
        const width = right - x;
        const height = bottom - y;
        
        if (width <= 0 || height <= 0) return;
        
        // モザイクのブロックサイズ（線の太さ設定を使用）
        const mosaicBlockSize = Math.max(2, blockSize || (this.strokeWidth * 2));
        
        // 現在のキャンバスの状態からピクセルデータを取得
        let imageData;
        try {
            imageData = this.ctx.getImageData(x, y, width, height);
        } catch (error) {
            console.error('Failed to get image data for mosaic:', error);
            return;
        }
        const data = imageData.data;
        const imageWidth = imageData.width;
        const imageHeight = imageData.height;
        
        // モザイク処理
        for (let blockY = 0; blockY < imageHeight; blockY += mosaicBlockSize) {
            for (let blockX = 0; blockX < imageWidth; blockX += mosaicBlockSize) {
                // ブロック内の色の平均を計算
                let r = 0, g = 0, b = 0, a = 0;
                let pixelCount = 0;
                
                const blockWidth = Math.min(mosaicBlockSize, imageWidth - blockX);
                const blockHeight = Math.min(mosaicBlockSize, imageHeight - blockY);
                
                // ブロック内のピクセルを走査
                for (let py = blockY; py < blockY + blockHeight; py++) {
                    for (let px = blockX; px < blockX + blockWidth; px++) {
                        const index = (py * imageWidth + px) * 4;
                        r += data[index];
                        g += data[index + 1];
                        b += data[index + 2];
                        a += data[index + 3];
                        pixelCount++;
                    }
                }
                
                if (pixelCount > 0) {
                    // 平均色を計算
                    r = Math.floor(r / pixelCount);
                    g = Math.floor(g / pixelCount);
                    b = Math.floor(b / pixelCount);
                    a = Math.floor(a / pixelCount);
                    
                    // ブロック全体を平均色で塗りつぶし
                    this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
                    this.ctx.fillRect(x + blockX, y + blockY, blockWidth, blockHeight);
                }
            }
        }
    }
    
    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (this.backgroundImage) {
            this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.shapes.forEach(shape => {
            this.ctx.strokeStyle = shape.color;
            this.ctx.fillStyle = shape.color;
            this.ctx.lineWidth = shape.strokeWidth || this.strokeWidth;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            
            switch (shape.type) {
                case 'rectangle':
                    this.ctx.strokeRect(shape.startX, shape.startY, shape.endX - shape.startX, shape.endY - shape.startY);
                    break;
                case 'roundedrectangle':
                    this.drawRoundedRect(shape.startX, shape.startY, shape.endX, shape.endY, 20);
                    break;
                case 'circle':
                    this.drawEllipse(shape.startX, shape.startY, shape.endX, shape.endY);
                    break;
                case 'arrow':
                    this.drawArrow(shape.startX, shape.startY, shape.endX, shape.endY);
                    break;
                case 'mosaic':
                    this.drawMosaic(shape.startX, shape.startY, shape.endX, shape.endY, shape.blockSize);
                    break;
                case 'text':
                    this.ctx.font = `${shape.fontSize || 20}px Arial`;
                    this.ctx.fillText(shape.text, shape.x, shape.y);
                    break;
            }
        });
        
        // 選択された図形のハイライト表示
        if (this.selectedShape) {
            this.ctx.save();
            this.ctx.strokeStyle = '#007acc';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            
            switch (this.selectedShape.type) {
                case 'rectangle':
                case 'roundedrectangle':
                case 'mosaic':
                    this.ctx.strokeRect(
                        this.selectedShape.startX - 5, 
                        this.selectedShape.startY - 5, 
                        this.selectedShape.endX - this.selectedShape.startX + 10, 
                        this.selectedShape.endY - this.selectedShape.startY + 10
                    );
                    break;
                case 'circle':
                    const minX = Math.min(this.selectedShape.startX, this.selectedShape.endX) - 5;
                    const minY = Math.min(this.selectedShape.startY, this.selectedShape.endY) - 5;
                    const width = Math.abs(this.selectedShape.endX - this.selectedShape.startX) + 10;
                    const height = Math.abs(this.selectedShape.endY - this.selectedShape.startY) + 10;
                    this.ctx.strokeRect(minX, minY, width, height);
                    break;
                case 'arrow':
                    const padding = Math.max(20, (this.selectedShape.strokeWidth || this.strokeWidth) * 12);
                    const minArrowX = Math.min(this.selectedShape.startX, this.selectedShape.endX) - padding;
                    const minArrowY = Math.min(this.selectedShape.startY, this.selectedShape.endY) - padding;
                    const arrowWidth = Math.abs(this.selectedShape.endX - this.selectedShape.startX) + 2 * padding;
                    const arrowHeight = Math.abs(this.selectedShape.endY - this.selectedShape.startY) + 2 * padding;
                    this.ctx.strokeRect(minArrowX, minArrowY, arrowWidth, arrowHeight);
                    break;
                case 'text':
                    this.ctx.font = `${this.selectedShape.fontSize || 20}px Arial`;
                    const textMetrics = this.ctx.measureText(this.selectedShape.text);
                    this.ctx.strokeRect(
                        this.selectedShape.x - 5, 
                        this.selectedShape.y - 25, 
                        textMetrics.width + 10, 
                        30
                    );
                    break;
            }
            this.ctx.restore();
            
            // リサイズハンドルを描画
            this.drawResizeHandles();
        }

        if (this.currentTool === 'crop' && this.cropSelection) {
            this.drawCropOverlay(
                this.cropSelection.x,
                this.cropSelection.y,
                this.cropSelection.width,
                this.cropSelection.height
            );
        }
    }
    
    drawResizeHandles() {
        if (!this.selectedShape) return;
        
        const bounds = this.getShapeBounds(this.selectedShape);
        if (!bounds) return;
        
        this.resizeHandles = [
            { type: 'nw', x: bounds.minX, y: bounds.minY },
            { type: 'n', x: bounds.centerX, y: bounds.minY },
            { type: 'ne', x: bounds.maxX, y: bounds.minY },
            { type: 'e', x: bounds.maxX, y: bounds.centerY },
            { type: 'se', x: bounds.maxX, y: bounds.maxY },
            { type: 's', x: bounds.centerX, y: bounds.maxY },
            { type: 'sw', x: bounds.minX, y: bounds.maxY },
            { type: 'w', x: bounds.minX, y: bounds.centerY }
        ];
        
        this.ctx.save();
        this.ctx.fillStyle = '#007acc';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        
        this.resizeHandles.forEach(handle => {
            this.ctx.fillRect(handle.x - 4, handle.y - 4, 8, 8);
            this.ctx.strokeRect(handle.x - 4, handle.y - 4, 8, 8);
        });
        
        this.ctx.restore();
    }
    
    getShapeBounds(shape) {
        switch (shape.type) {
            case 'rectangle':
            case 'roundedrectangle':
            case 'circle':
            case 'mosaic':
                const minX = Math.min(shape.startX, shape.endX);
                const maxX = Math.max(shape.startX, shape.endX);
                const minY = Math.min(shape.startY, shape.endY);
                const maxY = Math.max(shape.startY, shape.endY);
                return {
                    minX, maxX, minY, maxY,
                    centerX: (minX + maxX) / 2,
                    centerY: (minY + maxY) / 2
                };
            case 'arrow':
                const arrowMinX = Math.min(shape.startX, shape.endX);
                const arrowMaxX = Math.max(shape.startX, shape.endX);
                const arrowMinY = Math.min(shape.startY, shape.endY);
                const arrowMaxY = Math.max(shape.startY, shape.endY);
                return {
                    minX: arrowMinX, maxX: arrowMaxX, minY: arrowMinY, maxY: arrowMaxY,
                    centerX: (arrowMinX + arrowMaxX) / 2,
                    centerY: (arrowMinY + arrowMaxY) / 2
                };
            case 'text':
                this.ctx.font = `${shape.fontSize || 20}px Arial`;
                const textMetrics = this.ctx.measureText(shape.text);
                return {
                    minX: shape.x, maxX: shape.x + textMetrics.width,
                    minY: shape.y - 20, maxY: shape.y + 5,
                    centerX: shape.x + textMetrics.width / 2,
                    centerY: shape.y - 7.5
                };
            default:
                return null;
        }
    }
    
    selectShapeAt(x, y) {
        this.selectedShape = null;
        
        // 後ろから前の順序で図形をチェック（最前面の図形を選択）
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
            if (this.isPointInShape(x, y, shape)) {
                this.selectedShape = shape;
                this.updateUIForSelectedShape();
                this.redraw();
                return;
            }
        }
        
        // 何も選択されなかった場合
        this.updateUIForSelectedShape();
        this.redraw();
    }
    
    isPointInShape(x, y, shape) {
        switch (shape.type) {
            case 'rectangle':
            case 'roundedrectangle':
            case 'mosaic':
                const minX = Math.min(shape.startX, shape.endX);
                const maxX = Math.max(shape.startX, shape.endX);
                const minY = Math.min(shape.startY, shape.endY);
                const maxY = Math.max(shape.startY, shape.endY);
                return x >= minX && x <= maxX && y >= minY && y <= maxY;
                
            case 'circle':
                const centerX = (shape.startX + shape.endX) / 2;
                const centerY = (shape.startY + shape.endY) / 2;
                const radiusX = Math.abs(shape.endX - shape.startX) / 2;
                const radiusY = Math.abs(shape.endY - shape.startY) / 2;
                const dx = (x - centerX) / radiusX;
                const dy = (y - centerY) / radiusY;
                return dx * dx + dy * dy <= 1;
                
            case 'arrow':
                // 矢印の近似的な当たり判定（線分の周辺）
                const distance = this.pointToLineDistance(x, y, shape.startX, shape.startY, shape.endX, shape.endY);
                return distance <= Math.max(16, (shape.strokeWidth || this.strokeWidth) * 9);
                
            case 'text':
                // テキストの概算的な当たり判定
                this.ctx.font = `${shape.fontSize || 20}px Arial`;
                const textMetrics = this.ctx.measureText(shape.text);
                return x >= shape.x && x <= shape.x + textMetrics.width && 
                       y >= shape.y - 20 && y <= shape.y + 5;
                       
            default:
                return false;
        }
    }
    
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B);
        
        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));
        
        const xx = x1 + param * C;
        const yy = y1 + param * D;
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    updateUIForSelectedShape() {
        const colorPicker = document.getElementById('colorPicker');
        const copyBtn = document.getElementById('copyBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const colorButton = document.getElementById('colorButton');
        const strokeDisplay = document.getElementById('strokeDisplay');
        
        if (this.selectedShape) {
            // 選択された図形の色をUIに反映
            colorPicker.value = this.selectedShape.color;
            colorButton.style.backgroundColor = this.selectedShape.color;
            this.currentColor = this.selectedShape.color;
            this.updateActivePresetColor(this.selectedShape.color);
            
            // テキストの場合はフォントサイズ、モザイクの場合はブロックサイズ、それ以外は線の太さを反映
            if (this.selectedShape.type === 'text') {
                const fontSize = this.selectedShape.fontSize || this.fontSize;
                if (strokeDisplay) {
                    strokeDisplay.textContent = fontSize;
                }
                this.fontSize = fontSize;
                this.updateActiveFontSizeOption(fontSize);
            } else if (this.selectedShape.type === 'mosaic') {
                const blockSize = this.selectedShape.blockSize || (this.strokeWidth * 2);
                const strokeWidth = blockSize / 2; // ブロックサイズから線の太さを逆算
                if (strokeDisplay) {
                    strokeDisplay.textContent = blockSize;
                }
                this.strokeWidth = strokeWidth;
                this.updateActiveStrokeOption(strokeWidth);
            } else {
                const width = this.selectedShape.strokeWidth || this.strokeWidth;
                if (strokeDisplay) {
                    strokeDisplay.textContent = width;
                }
                this.strokeWidth = width;
                this.updateActiveStrokeOption(width);
            }
            
            deleteBtn.disabled = false;
        } else {
            // キャンバスが表示されていれば削除ボタンを有効にする
            const canvas = document.getElementById('canvas');
            const isCanvasVisible = canvas.classList.contains('visible');
            deleteBtn.disabled = !isCanvasVisible;
        }
        
        // コピーボタンはキャンバスが表示されているかどうかで制御
        const canvas = document.getElementById('canvas');
        const isCanvasVisible = canvas.classList.contains('visible');
        copyBtn.disabled = !isCanvasVisible;
    }
    
    updateActivePresetColor(color) {
        const presetColors = document.querySelectorAll('.preset-color');
        presetColors.forEach(colorDiv => {
            if (colorDiv.dataset.color === color) {
                colorDiv.classList.add('active');
            } else {
                colorDiv.classList.remove('active');
            }
        });
    }
    
    downloadImage() {
        const link = document.createElement('a');
        link.download = 'edited-image.png';
        const restoreGuides = this.hideEditingGuides();
        try {
            link.href = this.canvas.toDataURL('image/png');
        } finally {
            restoreGuides();
        }
        link.click();
    }

    async copyToClipboard() {
        try {
            if (!navigator.clipboard || !navigator.clipboard.write) {
                throw new Error('Clipboard API not supported');
            }

            const restoreGuides = this.hideEditingGuides();
            let blob;
            try {
                blob = await new Promise((resolve, reject) => {
                    this.canvas.toBlob(result => {
                        if (result) resolve(result);
                        else reject(new Error('Could not encode canvas'));
                    }, 'image/png');
                });
            } finally {
                restoreGuides();
            }
            const item = new ClipboardItem({ [blob.type]: blob });
            await navigator.clipboard.write([item]);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            throw error;
        }
    }

    hideEditingGuides() {
        const selectedShape = this.selectedShape;
        const cropSelection = this.cropSelection;
        this.selectedShape = null;
        this.cropSelection = null;
        this.redraw();

        return () => {
            this.selectedShape = selectedShape;
            this.cropSelection = cropSelection;
            this.redraw();
        };
    }
    
    cancelCurrentAction() {
        this.isDrawing = false;
        this.pendingText = null;
        this.redraw();
    }
    
    async handlePaste(e) {
        // テキスト入力中の場合は通常の貼り付け動作を許可
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        e.preventDefault();
        
        if (!navigator.clipboard || !navigator.clipboard.read) {
            // 古いブラウザの場合、clipboardDataを使用
            const items = e.clipboardData?.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.startsWith('image/')) {
                        const file = items[i].getAsFile();
                        if (file) {
                            this.loadImage(file);
                            return;
                        }
                    }
                }
            }
            return;
        }
        
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);
                        this.loadImage(blob);
                        return;
                    }
                }
            }
            // 画像が見つからない場合の通知
            console.log('クリップボードに画像が見つかりませんでした');
        } catch (error) {
            console.error('クリップボードの読み取りに失敗しました:', error);
        }
    }
    
    async pasteFromClipboard() {
        if (!navigator.clipboard || !navigator.clipboard.read) {
            throw new Error('This browser does not support clipboard functionality');
        }
        
        try {
            const clipboardItems = await navigator.clipboard.read();
            let imageFound = false;
            
            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);
                        this.loadImage(blob);
                        imageFound = true;
                        return;
                    }
                }
            }
            
            if (!imageFound) {
                throw new Error('No image found in clipboard. Try copying an image or taking a screenshot first.');
            }
        } catch (error) {
            console.error('Clipboard read error:', error);
            if (error.name === 'NotAllowedError') {
                throw new Error('Clipboard access denied. Please allow clipboard access and try again.');
            }
            throw new Error('Could not paste image from clipboard. Try copying an image first.');
        }
    }
    
    deleteSelectedShape() {
        if (this.selectedShape) {
            const index = this.shapes.indexOf(this.selectedShape);
            if (index > -1) {
                this.shapes.splice(index, 1);
                this.selectedShape = null;
                this.updateUIForSelectedShape();
                this.redraw();
                this.recordHistory();
            }
        }
    }
    
    clearCanvas() {
        // キャンバスが表示されている場合は削除可能
        const canvas = document.getElementById('canvas');
        const isCanvasVisible = canvas.classList.contains('visible');
        
        if (isCanvasVisible) {
            const confirmed = confirm('Are you sure you want to clear the entire canvas?');
            if (confirmed) {
                this.shapes = [];
                this.selectedShape = null;
                this.backgroundImage = null;
                this.updateUIForSelectedShape();
                this.redraw();
                
                // キャンバスを非表示にしてDrop zoneを再表示
                const dropZone = document.getElementById('dropZone');
                dropZone.classList.remove('hidden');
                canvas.classList.remove('visible');
                this.cancelCrop();
                this.resetView();
                this.updateViewControlsVisibility();
                this.recordHistory();
            }
        }
    }
    
    getShapeX(shape) {
        switch (shape.type) {
            case 'rectangle':
            case 'roundedrectangle':
            case 'circle':
            case 'mosaic':
                return Math.min(shape.startX, shape.endX);
            case 'arrow':
                return shape.startX;
            case 'text':
                return shape.x;
            default:
                return 0;
        }
    }
    
    getShapeY(shape) {
        switch (shape.type) {
            case 'rectangle':
            case 'roundedrectangle':
            case 'circle':
            case 'mosaic':
                return Math.min(shape.startY, shape.endY);
            case 'arrow':
                return shape.startY;
            case 'text':
                return shape.y;
            default:
                return 0;
        }
    }
    
    moveShape(shape, newX, newY) {
        const oldX = this.getShapeX(shape);
        const oldY = this.getShapeY(shape);
        const deltaX = newX - oldX;
        const deltaY = newY - oldY;
        
        switch (shape.type) {
            case 'rectangle':
            case 'roundedrectangle':
            case 'circle':
            case 'mosaic':
                shape.startX += deltaX;
                shape.startY += deltaY;
                shape.endX += deltaX;
                shape.endY += deltaY;
                break;
            case 'arrow':
                shape.startX += deltaX;
                shape.startY += deltaY;
                shape.endX += deltaX;
                shape.endY += deltaY;
                break;
            case 'text':
                shape.x += deltaX;
                shape.y += deltaY;
                break;
        }
    }
    
    getShapeAtPosition(x, y) {
        // 後ろから前の順序で図形をチェック（最前面の図形を選択）
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
            if (this.isPointInShape(x, y, shape)) {
                return shape;
            }
        }
        return null;
    }
    
    handleMouseMove(e) {
        if (this.isDragging || this.isDrawing || this.isResizing || this.isMovingCrop) return;

        if (this.spacePressed || this.isPanMode || this.isPanning) {
            this.updateCanvasCursor();
            return;
        }

        if (this.currentTool === 'crop') {
            const pos = this.getMousePos(e);
            this.canvas.style.cursor = this.isPointInCropSelection(pos.x, pos.y) ? 'move' : 'crosshair';
            return;
        }
        
        const pos = this.getMousePos(e);
        
        // リサイズハンドルのチェック
        if (this.selectedShape) {
            const handle = this.getResizeHandleAt(pos.x, pos.y);
            if (handle) {
                this.canvas.style.cursor = this.getResizeCursor(handle.type);
                return;
            }
        }
        
        const shape = this.getShapeAtPosition(pos.x, pos.y);
        
        if (shape) {
            this.canvas.style.cursor = 'grab';
        } else {
            this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
        }
    }
    
    getResizeHandleAt(x, y) {
        const tolerance = 6;
        return this.resizeHandles.find(handle => 
            Math.abs(x - handle.x) <= tolerance && Math.abs(y - handle.y) <= tolerance
        );
    }
    
    getResizeCursor(handleType) {
        switch (handleType) {
            case 'nw':
            case 'se':
                return 'nw-resize';
            case 'ne':
            case 'sw':
                return 'ne-resize';
            case 'n':
            case 's':
                return 'n-resize';
            case 'e':
            case 'w':
                return 'e-resize';
            default:
                return 'default';
        }
    }
    
    resizeShape(shape, handle, mouseX, mouseY) {
        switch (shape.type) {
            case 'rectangle':
            case 'roundedrectangle':
            case 'circle':
            case 'mosaic':
                this.resizeRectangularShape(shape, handle, mouseX, mouseY);
                break;
            case 'arrow':
                this.resizeArrowShape(shape, handle, mouseX, mouseY);
                break;
            case 'text':
                // テキストはフォントサイズで調整するため、後で実装
                break;
        }
    }
    
    resizeRectangularShape(shape, handle, mouseX, mouseY) {
        const minSize = 10;
        
        switch (handle.type) {
            case 'nw':
                if (mouseX < shape.endX - minSize) shape.startX = mouseX;
                if (mouseY < shape.endY - minSize) shape.startY = mouseY;
                break;
            case 'n':
                if (mouseY < shape.endY - minSize) shape.startY = mouseY;
                break;
            case 'ne':
                if (mouseX > shape.startX + minSize) shape.endX = mouseX;
                if (mouseY < shape.endY - minSize) shape.startY = mouseY;
                break;
            case 'e':
                if (mouseX > shape.startX + minSize) shape.endX = mouseX;
                break;
            case 'se':
                if (mouseX > shape.startX + minSize) shape.endX = mouseX;
                if (mouseY > shape.startY + minSize) shape.endY = mouseY;
                break;
            case 's':
                if (mouseY > shape.startY + minSize) shape.endY = mouseY;
                break;
            case 'sw':
                if (mouseX < shape.endX - minSize) shape.startX = mouseX;
                if (mouseY > shape.startY + minSize) shape.endY = mouseY;
                break;
            case 'w':
                if (mouseX < shape.endX - minSize) shape.startX = mouseX;
                break;
        }
    }
    
    resizeArrowShape(shape, handle, mouseX, mouseY) {
        switch (handle.type) {
            case 'nw':
            case 'n':
            case 'ne':
                // 矢印の始点を調整
                shape.startX = mouseX;
                shape.startY = mouseY;
                break;
            case 'se':
            case 's':
            case 'sw':
                // 矢印の終点を調整
                shape.endX = mouseX;
                shape.endY = mouseY;
                break;
            case 'e':
                shape.endX = mouseX;
                break;
            case 'w':
                shape.startX = mouseX;
                break;
        }
    }
    
    setupPopupEventListeners() {
        // プリセットカラーのイベントリスナー
        const presetColors = document.querySelectorAll('.preset-color');
        presetColors.forEach(colorDiv => {
            colorDiv.addEventListener('click', () => {
                this.setColor(colorDiv.dataset.color);
                document.getElementById('colorPickerPopup').style.display = 'none';
            });
        });
        
        // ストロークオプションのイベントリスナー
        const strokeOptions = document.querySelectorAll('.stroke-option');
        strokeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const width = parseInt(option.dataset.width);
                this.setStrokeWidth(width);
                document.getElementById('strokeWidthPopup').style.display = 'none';
            });
        });
    }
    
    setColor(color, recordChange = true) {
        this.currentColor = color;
        document.getElementById('colorButton').style.backgroundColor = color;
        document.getElementById('colorPicker').value = color;
        document.getElementById('customColorPicker').value = color;
        
        if (this.selectedShape) {
            this.selectedShape.color = color;
            this.redraw();
            if (recordChange) this.recordHistory();
        }
        
        this.updateActivePresetColor(color);
        this.saveSettings();
    }
    
    setStrokeWidth(width) {
        this.strokeWidth = width;
        const strokeDisplay = document.getElementById('strokeDisplay');
        if (strokeDisplay) {
            strokeDisplay.textContent = width;
        }
        
        if (this.selectedShape) {
            if (this.selectedShape.type === 'mosaic') {
                // モザイクの場合はブロックサイズを更新
                this.selectedShape.blockSize = width * 2;
            } else {
                this.selectedShape.strokeWidth = width;
            }
            this.redraw();
            this.recordHistory();
        }
        
        this.updateActiveStrokeOption(width);
        this.saveSettings();
    }
    
    updateActiveStrokeOption(width) {
        const strokeOptions = document.querySelectorAll('.stroke-option');
        strokeOptions.forEach(option => {
            if (parseInt(option.dataset.width) === width) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }
    
    updateActiveFontSizeOption(fontSize) {
        const fontSizeOptions = document.querySelectorAll('.font-size-option');
        fontSizeOptions.forEach(option => {
            if (parseInt(option.dataset.size) === fontSize) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }
    
    showColorPickerPopup(button) {
        const popup = document.getElementById('colorPickerPopup');
        const rect = button.getBoundingClientRect();
        
        // ポップアップを表示
        popup.style.display = 'block';
        
        // サイドバーの右側に表示（左側に隠れないように）
        const leftPosition = rect.right + 10;
        const topPosition = rect.top;
        
        popup.style.left = leftPosition + 'px';
        popup.style.top = topPosition + 'px';
        
        // 画面外に出る場合の調整
        setTimeout(() => {
            const popupRect = popup.getBoundingClientRect();
            
            // 右端が画面外に出る場合は左に移動
            if (popupRect.right > window.innerWidth) {
                popup.style.left = (window.innerWidth - popupRect.width - 10) + 'px';
            }
            
            // 下端が画面外に出る場合は上に移動
            if (popupRect.bottom > window.innerHeight) {
                popup.style.top = (window.innerHeight - popupRect.height - 10) + 'px';
            }
            
            // 左端がサイドバーに隠れる場合は最低位置を設定
            const minLeft = 90; // サイドバーの幅 + 少しの余白
            if (popupRect.left < minLeft) {
                popup.style.left = minLeft + 'px';
            }
        }, 0);
    }
    
    showStrokeWidthPopup(button) {
        const popup = document.getElementById('strokeWidthPopup');
        const rect = button.getBoundingClientRect();
        
        // ポップアップを表示
        popup.style.display = 'block';
        
        // サイドバーの右側に表示
        const leftPosition = rect.right + 10;
        const topPosition = rect.top;
        
        popup.style.left = leftPosition + 'px';
        popup.style.top = topPosition + 'px';
        
        // 画面外に出る場合の調整
        setTimeout(() => {
            const popupRect = popup.getBoundingClientRect();
            
            // 右端が画面外に出る場合は左に移動
            if (popupRect.right > window.innerWidth) {
                popup.style.left = (window.innerWidth - popupRect.width - 10) + 'px';
            }
            
            // 下端が画面外に出る場合は上に移動
            if (popupRect.bottom > window.innerHeight) {
                popup.style.top = (window.innerHeight - popupRect.height - 10) + 'px';
            }
            
            // 左端がサイドバーに隠れる場合は最低位置を設定
            const minLeft = 90; // サイドバーの幅 + 少しの余白
            if (popupRect.left < minLeft) {
                popup.style.left = minLeft + 'px';
            }
        }, 0);
    }
    
    showFontSizePopup(button) {
        const popup = document.getElementById('fontSizePopup');
        const rect = button.getBoundingClientRect();
        
        // ポップアップを表示
        popup.style.display = 'block';
        
        // サイドバーの右側に表示
        const leftPosition = rect.right + 10;
        const topPosition = rect.top;
        
        popup.style.left = leftPosition + 'px';
        popup.style.top = topPosition + 'px';
        
        // 画面外に出る場合の調整
        setTimeout(() => {
            const popupRect = popup.getBoundingClientRect();
            
            // 右端が画面外に出る場合は左に移動
            if (popupRect.right > window.innerWidth) {
                popup.style.left = (window.innerWidth - popupRect.width - 10) + 'px';
            }
            
            // 下端が画面外に出る場合は上に移動
            if (popupRect.bottom > window.innerHeight) {
                popup.style.top = (window.innerHeight - popupRect.height - 10) + 'px';
            }
            
            // 左端がサイドバーに隠れる場合は最低位置を設定
            const minLeft = 90; // サイドバーの幅 + 少しの余白
            if (popupRect.left < minLeft) {
                popup.style.left = minLeft + 'px';
            }
        }, 0);
    }
    
    setFontSize(fontSize) {
        this.fontSize = fontSize;
        
        // 選択されたフォントサイズオプションをハイライト
        const fontSizeOptions = document.querySelectorAll('.font-size-option');
        fontSizeOptions.forEach(option => {
            option.classList.remove('active');
            if (parseInt(option.dataset.size) === fontSize) {
                option.classList.add('active');
            }
        });
        
        // 選択されたテキストのフォントサイズを変更
        if (this.selectedShape && this.selectedShape.type === 'text') {
            this.selectedShape.fontSize = fontSize;
            this.redraw();
            this.recordHistory();
        }
        
        // ボタンの表示を更新
        const strokeDisplay = document.getElementById('strokeDisplay');
        strokeDisplay.textContent = fontSize;
        
        this.saveSettings();
    }
    
    updateStrokeDisplayForTool() {
        const strokeDisplay = document.getElementById('strokeDisplay');
        if (this.currentTool === 'text') {
            strokeDisplay.textContent = this.fontSize;
        } else if (this.currentTool === 'mosaic') {
            strokeDisplay.textContent = this.strokeWidth * 2; // モザイクブロックサイズ表示
        } else {
            strokeDisplay.textContent = this.strokeWidth;
        }
    }
    
    showCanvasSizeControls() {
        const initialActions = document.querySelector('.initial-actions');
        const canvasSizeControls = document.getElementById('canvasSizeControls');
        
        initialActions.style.display = 'none';
        canvasSizeControls.style.display = 'block';
    }
    
    hideCanvasSizeControls() {
        const initialActions = document.querySelector('.initial-actions');
        const canvasSizeControls = document.getElementById('canvasSizeControls');
        
        initialActions.style.display = 'flex';
        canvasSizeControls.style.display = 'none';
    }
    
    createNewCanvas() {
        const widthInput = document.getElementById('canvasWidth');
        const heightInput = document.getElementById('canvasHeight');
        
        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);
        
        if (width < 100 || width > 2000 || height < 100 || height > 2000) {
            alert('Canvas size must be between 100x100 and 2000x2000 pixels.');
            return;
        }
        
        this.createCanvasWithSize(width, height);
    }
    
    createCanvasWithSize(width, height) {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.canvas.width = width;
        this.canvas.height = height;
        this.updateCanvasDisplaySize();
        this.backgroundImage = null;
        this.shapes = [];
        this.selectedShape = null;
        
        const dropZone = document.getElementById('dropZone');
        const canvas = document.getElementById('canvas');
        dropZone.classList.add('hidden');
        canvas.classList.add('visible');
        
        this.redraw();
        this.updateUIForSelectedShape();
        this.updateViewControlsVisibility();
        this.hideCanvasSizeControls();
        this.recordHistory();
    }
    
    // 設定の保存
    saveSettings() {
        if (this.isLoadingSettings) {
            return;
        }
        
        const settings = {
            currentColor: this.currentColor,
            strokeWidth: this.strokeWidth,
            fontSize: this.fontSize
        };
        localStorage.setItem('imageEditor_settings', JSON.stringify(settings));
    }
    
    // 設定の読み込み
    loadSettings() {
        this.isLoadingSettings = true;
        
        try {
            const savedSettings = localStorage.getItem('imageEditor_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                
                // 色設定を復元
                if (settings.currentColor) {
                    this.currentColor = settings.currentColor;
                    const colorButton = document.getElementById('colorButton');
                    const colorPicker = document.getElementById('colorPicker');
                    const customColorPicker = document.getElementById('customColorPicker');
                    
                    if (colorButton) colorButton.style.backgroundColor = settings.currentColor;
                    if (colorPicker) colorPicker.value = settings.currentColor;
                    if (customColorPicker) customColorPicker.value = settings.currentColor;
                    
                    this.updateActivePresetColor(settings.currentColor);
                }
                
                // 線の太さを復元
                if (settings.strokeWidth) {
                    this.strokeWidth = settings.strokeWidth;
                    const strokeDisplay = document.getElementById('strokeDisplay');
                    if (strokeDisplay) strokeDisplay.textContent = settings.strokeWidth;
                    this.updateActiveStrokeOption(settings.strokeWidth);
                }
                
                // フォントサイズを復元
                if (settings.fontSize) {
                    this.fontSize = settings.fontSize;
                    this.updateActiveFontSizeOption(settings.fontSize);
                }
                
                // UIを更新
                this.updateStrokeDisplayForTool();
            } else {
                // 保存された設定がない場合のデフォルト値を設定
                this.currentColor = '#ff0000';
                this.strokeWidth = 4;
                this.fontSize = 16;
                
                // UIにデフォルト値を反映
                const colorButton = document.getElementById('colorButton');
                const colorPicker = document.getElementById('colorPicker');
                const customColorPicker = document.getElementById('customColorPicker');
                const strokeDisplay = document.getElementById('strokeDisplay');
                
                if (colorButton) colorButton.style.backgroundColor = this.currentColor;
                if (colorPicker) colorPicker.value = this.currentColor;
                if (customColorPicker) customColorPicker.value = this.currentColor;
                if (strokeDisplay) strokeDisplay.textContent = this.strokeWidth;
                
                this.updateActivePresetColor(this.currentColor);
                this.updateActiveStrokeOption(this.strokeWidth);
                this.updateActiveFontSizeOption(this.fontSize);
                this.updateStrokeDisplayForTool();
            }
        } catch (error) {
            console.error('設定の読み込みに失敗しました:', error);
        } finally {
            this.isLoadingSettings = false;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageEditor();
});
