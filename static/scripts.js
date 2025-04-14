const socket = io();
const canvas = document.getElementById("drawingCanvas");
const ctx = canvas.getContext("2d");
const videoFeed = document.getElementById("videoFeed");
const pointer = document.getElementById("pointer");
const modeToggle = document.getElementById("modeToggle");
const clearButton = document.getElementById("clearButton");
const colorPicker = document.getElementById("colorPicker");
const brushSizeSlider = document.getElementById("brushSizeSlider");
const brushSizeValue = document.getElementById("brushSizeValue");
const undoButton = document.getElementById("undoButton");
const redoButton = document.getElementById("redoButton");
const downloadButton = document.getElementById("downloadButton");
const recognizeTextButton = document.getElementById("recognizeText");
const recognizedTextElement = document.getElementById("recognizedText");
const saveDrawingButton = document.getElementById("saveDrawing");
const copyTextButton = document.getElementById("copyText");
const clearTextButton = document.getElementById("clearText");
const pencilTool = document.getElementById("pencilTool");
const brushTool = document.getElementById("brushTool");
const eraserTool = document.getElementById("eraserTool");
const colorPickerCircle = document.getElementById("colorPickerCircle");
const shapeDetectionToggle = document.getElementById("shapeDetectionToggle");
const gridModeToggle = document.getElementById("gridModeToggle");
const canvasContainer = document.getElementById("canvasContainer");
const gridSize = 20; // Size of grid cells in pixels

// Get all color preset elements
const colorPresets = document.querySelectorAll('.color-preset');

let lastSavedState = null;
let isGridModeEnabled = false;
let lastX = null, lastY = null;
let drawing = false;
let points = [];
let currentMode = "hand";
let currentColor = "#000000";
let currentBrushSize = 5;
let isEraser = false;
let history = [];
let historyIndex = -1;
let isRecognizing = false;
let currentTool = "pencil";
let isShapeDetectionEnabled = false;
let shapePoints = [];

// Add smudging effect variables
let lastPoints = [];
const maxLastPoints = 5;
let smudgeIntensity = 0.3;

// Get canvas position and dimensions for accurate pointer positioning
let canvasRect = canvas.getBoundingClientRect();
let canvasScaleX = canvas.width / canvasRect.width;
let canvasScaleY = canvas.height / canvasRect.height;

// Initialize canvas
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.lineWidth = currentBrushSize;
ctx.strokeStyle = currentColor;

// Save initial canvas state
saveState();

// Update canvas position and scale on window resize
window.addEventListener('resize', updateCanvasMetrics);
function updateCanvasMetrics() {
    canvasRect = canvas.getBoundingClientRect();
    canvasScaleX = canvas.width / canvasRect.width;
    canvasScaleY = canvas.height / canvasRect.height;
}

// Add event listeners to color presets
colorPresets.forEach(preset => {
    preset.addEventListener('click', () => {
        const color = preset.getAttribute('data-color');
        currentColor = color;
        colorPicker.value = color;
        colorPickerCircle.style.setProperty("--current-color", color);
        
        // Reset eraser if active and re-enable shape detection
        if (currentTool === "eraser") {
            eraserTool.classList.remove("active");
            pencilTool.classList.add("active");
            currentTool = "pencil";
            isEraser = false;
            shapeDetectionToggle.disabled = false;
        }
        
        ctx.strokeStyle = currentColor;
    });
});

// Text recognition functionality
recognizeTextButton.addEventListener("click", async () => {
    if (isRecognizing) return;
    
    isRecognizing = true;
    recognizeTextButton.disabled = true;
    recognizeTextButton.textContent = "Recognizing...";
    
    try {
        // Create a temporary canvas with white background
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Fill with white background
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Draw the current canvas content
        tempCtx.drawImage(canvas, 0, 0);
        
        // Convert to image data
        const imageData = tempCanvas.toDataURL('image/png');
        
        // Perform OCR
        const { data: { text } } = await Tesseract.recognize(imageData);
        
        // Display recognized text
        recognizedTextElement.textContent = text.trim();
    } catch (error) {
        console.error('OCR Error:', error);
        recognizedTextElement.textContent = "Error recognizing text. Please try again.";
    } finally {
        isRecognizing = false;
        recognizeTextButton.disabled = false;
        recognizeTextButton.textContent = "Recognize Text";
    }
});

