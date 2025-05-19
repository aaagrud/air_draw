# airDRAW

## Introduction

airDRAW is a web-based application enabling real-time hand gesture-based drawing and text recognition.  It uses a webcam feed for hand tracking and gesture recognition, allowing users to draw and interact with a canvas using hand movements. The application also incorporates drawing tools, shape detection, grid support, and an OCR system.

## Problem Statement / Idea

The project aims to provide an intuitive and accessible way to draw and interact with a digital canvas using natural hand gestures. The goal is to create an application that allows users to create art and enhance productivity using only hand movements. The application also includes features such as text recognition to improve user’s workflow.

## Features

*   **Hand Gesture-Based Drawing:** Draw, erase, and control drawing with hand gestures.
*   **Drawing Tools:** Pencil, brush, and eraser.
*   **Color Selection:** Choose from a color palette to set the drawing colors.
*   **Brush Size Control:** Adjust the brush size for drawing.
*   **Undo/Redo Functionality:** Enables undo and redo actions for drawing changes.
*   **Clear Canvas:** Clears the entire drawing canvas.
*   **Shape Detection:** Recognizes and draws shapes (circles, rectangles, triangles, polygons, and lines).
*   **Grid Mode:** Provides a grid overlay for the canvas.
*   **Text Recognition (OCR):** Converts drawn content to text using Tesseract.js.
*   **Save/Load Drawings:** Saves and loads drawings to/from local storage and can download the canvas as a PNG image.
*   **Real-time Communication:** Implies features for real-time interaction.
*   **Dark Mode:** Can switch the app between a dark and light theme.
*   **Responsive Design:** App adapts to different screen sizes.
*   **Keyboard Shortcuts:** Allows keyboard shortcuts.
*   **Drawing and Tool State management:** Enables saving and loading of previous states.

## Tech Stack

*   **Languages:** Python, JavaScript, HTML, CSS
*   **Frontend Libraries:**
    *   Canvas API
    *   Socket.IO
    *   Tesseract.js
    *   simplify-js
*   **Backend Frameworks/Libraries:**
    *   Flask
    *   Flask-SocketIO
    *   eventlet
    *   OpenCV (cv2)
    *   MediaPipe
    *   NumPy
*   **Other Tools:**
    *   CSS variables
    *   Flexbox
    *   Ramer–Douglas–Peucker Algorithm (implementation for simplifying lines)
