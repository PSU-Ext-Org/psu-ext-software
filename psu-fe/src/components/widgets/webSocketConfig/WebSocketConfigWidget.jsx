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
import { Cable, Eraser, LoaderCircle, X } from "lucide-react";
import { useWebSocketConnection } from "../../../connection/ws-proxy/WebSocketConnectionContext.jsx";
import { Field } from "../../forms/Field.jsx";
import { SelectField } from "../../forms/SelectField.jsx";

/**
 * Reusable WebSocket proxy configuration widget.
 *
 * @returns {import("react").ReactElement}
 */
export function WebSocketConfigWidget() {
  const {
    config,
    wsConnected,
    wsConnecting,
    updateConfig,
    clearConnectionConfig,
    connectWs,
    disconnectWs,
  } = useWebSocketConnection();
  
  const wsReady = Boolean(config.wsHost && config.wsPort && config.wsPath);
  const inputsDisabled = wsConnected || wsConnecting;

  return (
    <div className="grid min-h-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="grid gap-3">
        <WebSocketOptions
          autoConnect={config.autoConnect}
          onAutoConnectChange={(event) => updateConfig("autoConnect", event.target.checked)}
          onClear={clearConnectionConfig}
        />
        <InlineStatus value={formatWebSocketStatus({ wsConnected, wsConnecting })} />
      </div>
      <div className="grid min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <WebSocketFields
          config={config}
          disabled={inputsDisabled}
          onChange={updateConfig}
        />
        <WebSocketConnectionButton
          connected={wsConnected}
          connecting={wsConnecting}
          disabled={!wsReady}
          onConnect={connectWs}
          onDisconnect={disconnectWs}
        />
      </div>
    </div>
  );
}

function WebSocketOptions({ autoConnect, onAutoConnectChange, onClear }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <label className="control-standard inline-flex items-center gap-2 border border-slate-200 bg-white font-medium text-slate-700 shadow-sm hover:bg-slate-50">
        <input
          checked={autoConnect}
          className="peer sr-only"
          onChange={onAutoConnectChange}
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className="relative h-4 w-7 rounded-full bg-slate-300 transition peer-checked:bg-teal-700 after:absolute after:left-0.5 after:top-0.5 after:h-3 after:w-3 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-3"
        />
        Proxy auto-connect
      </label>
      <button
        aria-label="Clear connection config"
        className="control-standard inline-flex items-center justify-center gap-1 border border-slate-200 bg-white px-2.5 text-slate-700 shadow-sm hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
        onClick={onClear}
        type="button"
      >
        <Eraser className="h-4 w-4" />
      </button>
    </div>
  );
}

function WebSocketFields({ config, disabled, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        disabled={disabled}
        label="Scheme"
        options={[{ value: "ws", label: "ws" }, { value: "wss", label: "wss" }]}
        value={config.wsScheme}
        onChange={(value) => onChange("wsScheme", value)}
      />
      <Field
        disabled={disabled}
        label="Host"
        placeholder="localhost"
        value={config.wsHost}
        onChange={(value) => onChange("wsHost", value)}
      />
      <Field
        disabled={disabled}
        label="Port"
        placeholder="8080"
        value={config.wsPort}
        onChange={(value) => onChange("wsPort", value)}
      />
      <Field
        disabled={disabled}
        label="Path"
        placeholder="/path"
        value={config.wsPath}
        onChange={(value) => onChange("wsPath", value)}
      />
    </div>
  );
}

function WebSocketConnectionButton({ connected, connecting, disabled, onConnect, onDisconnect }) {
  return (
    <div className="mt-auto">
      {connected ? (
        <button
          className="control-standard inline-flex w-full items-center justify-center gap-2 border border-slate-300 bg-white font-medium text-slate-900 hover:bg-slate-100"
          onClick={onDisconnect}
          type="button"
        >
          <X className="h-4 w-4" />
          Disconnect
        </button>
      ) : (
        <button
          className="control-standard inline-flex w-full items-center justify-center gap-2 bg-teal-700 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || connecting}
          onClick={onConnect}
          type="button"
        >
          {connecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Cable className="h-4 w-4" />}
          {connecting ? "Connecting..." : "Connect"}
        </button>
      )}
    </div>
  );
}

function InlineStatus({ value }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-slate-100 px-3 py-2 text-sm">
      <span className="shrink-0 text-slate-600">Status</span>
      <strong className="min-w-0 truncate text-right">{value}</strong>
    </div>
  );
}

function formatWebSocketStatus({ wsConnected, wsConnecting }) {
  if (wsConnecting) return "Connecting";
  return wsConnected ? "Connected" : "Disconnected";
}