// Clear canvas functionality
clearButton.addEventListener("click", () => {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Reset drawing state
    points = [];
    drawing = false;
    
    // Create a new history entry for the cleared state
    history = [canvas.toDataURL()];
    historyIndex = 0;
    
    // Update button states
    updateUndoRedoButtons();
    
    // Clear recognized text
    recognizedTextElement.textContent = "";
});

// Mode toggle functionality
modeToggle.addEventListener("click", () => {
    currentMode = currentMode === "hand" ? "mouse" : "hand";
    modeToggle.textContent = currentMode === "hand" ? "Hand Gesture Mode" : "Mouse Mode";
    modeToggle.classList.toggle("active");
    pointer.style.display = "none";
});

// Color picker functionality
colorPicker.addEventListener("input", (e) => {
    currentColor = e.target.value;
    colorPickerCircle.style.setProperty("--current-color", currentColor);
    isEraser = false;
    
    if (currentTool === "eraser") {
        eraserTool.classList.remove("active");
        pencilTool.classList.add("active");
        currentTool = "pencil";
        shapeDetectionToggle.disabled = false;
    }
});

// Brush size slider functionality
brushSizeSlider.addEventListener("input", (e) => {
    currentBrushSize = parseInt(e.target.value);
    brushSizeValue.textContent = currentBrushSize;
    ctx.lineWidth = currentBrushSize;
    
    if (currentTool === "eraser" && document.getElementById("eraserPreview")) {
        const eraserPreview = document.getElementById("eraserPreview");
        eraserPreview.style.width = `${currentBrushSize}px`;
        eraserPreview.style.height = `${currentBrushSize}px`;
    }
});

// Shape detection toggle functionality
shapeDetectionToggle.addEventListener("change", () => {
    isShapeDetectionEnabled = shapeDetectionToggle.checked;
    
    // If activating shape detection while eraser is active, prevent it
    if (isShapeDetectionEnabled && currentTool === "eraser") {
        shapeDetectionToggle.checked = false;
        isShapeDetectionEnabled = false;
        alert("Shape detection cannot be used with the eraser tool. Please select a drawing tool first.");
    }
});

// Grid mode toggle functionality
gridModeToggle.addEventListener("change", () => {
    isGridModeEnabled = gridModeToggle.checked;
    if (isGridModeEnabled) {
        drawGrid();
    } else {
        // Redraw canvas without grid
        restoreState();
    }
});

// Mouse drawing functionality
canvas.addEventListener("mousedown", (e) => {
    if (currentMode === "mouse") {
        lastSavedState = canvas.toDataURL();
        drawing = true;
        const rect = canvas.getBoundingClientRect();
        lastX = e.clientX - rect.left;
        lastY = e.clientY - rect.top;
        points = [{ x: lastX, y: lastY }];
        
        if (isEraser) {
            // Erase at the initial point
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(lastX, lastY, currentBrushSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
        }
        
        if (isShapeDetectionEnabled) {
            shapePoints = [{ x: lastX, y: lastY }];
        }
    }
});

canvas.addEventListener("mousemove", (e) => {
    if (currentMode === "mouse") {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Always update eraser preview if in eraser mode
        if (currentTool === "eraser") {
            updateEraserPreview(e);
        }

        if (drawing) {
            points.push({ x, y });
            if (isShapeDetectionEnabled) {
                shapePoints.push({ x, y });
            }
            
            if (isEraser) {
                // Use clearRect for eraser functionality
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(x, y, currentBrushSize / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalCompositeOperation = 'source-over';
            } else if (points.length >= 3) {
                smoothDraw();
            }

            lastX = x;
            lastY = y;
        }
    }
});

// Update eraser preview position - Keep this separate for non-drawing mouse movement
canvas.addEventListener("mousemove", (e) => {
    if (currentMode === "mouse" && currentTool === "eraser" && !drawing) {
        updateEraserPreview(e);
    }
});

canvas.addEventListener("mouseup", () => {
    if (drawing) {
        if (isShapeDetectionEnabled && shapePoints.length > 10) {
            detectAndDrawShape();
        } else {
            saveState();
        }
        lastPoints = [];
    }
    drawing = false;
    points = [];
    shapePoints = [];
});

canvas.addEventListener("mouseout", () => {
    if (drawing) {
        saveState();
        lastPoints = [];
    }
    drawing = false;
    points = [];
    
    // Hide eraser preview
    if (document.getElementById("eraserPreview")) {
        document.getElementById("eraserPreview").style.display = "none";
    }
});

// Undo/Redo functionality
function saveState() {
    // Remove any states after current index
    history = history.slice(0, historyIndex + 1);
    
    // If grid is enabled, temporarily disable it before saving
    if (isGridModeEnabled) {
        const currentState = canvas.toDataURL();
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            history.push(canvas.toDataURL());
            historyIndex++;
            updateUndoRedoButtons();
            // Redraw grid
            drawGrid();
        };
        img.src = currentState;
    } else {
        // Add new state
        history.push(canvas.toDataURL());
        historyIndex++;
        updateUndoRedoButtons();
    }
}

function updateUndoRedoButtons() {
    undoButton.disabled = historyIndex <= 0;
    redoButton.disabled = historyIndex >= history.length - 1;
}

function restoreState() {
    if (historyIndex >= 0 && historyIndex < history.length) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            if (isGridModeEnabled) {
                drawGrid();
            }
        };
        img.src = history[historyIndex];
    }
}

