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
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ScriptBackendConfigWidget } from "../widgets/scriptBackendConfig/ScriptBackendConfigWidget.jsx";
import { DeviceManagerActions, DeviceManagerWidget } from "../widgets/deviceManager";
import { ScriptSourcesActions, ScriptSourcesWidget } from "../widgets/scriptSources";
import { useScriptTagHints } from "../widgets/scriptSources/hooks/useScriptTagHints.js";
import { ScriptTaskConsole, ScriptTasksActions, ScriptTasksWidget } from "../widgets/scriptTasks";
import { IdeScriptEditor } from "./IdeScriptEditor.jsx";
import { IdePopupDialog } from "./IdePopupDialog.jsx";
import { requestJson, saveAndRun } from "./api/ideScriptApi.js";
import { useIdeDocument } from "./hooks/useIdeDocument.js";
import { useIdePopups } from "./hooks/useIdePopups.js";

const IDE_DEVICE_PLACEMENT = { id: "ide-script-runner-devices", mode: "http" };

/** Coordinates IDE-only state while composing generic Script Runner widgets. */
export function IdeWorkspace({ scriptBindingApiUrl, scriptSourceApiUrl, scriptTaskApiUrl }) {
  const navigate = useNavigate();
  const { closePopup, openPopup, popup } = useIdePopups();
  const { document, openDocument, persistDocument, ready } = useIdeDocument(scriptSourceApiUrl);
  const tagHints = useScriptTagHints(scriptSourceApiUrl);
  const [consoleTask, setConsoleTask] = useState(null);

  function openTask(task) {
    setConsoleTask(task);
    closePopup();
  }

  function openIdeDocument(nextDocument) {
    openDocument(nextDocument);
    closePopup();
  }

  function createIdeDocument() {
    openIdeDocument({});
  }

  async function persistScript(script, savedId, forceCreate) {
    const url = !forceCreate && savedId ? `${scriptSourceApiUrl}/user/${encodeURIComponent(savedId)}` : `${scriptSourceApiUrl}/user`;
    const saved = await requestJson(url, { method: !forceCreate && savedId ? "PUT" : "POST", body: JSON.stringify(script) });
    persistDocument(saved);
    return saved;
  }

  async function runScript(script, savedId) {
    const result = await saveAndRun(scriptSourceApiUrl, scriptTaskApiUrl, script, savedId);
    persistDocument(result.script);
    openTask({ taskId: result.taskId, name: result.script.name, state: result.state || "QUEUED" });
    return result;
  }

  if (!ready) return <main className="grid h-dvh place-items-center bg-white text-sm text-slate-500">Loading IDE…</main>;

  return (
    <div className="h-dvh">
      <IdeScriptEditor
        bottomPanel={consoleTask ? (
          <ScriptTaskConsole
            onClose={() => setConsoleTask(null)}
            task={consoleTask}
            taskApiUrl={scriptTaskApiUrl}
          />
        ) : null}
        document={document || {}}
        loadBindings={() => requestJson(scriptBindingApiUrl)}
        loadBuiltinDetail={(id) => requestJson(`${scriptSourceApiUrl}/builtin/${encodeURIComponent(id)}`)}
        loadBuiltinTemplates={() => requestJson(`${scriptSourceApiUrl}/builtin?limit=500&offset=0`)}
        onClose={() => navigate("/")}
        onOpenDocument={openIdeDocument}
        onOpenPopup={openPopup}
        onPersist={persistScript}
        onRun={runScript}
        tagHints={tagHints}
      />
      {popup === "sources" ? (
        <IdePopupDialog
          dialogClassName="h-[38rem] max-h-[calc(100dvh-2rem)]"
          fill
          onClose={closePopup}
          size="xl"
          title="Script Sources"
        >
          <ScriptSourcesWidget
            actions={<ScriptSourcesActions />}
            onNewScript={createIdeDocument}
            onOpenScript={openIdeDocument}
          />
        </IdePopupDialog>
      ) : null}
      {popup === "tasks" ? (
        <IdePopupDialog
          dialogClassName="h-[38rem] max-h-[calc(100dvh-2rem)]"
          fill
          onClose={closePopup}
          size="xl"
          title="Script Tasks"
        >
          <ScriptTasksWidget
            actions={<ScriptTasksActions />}
            onOpenTask={openTask}
          />
        </IdePopupDialog>
      ) : null}
      {popup === "backend" ? (
        <IdePopupDialog
          compact
          onClose={closePopup}
          size="lg"
          title="Script Backend"
        >
          <ScriptBackendConfigWidget compact />
        </IdePopupDialog>
      ) : null}
      {popup === "devices" ? (
        <IdePopupDialog
          actions={<DeviceManagerActions placement={IDE_DEVICE_PLACEMENT} />}
          onClose={closePopup}
          size="xxl"
          title="Script Runner Devices"
        >
          <DeviceManagerWidget placement={IDE_DEVICE_PLACEMENT} />
        </IdePopupDialog>
      ) : null}
    </div>
  );
}
