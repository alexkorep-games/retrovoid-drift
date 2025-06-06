// src/hooks/useTouchInput.ts
import { useState, useCallback, useEffect, RefObject, useRef } from "react";
import { ITouchState } from "../game/types";
import { initialTouchState } from "../game/state";
import { GAME_WIDTH, GAME_HEIGHT } from "../game/config";

type UseTouchStateResult = {
  touchState: ITouchState;
  enableTouchTracking: (value: boolean) => void;
  resetKeyboardState: () => void;
};

// Helper function to check if an element or its ancestor is a button
function isEventTargetButton(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  return target.closest("button") !== null;
}

/**
 * Hook to manage touch input state for the game canvas.
 * Attaches listeners to the container element.
 * @param containerRef - Ref object pointing to the Container DIV holding the Konva Stage.
 * @returns The current ITouchState and a function to enable/disable tracking.
 */
export function useTouchInput(
  containerRef: RefObject<HTMLDivElement | null>
): UseTouchStateResult {
  const [touchState, setTouchState] = useState<ITouchState>(initialTouchState);
  const [enabled, setEnabled] = useState(false);

  // Expose a function to reset all keyboard flags
  const resetKeyboardState = useCallback(() => {
    keyboardState.current.up = false;
    keyboardState.current.down = false;
    keyboardState.current.left = false;
    keyboardState.current.right = false;
    keyboardState.current.space = false;
    keyboardState.current.lastMove = { x: 0, y: 0 };
    setTouchState(initialTouchState);
  }, []);

  // --- Keyboard input state ---
  const keyboardState = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    space: false,
    lastMove: { x: 0, y: 0 },
  });

  // Helper: is desktop (not touch device)
  function isDesktop() {
    return (
      !("ontouchstart" in window) && !navigator.userAgent.match(/Mobi|Android/i)
    );
  }
  // Keyboard event handlers
  useEffect(() => {
    if (!enabled || !isDesktop()) return;

    function handleKeyDown(e: KeyboardEvent) {
      let changed = false;
      switch (e.code) {
        case "ArrowUp":
          if (!keyboardState.current.up) {
            keyboardState.current.up = true;
            changed = true;
          }
          break;
        case "ArrowDown":
          if (!keyboardState.current.down) {
            keyboardState.current.down = true;
            changed = true;
          }
          break;
        case "ArrowLeft":
          if (!keyboardState.current.left) {
            keyboardState.current.left = true;
            changed = true;
          }
          break;
        case "ArrowRight":
          if (!keyboardState.current.right) {
            keyboardState.current.right = true;
            changed = true;
          }
          break;
        case "Space":
          if (!keyboardState.current.space) {
            keyboardState.current.space = true;
            changed = true;
          }
          break;
        default:
          break;
      }
      if (changed) updateFromKeyboard();
    }

    function handleKeyUp(e: KeyboardEvent) {
      let changed = false;
      switch (e.code) {
        case "ArrowUp":
          if (keyboardState.current.up) {
            keyboardState.current.up = false;
            changed = true;
          }
          break;
        case "ArrowDown":
          if (keyboardState.current.down) {
            keyboardState.current.down = false;
            changed = true;
          }
          break;
        case "ArrowLeft":
          if (keyboardState.current.left) {
            keyboardState.current.left = false;
            changed = true;
          }
          break;
        case "ArrowRight":
          if (keyboardState.current.right) {
            keyboardState.current.right = false;
            changed = true;
          }
          break;
        case "Space":
          if (keyboardState.current.space) {
            keyboardState.current.space = false;
            changed = true;
          }
          break;
        default:
          break;
      }
      if (changed) updateFromKeyboard();
    }

    function updateFromKeyboard() {
      // Map arrow keys to a virtual joystick direction
      const { up, down, left, right, space } = keyboardState.current;
      let dx = 0,
        dy = 0;
      if (up) dy -= 1;
      if (down) dy += 1;
      if (left) dx -= 1;
      if (right) dx += 1;
      // Normalize
      if (dx !== 0 || dy !== 0) {
        const len = Math.sqrt(dx * dx + dy * dy);
        dx /= len;
        dy /= len;
      }
      // Center of the game area for virtual joystick
      const centerX = GAME_WIDTH / 2;
      const centerY = GAME_HEIGHT / 2;
      const moveRadius = 35; // less than TOUCH_MOVE_MAX_DIST for smoothness
      const moveActive = dx !== 0 || dy !== 0;
      const move = moveActive
        ? {
            active: true,
            id: -1,
            startX: centerX,
            startY: centerY,
            currentX: centerX + dx * moveRadius,
            currentY: centerY + dy * moveRadius,
          }
        : { ...initialTouchState.move };

      // Shooting: spacebar
      const shoot = space
        ? { active: true, id: -1, x: centerX, y: centerY }
        : { ...initialTouchState.shoot };

      setTouchState((prev) => {
        // Only update if changed
        if (
          prev.move.active !== move.active ||
          prev.move.currentX !== move.currentX ||
          prev.move.currentY !== move.currentY ||
          prev.shoot.active !== shoot.active
        ) {
          return { ...prev, move, shoot };
        }
        return prev;
      });
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [enabled]);

  const enableTouchTracking = useCallback((value: boolean) => {
    if (!value) {
      setTouchState(initialTouchState); // Reset state when disabling
    }
    setEnabled(value);
  }, []); // setEnabled and setTouchState are stable

  const getTouchPosition = useCallback(
    (
      touch: Touch,
      container: HTMLDivElement
    ): { x: number; y: number } | null => {
      const rect = container.getBoundingClientRect();
      const stageWidth = GAME_WIDTH;
      const stageHeight = GAME_HEIGHT; // Full Konva stage height
      const containerWidth = rect.width;
      const containerHeight = rect.height;

      const stageAspectRatio = stageWidth / stageHeight;
      const containerAspectRatio = containerWidth / containerHeight;

      let displayedWidth, displayedHeight, displayedX, displayedY;

      if (containerAspectRatio > stageAspectRatio) {
        displayedHeight = containerHeight;
        displayedWidth = displayedHeight * stageAspectRatio;
        displayedX = rect.left + (containerWidth - displayedWidth) / 2;
        displayedY = rect.top;
      } else {
        displayedWidth = containerWidth;
        displayedHeight = displayedWidth / stageAspectRatio;
        displayedX = rect.left;
        displayedY = rect.top + (containerHeight - displayedHeight) / 2;
      }

      if (
        touch.clientX < displayedX ||
        touch.clientX > displayedX + displayedWidth ||
        touch.clientY < displayedY ||
        touch.clientY > displayedY + displayedHeight
      ) {
        return null; // Touch is outside the effective scaled stage bounds
      }

      const relativeX = touch.clientX - displayedX;
      const relativeY = touch.clientY - displayedY;

      const scaleX = stageWidth / displayedWidth;
      const scaleY = stageHeight / displayedHeight;
      const x = relativeX * scaleX;
      const y = relativeY * scaleY;

      // This check is against the full stage size.
      if (x < 0 || x > GAME_WIDTH || y < 0 || y > GAME_HEIGHT) {
        return null;
      }

      return { x, y };
    },
    []
  );

  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      if (!containerRef.current || !enabled) return;
      const container = containerRef.current;

      if (isEventTargetButton(event.target)) {
        return; // Do not interfere with HTML button clicks
      }

      let gameTouchProcessed = false;

      setTouchState((prevState) => {
        // Make mutable copies for this update cycle
        const nextMoveState = { ...prevState.move };
        const nextShootState = { ...prevState.shoot };
        let stateChanged = false;

        for (let i = 0; i < event.changedTouches.length; i++) {
          const touch = event.changedTouches[i];
          const pos = getTouchPosition(touch, container);

          if (!pos) {
            continue;
          }

          gameTouchProcessed = true;

          // If no movement touch is active, this new touch initiates movement.
          if (!nextMoveState.active) {
            nextMoveState.active = true;
            nextMoveState.id = touch.identifier;
            nextMoveState.startX = pos.x;
            nextMoveState.startY = pos.y;
            nextMoveState.currentX = pos.x;
            nextMoveState.currentY = pos.y;
            stateChanged = true;
          }
          // Else if a movement touch IS active, AND this is a *different* touch,
          // AND no shoot touch is active, this new touch initiates shooting.
          else if (
            touch.identifier !== nextMoveState.id &&
            !nextShootState.active
          ) {
            nextShootState.active = true;
            nextShootState.id = touch.identifier;
            nextShootState.x = pos.x;
            nextShootState.y = pos.y;
            stateChanged = true;
          }
        }

        if (stateChanged) {
          return { ...prevState, move: nextMoveState, shoot: nextShootState };
        }
        return prevState;
      });

      if (gameTouchProcessed) {
        event.preventDefault(); // Prevent default actions like scrolling if a game touch was processed
      }
    },
    [containerRef, getTouchPosition, enabled]
  );

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!containerRef.current || !enabled) return;
      const container = containerRef.current;

      let gameTouchMoved = false;

      setTouchState((prevState) => {
        let stateChanged = false;
        let currentMoveState = { ...prevState.move };
        let currentShootState = { ...prevState.shoot };

        for (let i = 0; i < event.changedTouches.length; i++) {
          const touch = event.changedTouches[i];
          const touchId = touch.identifier;

          const isTrackedMoveTouch =
            currentMoveState.active && currentMoveState.id === touchId;
          const isTrackedShootTouch =
            currentShootState.active && currentShootState.id === touchId;

          if (isTrackedMoveTouch || isTrackedShootTouch) {
            gameTouchMoved = true;
            const pos = getTouchPosition(touch, container);

            if (isTrackedMoveTouch) {
              if (!pos) {
                currentMoveState = { ...initialTouchState.move };
                currentShootState = { ...initialTouchState.shoot };
              } else {
                currentMoveState.currentX = pos.x;
                currentMoveState.currentY = pos.y;
              }
              stateChanged = true;
            } else if (isTrackedShootTouch) {
              if (!currentMoveState.active || !pos) {
                currentShootState = { ...initialTouchState.shoot };
              } else {
                currentShootState.x = pos.x;
                currentShootState.y = pos.y;
              }
              stateChanged = true;
            }
          }
        }

        if (stateChanged) {
          return {
            ...prevState,
            move: currentMoveState,
            shoot: currentShootState,
          };
        }
        return prevState;
      });

      if (gameTouchMoved) {
        event.preventDefault();
      }
    },
    [containerRef, getTouchPosition, enabled]
  );

  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      if (!containerRef.current || !enabled) return;

      let gameTouchEnded = false;

      setTouchState((prevState) => {
        let stateChanged = false;
        let currentMoveState = { ...prevState.move };
        let currentShootState = { ...prevState.shoot };

        for (let i = 0; i < event.changedTouches.length; i++) {
          const touch = event.changedTouches[i];
          const touchId = touch.identifier;

          const isEndingMoveTouch =
            currentMoveState.active && currentMoveState.id === touchId;
          const isEndingShootTouch =
            currentShootState.active && currentShootState.id === touchId;

          if (isEndingMoveTouch || isEndingShootTouch) {
            gameTouchEnded = true;
            if (isEndingMoveTouch) {
              currentMoveState = { ...initialTouchState.move };
              currentShootState = { ...initialTouchState.shoot }; // If move ends, shoot also ends
              stateChanged = true;
            } else if (isEndingShootTouch) {
              currentShootState = { ...initialTouchState.shoot };
              stateChanged = true;
            }
          }
        }

        if (stateChanged) {
          return {
            ...prevState,
            move: currentMoveState,
            shoot: currentShootState,
          };
        }
        return prevState;
      });

      if (gameTouchEnded) {
        event.preventDefault();
      }
    },
    [containerRef, enabled]
  );

  useEffect(() => {
    const currentElement = containerRef.current;
    if (!currentElement || !enabled) {
      return;
    }

    const options = { passive: false };

    currentElement.addEventListener("touchstart", handleTouchStart, options);
    currentElement.addEventListener("touchmove", handleTouchMove, options);
    currentElement.addEventListener("touchend", handleTouchEnd, options);
    currentElement.addEventListener("touchcancel", handleTouchEnd, options);

    return () => {
      currentElement.removeEventListener("touchstart", handleTouchStart);
      // TODO If we clean up handleTouchMove, would it interrupt the movement of the ship?
      currentElement.removeEventListener("touchmove", handleTouchMove);
      currentElement.removeEventListener("touchend", handleTouchEnd);
      currentElement.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [
    containerRef,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    enabled,
  ]);

  return {
    touchState,
    enableTouchTracking,
    resetKeyboardState,
  };
}
