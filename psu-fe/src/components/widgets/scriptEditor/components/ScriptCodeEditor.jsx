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
import { useEffect, useRef, useState } from "react";

/**
 * A lazily initialised CodeMirror 6 JavaScript editor.
 *
 * @param {{bindings: Array<object>, onChange: (source: string) => void, value: string}} props
 * @returns {import("react").ReactElement}
 */
export function ScriptCodeEditor({ bindings, flushTop = false, onChange, value }) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const [loading, setLoading] = useState(true);
  const bindingKey = JSON.stringify(bindings);

  onChangeRef.current = onChange;

  useEffect(() => {
    let active = true;
    let view;

    Promise.all([
      import("@codemirror/autocomplete"),
      import("@codemirror/commands"),
      import("@codemirror/lang-javascript"),
      import("@codemirror/language"),
      import("@codemirror/state"),
      import("@codemirror/view"),
    ]).then(([autocomplete, commands, javascript, language, state, viewModule]) => {
      if (!active || !hostRef.current) return;
      const completionSource = (context) => {
        const word = context.matchBefore(/[A-Za-z_$][\w$]*/);
        if (!word && !context.explicit) return null;
        return {
          from: word ? word.from : context.pos,
          options: bindings.map((binding) => ({
            label: binding.name,
            type: "function",
            detail: binding.signature,
            info: binding.documentation,
            apply: autocomplete.snippet(binding.snippet || binding.name),
          })),
        };
      };
      const editorState = state.EditorState.create({
        doc: value,
        extensions: [
          viewModule.lineNumbers(),
          viewModule.highlightActiveLineGutter(),
          viewModule.highlightSpecialChars(),
          commands.history(),
          language.bracketMatching(),
          language.syntaxHighlighting(language.defaultHighlightStyle, { fallback: true }),
          javascript.javascript(),
          autocomplete.autocompletion({ override: [completionSource] }),
          viewModule.keymap.of([commands.indentWithTab, ...commands.defaultKeymap, ...autocomplete.completionKeymap]),
          viewModule.EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
          viewModule.EditorView.theme({
            "&": { height: "100%", backgroundColor: "#ffffff", color: "#0f172a" },
            ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "14px" },
            ".cm-content": { padding: "12px 0" },
            ".cm-gutters": { backgroundColor: "#f8fafc", color: "#64748b", borderRight: "1px solid #e2e8f0" },
            ".cm-activeLine": { backgroundColor: "#f1f5f9" },
            ".cm-activeLineGutter": { backgroundColor: "#e2e8f0" },
            ".cm-tooltip-autocomplete": { border: "1px solid #cbd5e1", backgroundColor: "#ffffff" },
          }),
        ],
      });
      view = new viewModule.EditorView({ parent: hostRef.current, state: editorState });
      viewRef.current = view;
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      view?.destroy();
      viewRef.current = null;
    };
  // CodeMirror owns the extension configuration after mount. Value synchronisation is handled below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bindingKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  return (
    <div className={`relative min-h-0 flex-1 overflow-hidden border border-slate-300 bg-white focus-within:border-teal-700 ${flushTop ? "rounded-b-md" : "rounded-md"}`}>
      {loading ? <div className="absolute inset-0 grid place-items-center bg-white text-sm text-slate-500">Loading editor…</div> : null}
      <div aria-label="JavaScript source editor" className="h-full" ref={hostRef} />
    </div>
  );
}
