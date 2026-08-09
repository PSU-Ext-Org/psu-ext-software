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
import { Modal } from "../layout/dialogs/Modal.jsx";

/** Standardises the layout used when generic widgets are opened from the IDE. */
export function IdePopupDialog({ actions, children, compact = false, dialogClassName = "", fill = false, onClose, size, title }) {
  return (
    <Modal dialogClassName={dialogClassName} fill={fill} size={size} title={title} onClose={onClose}>
      {compact ? <div className="w-full">{children}</div> : actions ? (
        <div className="grid max-h-[75vh] min-h-[28rem] min-w-0 grid-rows-[auto_1fr] gap-3">
          <div className="flex justify-end">{actions}</div>
          <div className="min-h-0 overflow-auto">{children}</div>
        </div>
      ) : (
        <div className="flex h-full min-h-0 min-w-0 flex-col">{children}</div>
      )}
    </Modal>
  );
}