undoButton.addEventListener("click", () => {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState();
        updateUndoRedoButtons();
    }
});

redoButton.addEventListener("click", () => {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreState();
        updateUndoRedoButtons();
    }
});

// Keyboard shortcuts for undo/redo
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey) {
        switch(e.key) {
            case "z":
                if (!e.shiftKey) undoButton.click();
                break;
            case "y":
            case "Z":
                redoButton.click();
                break;
            case "s":
                e.preventDefault();
                saveDrawingButton.click();
                break;
        }
    }
});

// Download functionality
downloadButton.addEventListener("click", () => {
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
});

// Hand gesture drawing functionality
socket.on("hand_data", function(message) {
    if (currentMode !== "hand") return;

    const data = JSON.parse(message);
    if (data.x === null || data.y === null) {
        pointer.style.display = "none";
        if (drawing) {
            if (isShapeDetectionEnabled && shapePoints.length > 10) {
                detectAndDrawShape();
            } else {
                saveState();
            }
        }
        drawing = false;
        points = [];
        shapePoints = [];
        return;
    }

    // Calculate position relative to canvas
    updateCanvasMetrics();
    
    // Map coordinates to canvas dimensions
    const x = data.x * canvas.width;
    const y = data.y * canvas.height;
    const gesture = data.gesture;

    // Position pointer at exact drawing coordinates
    pointer.style.left = `${x}px`;
    pointer.style.top = `${y}px`;
    pointer.style.display = "block";

    if (gesture === "draw") {
        if (!drawing) {
            lastSavedState = canvas.toDataURL();
            points = [];
            if (isShapeDetectionEnabled) {
                shapePoints = [];
            }
        }
        drawing = true;
        points.push({ x, y });
        if (isShapeDetectionEnabled) {
            shapePoints.push({ x, y });
        }
        if (points.length >= 3) {
            smoothDraw();
        }
    } else if (gesture === "erase") {
        if (drawing) {
            saveState();
        }
        drawing = false;
        ctx.clearRect(x - 20, y - 20, 40, 40);
        points = [];
        shapePoints = [];
    } else {
        if (drawing) {
            if (isShapeDetectionEnabled && shapePoints.length > 10) {
                detectAndDrawShape();
            } else {
                saveState();
            }
        }
        drawing = false;
        points = [];
        shapePoints = [];
    }
});

