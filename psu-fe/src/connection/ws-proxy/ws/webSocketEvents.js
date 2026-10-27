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
import { parseWsEnvelope } from "./wsEnvelope.js";

/**
 * Attaches protocol/logging handlers without knowing device or React state.
 * The session owns socket identity and the lifecycle transitions supplied here.
 * @param {WebSocket} socket
 * @param {object} options
 */
export function bindWebSocketEvents(socket, {
  wsUrl, isCurrent, onOpen, onUnavailable, onClosed, onMessage,
  appendWsMessage, consumeResponseTag, clearResponseTags,
}) {
  socket.addEventListener("open", onOpen);

  socket.addEventListener("message", async (event) => {
    if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
      const bytes = event.data instanceof ArrayBuffer ? event.data : await event.data.arrayBuffer();
      appendWsMessage("error", `Unexpected raw binary WebSocket response (${bytes.byteLength} bytes)`);
      return;
    }
    const envelope = parseWsEnvelope(event.data);
    if (!envelope) {
      appendWsMessage("error", `Malformed WebSocket response envelope: ${String(event.data)}`);
      return;
    }
    const tag = consumeResponseTag(envelope.uuid);
    const message = envelope.type === "BIN"
      ? `[binary base64 ${envelope.payload.length} chars]`
      : envelope.payload;
    appendWsMessage("in", message, tag, envelope.uuid);
    onMessage(envelope, tag);
  });

  socket.addEventListener("close", () => {
    if (!isCurrent()) return;
    onUnavailable();
    clearResponseTags();
    appendWsMessage("close", wsUrl);
    onClosed();
  });

  socket.addEventListener("error", () => {
    if (!isCurrent()) return;
    onUnavailable();
    clearResponseTags();
    appendWsMessage("error", wsUrl);
  });
}
