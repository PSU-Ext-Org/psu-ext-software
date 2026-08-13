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
import { LoaderCircle, Save } from "lucide-react";
import { useState } from "react";

import { Field } from "../../forms/Field.jsx";
import { Modal } from "../../layout/dialogs/Modal.jsx";
import { TagSetInput } from "../../widgets/scriptSources/components/TagSetInput.jsx";

const EMPTY_TAG_HINTS = {
  error: "",
  loading: false,
  tags: [],
};

/**
 * Collects the name and tags used to create a new user-script document.
 * Draft metadata remains local so cancelling cannot mutate the open document.
 */
export function IdeSaveScriptDialog({
  initialName,
  initialTags,
  onCancel,
  onSave,
  saving,
  tagHints = EMPTY_TAG_HINTS,
}) {
  const [name, setName] = useState(initialName);
  const [tags, setTags] = useState(initialTags);

  function save() {
    void onSave({ name, tags });
  }

  function handleSubmit(event) {
    event.preventDefault();
    save();
  }

  return (
    <Modal size="md" title="Save Script As" onClose={onCancel}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <Field label="Name" value={name} onChange={setName} />
        {tagHints.loading ? (
          <p className="text-sm text-slate-500">Loading tag suggestions…</p>
        ) : (
          <>
            <TagSetInput
              label="Tags"
              onChange={setTags}
              onSubmit={save}
              placeholder="Add tags"
              suggestions={tagHints.tags}
              value={tags}
            />
            {tagHints.error ? (
              <p className="text-xs text-amber-700">
                Tag suggestions are unavailable. You can still enter tags manually.
              </p>
            ) : null}
          </>
        )}
        <div className="flex justify-end gap-2">
          <button
            className="control-standard border border-slate-300 bg-white px-3 font-medium text-slate-700"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="control-standard inline-flex items-center gap-2 bg-teal-700 px-3 font-medium text-white disabled:opacity-50"
            disabled={!name.trim() || saving}
            type="submit"
          >
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
