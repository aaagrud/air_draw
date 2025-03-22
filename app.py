import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template
from flask_socketio import SocketIO
import cv2
import mediapipe as mp
import threading
import json

app = Flask(__name__)
socketio = SocketIO(app, async_mode="eventlet", cors_allowed_origins="*")

mp_hands = mp.solutions.hands
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ ERROR: Cannot open webcam. Try using VideoCapture(1) instead of VideoCapture(0)")
    exit()

def is_pointing(hand_landmarks):
    """Detects if the index finger is pointing (drawing mode)."""
    landmarks = hand_landmarks.landmark
    index_tip = landmarks[mp_hands.HandLandmark.INDEX_FINGER_TIP]
    index_mcp = landmarks[mp_hands.HandLandmark.INDEX_FINGER_MCP]

    other_finger_tips = [
        landmarks[mp_hands.HandLandmark.MIDDLE_FINGER_TIP],
        landmarks[mp_hands.HandLandmark.RING_FINGER_TIP],
        landmarks[mp_hands.HandLandmark.PINKY_TIP]
    ]
    other_finger_mcps = [
        landmarks[mp_hands.HandLandmark.MIDDLE_FINGER_MCP],
        landmarks[mp_hands.HandLandmark.RING_FINGER_MCP],
        landmarks[mp_hands.HandLandmark.PINKY_MCP]
    ]

    index_extended = index_tip.y < index_mcp.y - 0.05
    others_fully_curled = all(tip.y > mcp.y + 0.02 for tip, mcp in zip(other_finger_tips, other_finger_mcps))
    index_above_others = all(index_tip.y < tip.y - 0.02 for tip in other_finger_tips)

    return index_extended and others_fully_curled and index_above_others


def is_palm_open(hand_landmarks):
    """Detects if the palm is open (erase mode)."""
    landmarks = hand_landmarks.landmark
    fingers = [
        (mp_hands.HandLandmark.INDEX_FINGER_TIP, mp_hands.HandLandmark.INDEX_FINGER_MCP),
        (mp_hands.HandLandmark.MIDDLE_FINGER_TIP, mp_hands.HandLandmark.MIDDLE_FINGER_MCP),
        (mp_hands.HandLandmark.RING_FINGER_TIP, mp_hands.HandLandmark.RING_FINGER_MCP),
        (mp_hands.HandLandmark.PINKY_TIP, mp_hands.HandLandmark.PINKY_MCP)
    ]
    open_fingers = sum(1 for tip, mcp in fingers if landmarks[tip].y < landmarks[mcp].y)
    return open_fingers >= 4

def is_fist(hand_landmarks):
    """Detects if the hand is in a fist (rest mode)."""
    landmarks = hand_landmarks.landmark
    fingers = [
        (mp_hands.HandLandmark.INDEX_FINGER_TIP, mp_hands.HandLandmark.INDEX_FINGER_MCP),
        (mp_hands.HandLandmark.MIDDLE_FINGER_TIP, mp_hands.HandLandmark.MIDDLE_FINGER_MCP),
        (mp_hands.HandLandmark.RING_FINGER_TIP, mp_hands.HandLandmark.RING_FINGER_MCP),
        (mp_hands.HandLandmark.PINKY_TIP, mp_hands.HandLandmark.PINKY_MCP)
    ]
    curled_fingers = sum(1 for tip, mcp in fingers if landmarks[tip].y > landmarks[mcp].y)
    return curled_fingers >= 4

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
            eventlet.sleep(0.05)  # Prevents CPU overuse

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == '__main__':
    # Start tracking in a background thread only when running directly
    tracking_thread = threading.Thread(target=track_hands)
    tracking_thread.daemon = True
    tracking_thread.start()

    socketio.run(app, host="0.0.0.0", port=5000, allow_unsafe_werkzeug=True)