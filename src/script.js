class ImageEditor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentTool = 'rectangle';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
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
        
        this.setupCanvas();
        this.setupEventListeners();
        this.setupToolbar();
    }
    
    setupCanvas() {
        this.canvas.width = Math.min(1200, window.innerWidth - 200);
        this.canvas.height = Math.min(800, window.innerHeight - 100);
        this.redraw();
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
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleCanvasDoubleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cancelCurrentAction();
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedShape) {
                this.deleteSelectedShape();
            }
        });
    }
    
    setupToolbar() {
        const toolButtons = document.querySelectorAll('[data-tool]');
        const colorPicker = document.getElementById('colorPicker');
        const downloadBtn = document.getElementById('downloadBtn');
        const deleteBtn = document.getElementById('deleteBtn');
        const colorButton = document.getElementById('colorButton');
        const strokeButton = document.getElementById('strokeButton');
        const colorPickerPopup = document.getElementById('colorPickerPopup');
        const strokeWidthPopup = document.getElementById('strokeWidthPopup');
        const fontSizePopup = document.getElementById('fontSizePopup');
        const customColorPicker = document.getElementById('customColorPicker');
        const strokeDisplay = document.getElementById('strokeDisplay');
        
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                toolButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTool = btn.dataset.tool;
                this.canvas.style.cursor = 'crosshair';
                
                // 選択を解除（selectツールが削除されたため、常に解除）
                if (this.selectedShape) {
                    this.selectedShape = null;
                    this.redraw();
                }
                
                this.updateStrokeDisplayForTool();
            });
        });
        
        colorPicker.addEventListener('change', (e) => {
            this.currentColor = e.target.value;
            colorButton.style.backgroundColor = e.target.value;
            if (this.selectedShape) {
                this.selectedShape.color = e.target.value;
                this.redraw();
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
        
        // 初期値設定
        this.setStrokeWidth(4); // デフォルトを4pxに設定
        
        // clearBtn要素が削除されているため、この部分を削除
        
        downloadBtn.addEventListener('click', () => this.downloadImage());
        
        deleteBtn.addEventListener('click', () => this.clearCanvas());
        
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
            this.setColor(e.target.value);
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
                this.resizeCanvasToImage(img);
                const dropZone = document.getElementById('dropZone');
                const canvas = document.getElementById('canvas');
                dropZone.classList.add('hidden');
                canvas.classList.add('visible');
                this.redraw();
                this.updateUIForSelectedShape();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    loadImageFromUrl(imageUrl) {
        const img = new Image();
        img.onload = () => {
            this.backgroundImage = img;
            this.resizeCanvasToImage(img);
            const dropZone = document.getElementById('dropZone');
            const canvas = document.getElementById('canvas');
            dropZone.classList.add('hidden');
            canvas.classList.add('visible');
            this.redraw();
            this.updateUIForSelectedShape();
        };
        img.src = imageUrl;
    }
    
    resizeCanvasToImage(img) {
        const maxWidth = Math.min(1200, window.innerWidth - 200);
        const maxHeight = Math.min(800, window.innerHeight - 100);
        
        let { width, height } = img;
        
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        
        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    startDrawing(e) {
        const pos = this.getMousePos(e);
        
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
        const pos = this.getMousePos(e);
        
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
        
        this.redraw();
        this.drawPreview(this.startX, this.startY, pos.x, pos.y);
    }
    
    stopDrawing() {
        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle = null;
            this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
            return;
        }
        
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
            return;
        }
        
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        const currentPos = this.getMousePos(event);
        
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
            }
            
            this.shapes.push(shape);
            this.redraw();
            this.updateUIForSelectedShape();
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
        
        // テキスト入力要素を作成
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'inline-text-input';
        textInput.style.position = 'absolute';
        textInput.style.left = (canvasRect.left + x) + 'px';
        textInput.style.top = (canvasRect.top + y - 10) + 'px';
        textInput.style.border = '1px solid #3498db';
        textInput.style.borderRadius = '4px';
        textInput.style.padding = '4px 8px';
        textInput.style.fontSize = '16px';
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
        
        // テキスト入力要素を作成
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.className = 'inline-text-input';
        textInput.style.position = 'absolute';
        textInput.style.left = (canvasRect.left + textShape.x) + 'px';
        textInput.style.top = (canvasRect.top + textShape.y - 20) + 'px';
        textInput.style.border = '1px solid #3498db';
        textInput.style.borderRadius = '4px';
        textInput.style.padding = '4px 8px';
        textInput.style.fontSize = `${textShape.fontSize || 16}px`;
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
        
        // 矢印の基本サイズ
        const baseWidth = this.strokeWidth * 0.6;
        const maxWidth = this.strokeWidth * 2.8;
        const headLength = Math.min(length * 0.25, 30);
        const headWidth = Math.max(this.strokeWidth * 5, 20);
        
        this.ctx.save();
        this.ctx.fillStyle = this.ctx.strokeStyle;
        
        // 滑らかな矢印の本体を描画
        this.drawTaperedArrowBody(startX, startY, endX, endY, baseWidth, maxWidth, headLength);
        
        // 矢印の先端を描画
        this.drawCurvedArrowHead(endX, endY, angle, headLength, headWidth);
        
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
    
    drawMosaic(startX, startY, endX, endY, blockSize = null) {
        if (!this.backgroundImage) return;
        
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        if (width <= 0 || height <= 0) return;
        
        // モザイクのブロックサイズ（線の太さ設定を使用）
        const mosaicBlockSize = blockSize || (this.strokeWidth * 2);
        
        // 元画像からピクセルデータを取得
        const imageData = this.ctx.getImageData(x, y, width, height);
        const data = imageData.data;
        
        // モザイク処理
        for (let blockY = 0; blockY < height; blockY += mosaicBlockSize) {
            for (let blockX = 0; blockX < width; blockX += mosaicBlockSize) {
                // ブロック内の色の平均を計算
                let r = 0, g = 0, b = 0, a = 0;
                let pixelCount = 0;
                
                const blockWidth = Math.min(mosaicBlockSize, width - blockX);
                const blockHeight = Math.min(mosaicBlockSize, height - blockY);
                
                for (let py = blockY; py < blockY + blockHeight; py++) {
                    for (let px = blockX; px < blockX + blockWidth; px++) {
                        if (px < width && py < height) {
                            const index = (py * width + px) * 4;
                            r += data[index];
                            g += data[index + 1];
                            b += data[index + 2];
                            a += data[index + 3];
                            pixelCount++;
                        }
                    }
                }
                
                if (pixelCount > 0) {
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
                    const padding = 10;
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
                return distance <= 10;
                
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
        link.href = this.canvas.toDataURL();
        link.click();
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
        if (this.isDragging || this.isDrawing || this.isResizing) return;
        
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
    
    setColor(color) {
        this.currentColor = color;
        document.getElementById('colorButton').style.backgroundColor = color;
        document.getElementById('colorPicker').value = color;
        document.getElementById('customColorPicker').value = color;
        
        if (this.selectedShape) {
            this.selectedShape.color = color;
            this.redraw();
        }
        
        this.updateActivePresetColor(color);
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
        }
        
        this.updateActiveStrokeOption(width);
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
        }
        
        // ボタンの表示を更新
        const strokeDisplay = document.getElementById('strokeDisplay');
        strokeDisplay.textContent = fontSize;
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
        this.canvas.width = width;
        this.canvas.height = height;
        this.backgroundImage = null;
        this.shapes = [];
        this.selectedShape = null;
        
        const dropZone = document.getElementById('dropZone');
        const canvas = document.getElementById('canvas');
        dropZone.classList.add('hidden');
        canvas.classList.add('visible');
        
        this.redraw();
        this.updateUIForSelectedShape();
        this.hideCanvasSizeControls();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageEditor();
});