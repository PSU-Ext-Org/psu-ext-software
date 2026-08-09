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
import { Activity, LoaderCircle, Save } from "lucide-react";
import { useScriptRunnerHttp } from "../../../connection/http-script/ScriptRunnerHttpContext.jsx";
import { getScriptRunnerHealthUrl } from "../../../connection/http-script/scriptRunnerHttpConfig.js";
import { Field } from "../../forms/Field.jsx";
import { SelectField } from "../../forms/SelectField.jsx";

/**
 * Configures the Script Runner HTTP endpoint used by Script Config widgets.
 *
 * @returns {import("react").ReactElement}
 */
export function ScriptBackendConfigWidget({ compact = false }) {
  const { config, saveEndpoint } = useScriptRunnerHttp();
  const [draft, setDraft] = useState(() => toDraft(config));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");

  useEffect(() => setDraft(toDraft(config)), [
    config.scheme,
    config.host,
    config.port,
    config.rootPath,
  ]);

  const valid = Boolean(draft.host.trim() && draft.port.trim());
  const changed = Object.entries(draft).some(([key, value]) => value !== (config[key] || ""));

  return (
    <div className={`flex flex-col gap-4 ${compact ? "" : "min-h-full"}`}>
      <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid grid-cols-[7rem_minmax(12rem,1fr)_7rem_minmax(12rem,1fr)] gap-3"}>
        <SelectField
          label="Scheme"
          value={draft.scheme}
          onChange={(value) => updateDraft("scheme", value)}
          options={[{ value: "http", label: "http" }, { value: "https", label: "https" }]}
        />
        <Field label="Host" placeholder="localhost" value={draft.host} onChange={(value) => updateDraft("host", value)} />
        <Field label="Port" placeholder="8081" value={draft.port} onChange={(value) => updateDraft("port", value)} />
        <Field label="Root path" placeholder="/" value={draft.rootPath} onChange={(value) => updateDraft("rootPath", value)} />
      </div>
      <div className={`flex flex-wrap items-center justify-end gap-3 ${compact ? "" : "mt-auto"}`}>
        {testResult ? <span aria-live="polite" className="text-sm text-slate-600">{testResult}</span> : null}
        <button
          className="control-standard inline-flex items-center gap-2 border border-slate-200 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!valid || testing}
          onClick={testConnection}
          type="button"
        >
          {testing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
          Test Connection
        </button>
        <button
          className="control-standard inline-flex items-center gap-2 bg-teal-700 px-3 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!valid || !changed}
          onClick={() => saveEndpoint({ ...draft, host: draft.host.trim(), port: draft.port.trim() })}
          type="button"
        >
          <Save className="h-4 w-4" />
          Save
        </button>
      </div>
    </div>
  );

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function testConnection() {
    setTesting(true);
    setTestResult("");
    try {
      const response = await fetch(getScriptRunnerHealthUrl({ ...draft, host: draft.host.trim(), port: draft.port.trim() }));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setTestResult("Connected");
    } catch (error) {
      setTestResult(error.message || "Connection failed");
    } finally {
      setTesting(false);
    }
  }
}

function toDraft(config) {
  return {
    scheme: config.scheme || "http",
    host: config.host || "localhost",
    port: config.port || "8081",
    rootPath: config.rootPath || "",
  };
}
