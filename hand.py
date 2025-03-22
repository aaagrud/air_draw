import cv2
import mediapipe as mp
import numpy as np

mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_hands = mp.solutions.hands

# Initialize drawing variables
drawing = False  # Tracks whether to draw
drawing_canvas = None  # Persistent canvas
last_position = None  # Stores the last position of the index finger tip

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

# Initialize webcam
cap = cv2.VideoCapture(0)

# Initialize MediaPipe Hands
with mp_hands.Hands(
    max_num_hands=1,
    model_complexity=0,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5) as hands:
    
    while cap.isOpened():
        success, image = cap.read()
        if not success:
            print("Ignoring empty camera frame.")
            continue

        # Flip the image horizontally
        image = cv2.flip(image, 1)

        # Initialize persistent drawing canvas if not already
        if drawing_canvas is None:
            drawing_canvas = np.zeros_like(image, dtype=np.uint8)

        # Convert the image to RGB and process it with MediaPipe Hands
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = hands.process(image_rgb)

        # Convert back to BGR for OpenCV display
        image.flags.writeable = True
        image = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR)

        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                # Get hand position in pixels
                h, w, _ = image.shape
                index_tip_x = int(hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP].x * w)
                index_tip_y = int(hand_landmarks.landmark[mp_hands.HandLandmark.INDEX_FINGER_TIP].y * h)
                
                palm_x = int(hand_landmarks.landmark[mp_hands.HandLandmark.WRIST].x * w)
                palm_y = int(hand_landmarks.landmark[mp_hands.HandLandmark.WRIST].y * h)

                # Check for gestures
                if is_palm_open(hand_landmarks):
                    cv2.putText(image, 'Erasing Mode', (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2, cv2.LINE_AA)
                    # Create an eraser effect
                    cv2.circle(drawing_canvas, (palm_x, palm_y), 50, (0, 0, 0), -1)

                elif is_fist(hand_landmarks):
                    cv2.putText(image, 'Rest Mode', (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2, cv2.LINE_AA)
                    drawing = False  # Stop drawing, but keep strokes

                elif is_pointing(hand_landmarks):
                    cv2.putText(image, 'Draw Mode', (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 0, 0), 2, cv2.LINE_AA)
                    drawing = True  # Start drawing

                # If in Draw Mode, draw on the canvas
                if drawing and last_position is not None:
                    cv2.line(drawing_canvas, last_position, (index_tip_x, index_tip_y), (100, 149, 237), 5)

                last_position = (index_tip_x, index_tip_y) if drawing else None

                # Draw hand landmarks and connections
                mp_drawing.draw_landmarks(
                    image,
                    hand_landmarks,
                    mp_hands.HAND_CONNECTIONS,
                    mp_drawing_styles.get_default_hand_landmarks_style(),
                    mp_drawing_styles.get_default_hand_connections_style())

        # Ensure the strokes remain opaque by overlaying properly
        drawing_canvas_gray = cv2.cvtColor(drawing_canvas, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(drawing_canvas_gray, 1, 255, cv2.THRESH_BINARY)
        mask_inv = cv2.bitwise_not(mask)

        # Preserve drawn strokes properly
        img_bg = cv2.bitwise_and(image, image, mask=mask_inv)
        strokes_fg = cv2.bitwise_and(drawing_canvas, drawing_canvas, mask=mask)
        image = cv2.add(img_bg, strokes_fg)

        # Display the image with annotations
        cv2.imshow('Hand Drawing', image)

        # Break the loop if 'Esc' is pressed
        if cv2.waitKey(5) & 0xFF == 27:
            break

cap.release()
cv2.destroyAllWindows()
