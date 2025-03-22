import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, Response
from flask_socketio import SocketIO
import cv2
import mediapipe as mp
import threading
import json
import base64

app = Flask(__name__)
socketio = SocketIO(app, async_mode="eventlet", cors_allowed_origins="*")

mp_hands = mp.solutions.hands
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ ERROR: Cannot open webcam. Try using VideoCapture(1) instead of VideoCapture(0)")
    exit()

def is_pointing(hand_landmarks):
    """Detect if the index finger is pointing (draw mode)."""
    landmarks = hand_landmarks.landmark
    index_tip = landmarks[mp_hands.HandLandmark.INDEX_FINGER_TIP]
    index_mcp = landmarks[mp_hands.HandLandmark.INDEX_FINGER_MCP]

    others_curled = all(
        landmarks[finger_tip].y > landmarks[finger_mcp].y + 0.02
        for finger_tip, finger_mcp in [
            (mp_hands.HandLandmark.MIDDLE_FINGER_TIP, mp_hands.HandLandmark.MIDDLE_FINGER_MCP),
            (mp_hands.HandLandmark.RING_FINGER_TIP, mp_hands.HandLandmark.RING_FINGER_MCP),
            (mp_hands.HandLandmark.PINKY_TIP, mp_hands.HandLandmark.PINKY_MCP)
        ]
    )

    return index_tip.y < index_mcp.y - 0.05 and others_curled

def is_palm_open(hand_landmarks):
    """Detect if the palm is open (erase mode)."""
    landmarks = hand_landmarks.landmark
    fingers_extended = sum(
        landmarks[finger_tip].y < landmarks[finger_mcp].y
        for finger_tip, finger_mcp in [
            (mp_hands.HandLandmark.INDEX_FINGER_TIP, mp_hands.HandLandmark.INDEX_FINGER_MCP),
            (mp_hands.HandLandmark.MIDDLE_FINGER_TIP, mp_hands.HandLandmark.MIDDLE_FINGER_MCP),
            (mp_hands.HandLandmark.RING_FINGER_TIP, mp_hands.HandLandmark.RING_FINGER_MCP),
            (mp_hands.HandLandmark.PINKY_TIP, mp_hands.HandLandmark.PINKY_MCP)
        ]
    )
    return fingers_extended >= 4

def track_hands():
    """Captures hand movement and sends to frontend via WebSockets."""
    with mp_hands.Hands(max_num_hands=1, min_detection_confidence=0.5, min_tracking_confidence=0.5) as hands:
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                continue

            frame = cv2.flip(frame, 1)
            h, w, _ = frame.shape
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = hands.process(frame_rgb)

            gesture = "none"
            index_x, index_y = None, None

            if results.multi_hand_landmarks:
                for hand_landmarks in results.multi_hand_landmarks:
                    index_tip = hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP]
                    index_x, index_y = int(index_tip.x * w), int(index_tip.y * h)

                    if is_palm_open(hand_landmarks):
                        gesture = "erase"
                    elif is_pointing(hand_landmarks):
                        gesture = "draw"

            # Normalize coordinates for frontend canvas
            normalized_x = index_x / w if index_x else None
            normalized_y = index_y / h if index_y else None

            socketio.emit("hand_data", json.dumps({"x": normalized_x, "y": normalized_y, "gesture": gesture}))

            # Send camera feed as base64
            _, buffer = cv2.imencode(".jpg", frame)
            frame_base64 = base64.b64encode(buffer).decode("utf-8")
            socketio.emit("video_feed", frame_base64)

            eventlet.sleep(0.02)  # Lower delay for smoother tracking

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == '__main__':
    tracking_thread = threading.Thread(target=track_hands)
    tracking_thread.daemon = True
    tracking_thread.start()

    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)