function smoothDraw() {
    if (points.length < 3) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (currentTool === "pencil") {
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }
    } else if (currentTool === "brush") {
        // Store the last few points for smudging
        lastPoints.push({x: points[points.length - 1].x, y: points[points.length - 1].y});
        if (lastPoints.length > maxLastPoints) {
            lastPoints.shift();
        }

        // Draw the main stroke
        for (let i = 1; i < points.length - 1; i++) {
            const midX = (points[i].x + points[i + 1].x) / 2;
            const midY = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
        }

        // Add smudging effect
        if (lastPoints.length > 1) {
            ctx.globalAlpha = smudgeIntensity;
            for (let i = 0; i < lastPoints.length - 1; i++) {
                const start = lastPoints[i];
                const end = lastPoints[i + 1];
                
                // Create a gradient for the smudge
                const gradient = ctx.createLinearGradient(start.x, start.y, end.x, end.y);
                gradient.addColorStop(0, currentColor);
                gradient.addColorStop(1, currentColor);
                
                ctx.strokeStyle = gradient;
                ctx.lineWidth = currentBrushSize * (1 + i * 0.2);
                
                ctx.beginPath();
                ctx.moveTo(start.x, start.y);
                ctx.lineTo(end.x, end.y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }
    }

    ctx.strokeStyle = isEraser ? "#ffffff" : currentColor;
    ctx.lineWidth = currentBrushSize;
    ctx.stroke();
}

socket.on("video_feed", function(image) {
    videoFeed.src = "data:image/jpeg;base64," + image;
});

// Save drawing functionality
saveDrawingButton.addEventListener("click", () => {
    const drawingData = canvas.toDataURL("image/png");
    localStorage.setItem("savedDrawing", drawingData);
    alert("Drawing saved successfully!");
});

// Load saved drawing on page load
window.addEventListener("load", () => {
    const savedDrawing = localStorage.getItem("savedDrawing");
    if (savedDrawing) {
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            saveState();
        };
        img.src = savedDrawing;
    }
    
    // Initialize canvas metrics
    updateCanvasMetrics();
});

// Copy text functionality
copyTextButton.addEventListener("click", () => {
    const text = recognizedTextElement.textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert("Text copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy text: ", err);
    });
});

// Clear text functionality
clearTextButton.addEventListener("click", () => {
    recognizedTextElement.textContent = "";
});

// Drawing tools functionality
pencilTool.addEventListener("click", () => {
    currentTool = "pencil";
    isEraser = false;
    pencilTool.classList.add("active");
    brushTool.classList.remove("active");
    eraserTool.classList.remove("active");
    ctx.strokeStyle = currentColor;
    
    // Re-enable shape detection toggle if it was disabled by eraser
    shapeDetectionToggle.disabled = false;
    
    if (document.getElementById("eraserPreview")) {
        document.getElementById("eraserPreview").style.display = "none";
    }
});

brushTool.addEventListener("click", () => {
    currentTool = "brush";
    isEraser = false;
    brushTool.classList.add("active");
    pencilTool.classList.remove("active");
    eraserTool.classList.remove("active");
    ctx.strokeStyle = currentColor;
    
    // Re-enable shape detection toggle if it was disabled by eraser
    shapeDetectionToggle.disabled = false;
    
    if (document.getElementById("eraserPreview")) {
        document.getElementById("eraserPreview").style.display = "none";
    }
});

eraserTool.addEventListener("click", () => {
    currentTool = "eraser";
    isEraser = true;
    eraserTool.classList.add("active");
    pencilTool.classList.remove("active");
    brushTool.classList.remove("active");
    ctx.strokeStyle = "#ffffff";
    
    // Disable shape detection when eraser is active
    if (isShapeDetectionEnabled) {
        shapeDetectionToggle.checked = false;
        isShapeDetectionEnabled = false;
    }
    shapeDetectionToggle.disabled = true;
});

// Shape detection and drawing functions
function detectAndDrawShape() {
    const shape = detectShape(shapePoints);
    if (shape) {
        // Restore canvas to state before rough drawing
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            
            // Draw the detected shape
            ctx.beginPath();
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = currentBrushSize;
            
            switch(shape.type) {
                case 'circle':
                    drawCircle(shape.center, shape.radius);
                    break;
                case 'rectangle':
                    drawRectangle(shape.start, shape.end);
                    break;
                case 'square':
                    drawSquare(shape.start, shape.end);
                    break;
                case 'triangle':
                    drawTriangle(shape.points);
                    break;
                case 'polygon':
                    drawPolygon(shape.points);
                    break;
                case 'line':
                    drawLine(shape.start, shape.end);
                    break;
            }
            
            ctx.stroke();
            
            // Redraw grid if enabled
            if (isGridModeEnabled) {
                drawGrid();
            }
            
            saveState();
        };
        img.src = lastSavedState;
    } else {
        saveState();
    }
}


