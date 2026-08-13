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
import { Download, FileCode2, FilePlus2, FolderOpen, LoaderCircle, Play, Save, Settings, SquareStack, Upload, X } from "lucide-react";

import { IdeMenuBar } from "../IdeMenuBar.jsx";

/** Renders IDE navigation and document actions. */
export function IdeEditorHeader({ actions, canRun, loadingTemplate, running, templates }) {
  const menuItems = createMenuItems({ actions, canRun, loadingTemplate, running, templates });

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-slate-200 px-4">
      <h1 className="mr-3 text-sm font-semibold text-slate-900">IDE</h1>
      <IdeMenuBar items={menuItems} />
      <button
        aria-label="Close IDE"
        className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        onClick={actions.close}
        type="button"
      >
        <X className="h-5 w-5" />
      </button>
    </header>
  );
}

/** Builds the menu model consumed by the keyboard-accessible IDE menu bar. */
function createMenuItems({ actions, canRun, loadingTemplate, running, templates }) {
  const openSources = () => actions.openPopup("sources");
  const openTasks = () => actions.openPopup("tasks");
  const openBackend = () => actions.openPopup("backend");
  const openDevices = () => actions.openPopup("devices");
  const save = () => actions.requestSave(false);
  const saveAs = () => actions.requestSave(true);

  const templateItems = templates.map((template) => ({
    id: `template-${template.id}`,
    label: template.name,
    action: () => actions.loadTemplate(template.id),
  }));

  return [
    {
      id: "file",
      label: "File",
      mnemonic: "f",
      globalMnemonic: true,
      children: [
        {
          id: "new",
          label: "New File",
          mnemonic: "w",
          globalMnemonic: true,
          icon: <FilePlus2 className="h-4 w-4" />,
          action: actions.createDocument,
        },
        {
          id: "open",
          label: "Open",
          mnemonic: "o",
          globalMnemonic: true,
          icon: <FolderOpen className="h-4 w-4" />,
          action: openSources,
        },
        { type: "separator" },
        {
          id: "save",
          label: "Save",
          mnemonic: "v",
          globalMnemonic: true,
          icon: <Save className="h-4 w-4" />,
          action: save,
        },
        {
          id: "save-as",
          label: "Save As",
          mnemonic: "a",
          globalMnemonic: true,
          icon: <Save className="h-4 w-4" />,
          action: saveAs,
        },
        { type: "separator" },
        {
          id: "import",
          label: "Import",
          mnemonic: "i",
          globalMnemonic: true,
          icon: <Download className="h-4 w-4" />,
          action: actions.importFile,
        },
        {
          id: "export",
          label: "Export",
          mnemonic: "e",
          globalMnemonic: true,
          icon: <Upload className="h-4 w-4" />,
          action: actions.exportFile,
        },
        { type: "separator" },
        {
          id: "templates",
          label: "Load Template",
          mnemonic: "l",
          globalMnemonic: true,
          icon: <FileCode2 className="h-4 w-4" />,
          disabled: loadingTemplate,
          children: templateItems,
        },
        { type: "separator" },
        {
          id: "exit",
          label: "Exit",
          mnemonic: "x",
          globalMnemonic: true,
          icon: <X className="h-4 w-4" />,
          action: actions.close,
        },
      ],
    },
    {
      id: "run",
      label: "Run",
      mnemonic: "n",
      globalMnemonic: true,
      icon: running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />,
      tone: "primary",
      disabled: !canRun,
      action: actions.run,
    },
    {
      id: "scripts",
      label: "Scripts",
      mnemonic: "c",
      globalMnemonic: true,
      icon: <SquareStack className="h-4 w-4" />,
      children: [
        { id: "sources", label: "Sources", mnemonic: "o", action: openSources },
        {
          id: "tasks",
          label: "Tasks",
          mnemonic: "t",
          globalMnemonic: true,
          action: openTasks,
        },
      ],
    },
    {
      id: "settings",
      label: "Settings",
      mnemonic: "s",
      globalMnemonic: true,
      icon: <Settings className="h-4 w-4" />,
      children: [
        {
          id: "backend",
          label: "Backend",
          mnemonic: "b",
          globalMnemonic: true,
          action: openBackend,
        },
        {
          id: "devices",
          label: "Devices",
          mnemonic: "d",
          globalMnemonic: true,
          action: openDevices,
        },
      ],
    },
  ];
}
