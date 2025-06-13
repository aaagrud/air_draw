// Shape detection and drawing functions
function detectAndDrawShape(shapePoints, ctx, currentColor, currentBrushSize, lastSavedState, isGridModeEnabled, drawGrid, saveState) {
    const shape = detectShape(shapePoints);
    if (shape) {
        // Restore canvas to state before rough drawing
        const img = new Image();
        img.onload = () => {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.drawImage(img, 0, 0);
            
            // Draw the detected shape
            ctx.beginPath();
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = currentBrushSize;
            
            switch(shape.type) {
                case 'circle':
                    drawCircle(shape.center, shape.radius, ctx);
                    break;

                case 'line':
                    drawLine(shape.start, shape.end, ctx);
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

function drawCircle(center, radius, ctx) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
}

function drawLine(start, end, ctx) {
    // Ensure consistent line drawing
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
}

// Export functions for use in other files
export {
    detectAndDrawShape,
    detectShape,
    calculateBounds,
    isShapeClosed,
    detectCircle,
    isShapeCircular,
    detectLine,
    drawCircle,
    drawLine
}; 