function detectShape(points) {
    if (points.length < 10) return null;

    // Simplify points using RDP algorithm with higher tolerance
    const simplifiedPoints = simplify(points, 5, true);
    
    // Calculate basic shape properties
    const bounds = calculateBounds(simplifiedPoints);
    const center = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2
    };

    // Check for closed shapes first
    const isClosed = isShapeClosed(simplifiedPoints);
    
    if (isClosed) {
        // Check for circle
        const circle = detectCircle(simplifiedPoints, center);
        if (circle) return circle;

        // Check for rectangle/square
        const rect = detectRectangle(simplifiedPoints, bounds);
        if (rect) return rect;

        // Check for triangle
        const triangle = detectTriangle(simplifiedPoints);
        if (triangle) return triangle;

        // Check for polygon
        const polygon = detectPolygon(simplifiedPoints);
        if (polygon) return polygon;
    }

    // If not a closed shape, check for line
    const line = detectLine(simplifiedPoints);
    if (line) return line;

    return null;
}

function calculateBounds(points) {
    return {
        minX: Math.min(...points.map(p => p.x)),
        maxX: Math.max(...points.map(p => p.x)),
        minY: Math.min(...points.map(p => p.y)),
        maxY: Math.max(...points.map(p => p.y))
    };
}

function isShapeClosed(points) {
    const start = points[0];
    const end = points[points.length - 1];
    const distance = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    return distance < 30; // Threshold for considering shape closed
}

function detectCircle(points, center) {
    // Calculate distances from center
    const distances = points.map(p => 
        Math.sqrt(Math.pow(p.x - center.x, 2) + Math.pow(p.y - center.y, 2))
    );
    
    const avgDistance = distances.reduce((a, b) => a + b) / distances.length;
    
    // Calculate variance
    const variance = distances.reduce((a, b) => 
        a + Math.pow(b - avgDistance, 2)
    ) / distances.length;
    
    // If variance is low and shape is roughly circular
    if (variance < 500 && isShapeCircular(points, center, avgDistance)) {
        return { 
            type: 'circle', 
            center, 
            radius: avgDistance 
        };
    }
    return null;
}

function isShapeCircular(points, center, radius) {
    // Check if points are roughly equidistant from center
    const angleStep = Math.PI / 8; // Check 8 points around the circle
    let matchedPoints = 0;
    
    for (let angle = 0; angle < Math.PI * 2; angle += angleStep) {
        const x = center.x + radius * Math.cos(angle);
        const y = center.y + radius * Math.sin(angle);
        
        // Check if there's a point near this position
        const hasPoint = points.some(p => 
            Math.sqrt(Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2)) < 20
        );
        
        if (hasPoint) matchedPoints++;
    }
    
    return matchedPoints >= 6; // At least 6 points should match
}

function detectRectangle(points, bounds) {
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    
    // Find corners using angle detection
    const corners = [];
    for (let i = 1; i < points.length - 1; i++) {
        const angle = calculateAngle(
            points[i - 1],
            points[i],
            points[i + 1]
        );
        if (angle < Math.PI * 0.7) { // 126 degrees
            corners.push(points[i]);
        }
    }
    
    // Check if we have approximately 4 corners
    if (corners.length >= 3 && corners.length <= 5) {
        // Check if width and height are similar for square
        if (Math.abs(width - height) < Math.max(width, height) * 0.2) {
            return { 
                type: 'square', 
                start: { x: bounds.minX, y: bounds.minY }, 
                end: { x: bounds.maxX, y: bounds.maxY } 
            };
        }
        return { 
            type: 'rectangle', 
            start: { x: bounds.minX, y: bounds.minY }, 
            end: { x: bounds.maxX, y: bounds.maxY } 
        };
    }
    return null;
}

