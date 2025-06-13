// Utility functions for canvas operations and text recognition

// Download functionality
function downloadCanvas(canvas) {
    const link = document.createElement("a");
    link.download = "drawing.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
}

// Clear canvas functionality
function clearCanvas(ctx, canvas, saveState, updateUndoRedoButtons) {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Create a new history entry for the cleared state
    const history = [canvas.toDataURL()];
    const historyIndex = 0;
    
    // Update button states
    updateUndoRedoButtons();
    
    return { history, historyIndex };
}

// Text recognition functionality
async function recognizeText(canvas, recognizeTextButton, recognizedTextElement) {
    if (recognizeTextButton.disabled) return;
    
    recognizeTextButton.disabled = true;
    
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
        recognizeTextButton.disabled = false;
    }
}

// Copy text functionality
function copyText(text) {
    return navigator.clipboard.writeText(text)
        .then(() => {
            alert("Text copied to clipboard!");
        })
        .catch(err => {
            console.error("Failed to copy text: ", err);
        });
}

// Save drawing functionality
function saveDrawing(canvas) {
    const drawingData = canvas.toDataURL("image/png");
    localStorage.setItem("savedDrawing", drawingData);
    alert("Drawing saved successfully!");
}

// Load saved drawing
function loadSavedDrawing(canvas, ctx, saveState) {
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
}

// Export all utility functions
export {
    downloadCanvas,
    clearCanvas,
    recognizeText,
    copyText,
    saveDrawing,
    loadSavedDrawing
}; 