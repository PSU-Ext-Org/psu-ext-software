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
import { X } from "lucide-react";
import { useEffect, useId } from "react";
import { useModalDialog } from "../hooks/useModalDialog.js";

/**
 * Generic modal overlay with a title bar and close button.
 *
 * @param {object} props
 * @param {import("react").ReactNode} props.title - Heading shown in the title bar.
 * @param {() => void} props.onClose - Called when the close button is clicked.
 * @param {import("react").ReactNode} props.children - Modal body content.
 * @param {string} [props.dialogClassName] - Extra classes for a constrained dialog frame.
 * @param {boolean} [props.fill] - Makes the body fill a constrained dialog frame.
 * @param {boolean} [props.fullscreen] - Whether the dialog occupies the whole viewport.
 * @param {"sm" | "md" | "lg" | "xl" | "xxl"} [props.size] - Maximum width for a regular dialog.
 * @returns {import("react").ReactElement}
 */
export function Modal({
  title,
  onClose,
  children,
  dialogClassName = "",
  fill = false,
  fullscreen = false,
  size = "sm",
}) {
  const titleId = useId();
  const dialogRef = useModalDialog(true, onClose);
  useEffect(() => {
    if (!fullscreen) {
      return undefined;
    }
    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, [fullscreen]);

  return (
    <div
      className={`fixed inset-0 z-50 flex bg-black/40 ${fullscreen ? "overflow-hidden" : "items-center justify-center p-4"}`}
    >
      <div
        ref={dialogRef}
        className={`relative w-full border border-slate-200 bg-white shadow-xl ${fullscreen || fill ? "flex min-h-0 flex-col" : ""} ${fullscreen ? "border-0" : "max-w-md rounded-lg"} ${dialogClassName}`}
        style={getModalStyle(fullscreen, size)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 id={titleId} className="flex items-center text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <button
            aria-label="Close"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={fullscreen || fill ? "flex min-h-0 flex-1 flex-col p-4" : "p-4"}>
          {children}
        </div>
      </div>
    </div>
  );
}

const MODAL_WIDTHS = {
  sm: "28rem",
  md: "36rem",
  lg: "48rem",
  xl: "64rem",
  xxl: "80rem",
};

function getModalStyle(fullscreen, size) {
  if (fullscreen) {
    return { height: "100dvh", maxWidth: "none", width: "100dvw" };
  }

  return { maxWidth: MODAL_WIDTHS[size] || MODAL_WIDTHS.sm };
}