function detectTriangle(points) {
    // Use RDP to find significant points
    const simplified = simplify(points, 5, true);
    
    if (simplified.length >= 3) {
        // Find three main points that form a triangle
        const angles = [];
        for (let i = 1; i < simplified.length - 1; i++) {
            const angle = calculateAngle(
                simplified[i - 1],
                simplified[i],
                simplified[i + 1]
            );
            angles.push(angle);
        }
        
        const sharpAngles = angles.filter(a => a < Math.PI * 0.7); // 126 degrees
        if (sharpAngles.length >= 2) {
            // Find the three most significant points
            const significantPoints = findSignificantPoints(simplified);
            if (significantPoints.length === 3) {
                return { type: 'triangle', points: significantPoints };
            }
        }
    }
    return null;
}

function detectPolygon(points) {
    // Use RDP to find significant points
    const tolerance = 5; // Adjust this value to control simplification
    const simplified = simplify(points, tolerance, true);
    
    if (simplified.length >= 4) {
        // Find corners using angle detection
        const corners = [];
        for (let i = 1; i < simplified.length - 1; i++) {
            const angle = calculateAngle(
                simplified[i - 1],
                simplified[i],
                simplified[i + 1]
            );
            if (angle < Math.PI * 0.7) { // 126 degrees
                corners.push(simplified[i]);
            }
        }
        
        if (corners.length >= 4) {
            return { type: 'polygon', points: corners };
        }
    }
    return null;
}

function detectLine(points) {
    if (points.length < 2) return null;
    
    // Use first and last points as line endpoints
    const start = points[0];
    const end = points[points.length - 1];
    
    // Calculate line equation: ax + by + c = 0
    const a = end.y - start.y;
    const b = start.x - end.x;
    const c = end.x * start.y - start.x * end.y;
    
    // Calculate maximum distance of any point from the line
    let maxDistance = 0;
    for (const point of points) {
        const distance = Math.abs(a * point.x + b * point.y + c) / 
                        Math.sqrt(a * a + b * b);
        maxDistance = Math.max(maxDistance, distance);
    }
    
    // If all points are close to the line, it's a line
    if (maxDistance < 20) {
        return { type: 'line', start, end };
    }
    
    return null;
}

function findSignificantPoints(points) {
    if (points.length <= 3) return points;
    
    // Find the point with maximum distance from the line between first and last points
    let maxDistance = 0;
    let maxIndex = -1;
    
    const start = points[0];
    const end = points[points.length - 1];
    
    for (let i = 1; i < points.length - 1; i++) {
        const distance = pointToLineDistance(points[i], start, end);
        if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
        }
    }
    
    if (maxDistance > 10) { // Minimum distance threshold
        const left = points.slice(0, maxIndex + 1);
        const right = points.slice(maxIndex);
        
        return [
            start,
            points[maxIndex],
            end
        ];
    }
    
    return [start, end];
}

function pointToLineDistance(point, lineStart, lineEnd) {
    const numerator = Math.abs(
        (lineEnd.y - lineStart.y) * point.x -
        (lineEnd.x - lineStart.x) * point.y +
        lineEnd.x * lineStart.y -
        lineEnd.y * lineStart.x
    );
    
    const denominator = Math.sqrt(
        Math.pow(lineEnd.y - lineStart.y, 2) +
        Math.pow(lineEnd.x - lineStart.x, 2)
    );
    
    return numerator / denominator;
}

function calculateAngle(p1, p2, p3) {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    return Math.acos(dot / (mag1 * mag2));
}

function drawEllipse(center, radiusX, radiusY, rotation) {
    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rotation);
    ctx.scale(radiusX, radiusY);
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.restore();
}

function drawSquare(start, end) {
    const size = Math.max(end.x - start.x, end.y - start.y);
    ctx.rect(start.x, start.y, size, size);
}

function drawPolygon(points) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
}

function drawCircle(center, radius) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
}

function drawRectangle(start, end) {
    ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
}

function drawTriangle(points) {
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.closePath();
}

function drawLine(start, end) {
    // Ensure consistent line drawing
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
}

let gridCanvas = document.createElement('canvas');
gridCanvas.width = canvas.width;
gridCanvas.height = canvas.height;
const gridCtx = gridCanvas.getContext('2d');
let isGridDrawn = false;

