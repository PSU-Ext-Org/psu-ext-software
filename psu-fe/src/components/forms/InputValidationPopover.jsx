/**
 * Copyright 2026 The PSU-EXT Authors
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Small validation popover displayed above a related input.
 *
 * @param {{
 *   align?: "left" | "right",
 *   anchorRef?: import("react").RefObject<HTMLElement | null>,
 *   className?: string,
 *   message?: string,
 *   portal?: boolean,
 * }} props
 * @returns {import("react").ReactElement | null}
 */
export function InputValidationPopover({
  align = "right",
  anchorRef = null,
  className = "",
  message = "",
  portal = false,
}) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    if (!portal || !message || !anchorRef?.current) {
      setPosition(null);
      return undefined;
    }

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) {
        setPosition(null);
        return;
      }

      setPosition({
        left: align === "left" ? rect.left : rect.right,
        top: rect.top - 4,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [align, anchorRef, message, portal]);

  if (!message) {
    return null;
  }

  const content = (
    <span
      className={[
        portal
          ? "pointer-events-none fixed z-[100] whitespace-nowrap rounded-md bg-rose-600 px-2 py-1 text-[10px] font-medium text-white shadow-sm"
          : "pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md bg-rose-600 px-2 py-1 text-[10px] font-medium text-white shadow-sm",
        portal ? "" : align === "left" ? "left-0" : "right-0",
        className,
      ].join(" ")}
      style={
        portal && position
          ? {
            left: `${position.left}px`,
            top: `${position.top}px`,
            transform: align === "left" ? "translate(0, -100%)" : "translate(-100%, -100%)",
          }
          : undefined
      }
    >
      {message}
    </span>
  );

  if (portal) {
    return position ? createPortal(content, document.body) : null;
  }

  return content;
}
