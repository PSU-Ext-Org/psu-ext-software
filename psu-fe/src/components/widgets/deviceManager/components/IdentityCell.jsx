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
import { useRef, useState } from "react";
import { formatIdentity } from "./deviceRowPresentation.js";

/**
 * Shows the identity text, panning it into view on hover when it overflows the cell.
 *
 * @param {{status: object}} props
 * @returns {import("react").ReactElement}
 */
export function IdentityCell({ status }) {
  const text = formatIdentity(status);
  const containerRef = useRef(null);
  const [shift, setShift] = useState(0);

  const handleEnter = () => {
    const el = containerRef.current;
    if (el) {
      setShift(Math.max(0, el.scrollWidth - el.clientWidth));
    }
  };

  return (
    <div
      className="overflow-hidden"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShift(0)}
      ref={containerRef}
      title={text}
    >
      <span
        className="inline-block whitespace-nowrap ease-linear"
        style={{
          transform: `translateX(-${shift}px)`,
          transitionDuration: `${Math.max(400, shift * 15)}ms`,
          transitionProperty: "transform",
        }}
      >
        {text}
      </span>
    </div>
  );
}