function drawGrid() {
    if (!isGridDrawn) {
        // Clear grid canvas
        gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
        
        // Draw grid on separate canvas
        gridCtx.beginPath();
        gridCtx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        gridCtx.lineWidth = 1;

        // Draw vertical lines
        for (let x = 0; x <= gridCanvas.width; x += gridSize) {
            gridCtx.moveTo(x, 0);
            gridCtx.lineTo(x, gridCanvas.height);
        }

        // Draw horizontal lines
        for (let y = 0; y <= gridCanvas.height; y += gridSize) {
            gridCtx.moveTo(0, y);
            gridCtx.lineTo(gridCanvas.width, y);
        }

        gridCtx.stroke();
        isGridDrawn = true;
    }
    
    // Draw grid canvas on main canvas
    ctx.drawImage(gridCanvas, 0, 0);
}

// Update canvas size handling
function updateCanvasSize() {
    // Update grid canvas size
    gridCanvas.width = canvas.width;
    gridCanvas.height = canvas.height;
    isGridDrawn = false; // Reset grid drawn state
    
    // Redraw grid if enabled
    if (isGridModeEnabled) {
        drawGrid();
    }
}

// Add resize observer for canvas
const resizeObserver = new ResizeObserver(updateCanvasSize);
resizeObserver.observe(canvas);

// Declare missing variables
const Tesseract = window.Tesseract;
const simplify = simplifyRDP;

// Ramer–Douglas–Peucker algorithm for line simplification
function simplifyRDP(points, epsilon, highestQuality) {
    const result = simplifyDP(points, epsilon, highestQuality);
    return result;

    function simplifyDP(points, epsilon, highestQuality) {
        let newPoints = points;
        epsilon = (epsilon !== undefined) ? epsilon : 1;
        const sqTolerance = epsilon !== null ? epsilon * epsilon : 1;
        newPoints = _simplifyDP(points, 0, points.length - 1, sqTolerance, newPoints);
        return newPoints;

        function _simplifyDP(points, first, last, sqTolerance, simplified) {
            let maxSqDist = sqTolerance;
            let index = 0;
            for (let i = first + 1; i < last; i++) {
                const sqDist = getSqDist(points[i], points[first], points[last]);
                if (sqDist > maxSqDist) {
                    index = i;
                    maxSqDist = sqDist;
                }
            }
            if (maxSqDist > sqTolerance) {
                if (first < index) {
                    _simplifyDP(points, first, index, sqTolerance, simplified);
                }
                simplified.push(points[index]);
                if (index < last) {
                    _simplifyDP(points, index, last, sqTolerance, simplified);
                }
            }
            return simplified;
        }

        function getSqDist(p, p1, p2) {
            const x = p1.x;
            const y = p1.y;
            let dx = p2.x - x;
            let dy = p2.y - y;
            if (dx !== 0 || dy !== 0) {
                const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
                if (t > 1) {
                    dx = p.x - p2.x;
                    dy = p.y - p2.y;
                } else if (t > 0) {
                    dx = p.x - (x + dx * t);
                    dy = p.y - (y + dy * t);
                }
            } else {
                dx = p.x - x;
                dy = p.y - y;
            }
            return dx * dx + dy * dy;
        }
    }
}

// Add eraser preview on canvas hover
canvas.addEventListener("mouseover", (e) => {
    if (currentMode === "mouse" && currentTool === "eraser") {
        updateEraserPreview(e);
    }
});

// Function to update eraser preview
function updateEraserPreview(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let eraserPreview = document.getElementById("eraserPreview");
    if (!eraserPreview) {
        eraserPreview = document.createElement("div");
        eraserPreview.id = "eraserPreview";
        eraserPreview.style.position = "absolute";
        eraserPreview.style.border = "2px solid #000";
        eraserPreview.style.borderRadius = "50%";
        eraserPreview.style.pointerEvents = "none";
        canvasContainer.appendChild(eraserPreview);
    }
    
    eraserPreview.style.width = `${currentBrushSize}px`;
    eraserPreview.style.height = `${currentBrushSize}px`;
    eraserPreview.style.left = `${x - currentBrushSize / 2}px`;
    eraserPreview.style.top = `${y - currentBrushSize / 2}px`;
    eraserPreview.style.display = currentTool === "eraser" ? "block" : "none";
}