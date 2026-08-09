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
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Configuration-driven, keyboard-accessible menu bar.
 *
 * Each item has an id, label, mnemonic, optional icon, tone, action, disabled flag, and children.
 * A separator is represented by { type: "separator" }.
 */
export function IdeMenuBar({ items }) {
  const [openPath, setOpenPath] = useState([]);
  const rootRef = useRef(null);
  const altMnemonicArmedRef = useRef(false);
  const topLevelItems = items.filter((item) => item.type !== "separator");

  useEffect(() => {
    function handleGlobalMnemonic(event) {
      if (event.key === "Alt") {
        altMnemonicArmedRef.current = true;
        return;
      }
      const mnemonicActive = event.altKey || altMnemonicArmedRef.current;
      if (!mnemonicActive || event.ctrlKey || event.metaKey) return;
      altMnemonicArmedRef.current = false;
      const item = findItemByMnemonic(items, mnemonicKey(event), true);
      if (!item || item.disabled) return;
      event.preventDefault();
      if (item.children?.length) open(item.id);
      else invoke(item);
    }
    window.addEventListener("keydown", handleGlobalMnemonic, true);
    return () => window.removeEventListener("keydown", handleGlobalMnemonic, true);
  }, [items]);

  useEffect(() => {
    function closeOnOutsidePointer(event) {
      altMnemonicArmedRef.current = false;
      if (!rootRef.current?.contains(event.target)) close();
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  function close({ restoreFocus = false } = {}) {
    const triggerId = openPath[0];
    setOpenPath([]);
    if (restoreFocus) requestAnimationFrame(() => triggerId && rootRef.current?.querySelector(`[data-menu-trigger="${triggerId}"]`)?.focus());
  }

  function open(id, parentPath = []) {
    setOpenPath([...parentPath, id]);
    requestAnimationFrame(() => rootRef.current?.querySelector(`[data-menu-trigger="${id}"]`)?.focus());
  }

  function openAndFocusFirst(item, parentPath = []) {
    setOpenPath([...parentPath, item.id]);
    requestAnimationFrame(() => firstMenuItem(item.id)?.focus());
  }

  function firstMenuItem(menuId) {
    return rootRef.current?.querySelector(`[data-menu-id="${menuId}"] > [role="menuitem"]:not(:disabled)`);
  }

  function invoke(item) {
    close();
    item.action?.();
  }

  function moveTopLevel(currentId, direction, keepOpen) {
    const index = topLevelItems.findIndex((item) => item.id === currentId);
    const next = topLevelItems[(index + direction + topLevelItems.length) % topLevelItems.length];
    rootRef.current?.querySelector(`[data-menu-trigger="${next.id}"]`)?.focus();
    if (keepOpen && next.children?.length) openAndFocusFirst(next);
    else close();
  }

  function moveWithinMenu(menuId, target, direction) {
    const entries = [...rootRef.current.querySelectorAll(`[data-menu-id="${menuId}"] [role="menuitem"]:not(:disabled)`)]
      .filter((entry) => entry.closest("[data-menu-id]")?.dataset.menuId === menuId);
    const index = entries.indexOf(target);
    entries[(index + direction + entries.length) % entries.length]?.focus();
  }

  function handleKeyDown(event) {
    const trigger = event.target.closest("[data-menu-trigger]");
    const itemElement = event.target.closest("[role=menuitem]");
    const menuElement = itemElement?.closest("[data-menu-id]") || event.target.closest("[data-menu-id]");
    const key = event.key;

    if (!trigger && !itemElement && !menuElement) return;
    if (key === "Escape") {
      event.preventDefault();
      close({ restoreFocus: true });
      return;
    }
    if (trigger) {
      const item = findItemById(items, trigger.dataset.menuTrigger);
      if (key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault();
        moveTopLevel(item.id, key === "ArrowLeft" ? -1 : 1, openPath.length > 0);
      } else if (item.children?.length && (key === "ArrowDown" || key === "Enter" || key === " ")) {
        event.preventDefault();
        openAndFocusFirst(item);
      } else if (!item.children?.length && (key === "Enter" || key === " ")) {
        event.preventDefault();
        invoke(item);
      } else if (item.children?.length && !event.altKey && !event.ctrlKey && !event.metaKey) {
        const child = findItemByMnemonic(item.children, key.toLowerCase(), false);
        if (child && !child.disabled) {
          event.preventDefault();
          child.children?.length ? openAndFocusFirst(child, [item.id]) : invoke(child);
        }
      }
      return;
    }

    const menuId = menuElement?.dataset.menuId;
    if (!itemElement) {
      if (!event.altKey && !event.ctrlKey && !event.metaKey) {
        const sibling = findItemByMnemonic(findItemById(items, menuId)?.children || [], key.toLowerCase(), false);
        if (sibling && !sibling.disabled) {
          event.preventDefault();
          sibling.children?.length ? openAndFocusFirst(sibling, openPath) : invoke(sibling);
        }
      }
      return;
    }
    const item = findItemById(items, itemElement.dataset.menuItem);
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      moveWithinMenu(menuId, itemElement, key === "ArrowDown" ? 1 : -1);
    } else if (key === "ArrowRight" && item.children?.length) {
      event.preventDefault();
      openAndFocusFirst(item, openPath);
    } else if (key === "ArrowLeft" && openPath.length > 1) {
      event.preventDefault();
      const submenuTriggerId = openPath.at(-1);
      setOpenPath(openPath.slice(0, -1));
      requestAnimationFrame(() => rootRef.current?.querySelector(`[data-menu-item="${submenuTriggerId}"]`)?.focus());
    } else if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      moveTopLevel(openPath[0], key === "ArrowLeft" ? -1 : 1, true);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      item.children?.length ? openAndFocusFirst(item, openPath) : invoke(item);
    } else if (!event.altKey && !event.ctrlKey && !event.metaKey) {
      const sibling = findItemByMnemonic(findItemById(items, menuId)?.children || [], key.toLowerCase(), false);
      if (sibling && !sibling.disabled) {
        event.preventDefault();
        sibling.children?.length ? openAndFocusFirst(sibling, openPath) : invoke(sibling);
      }
    }
  }

  return <div className="flex h-9 items-center" onKeyDown={handleKeyDown} ref={rootRef} role="menubar">
    {topLevelItems.map((item) => <MenuEntry item={item} key={item.id} openPath={openPath} onInvoke={invoke} onOpen={open} onOpenAndFocusFirst={openAndFocusFirst} />)}
  </div>;
}

function MenuEntry({ item, openPath, onInvoke, onOpen, onOpenAndFocusFirst, parentPath = [] }) {
  if (item.type === "separator") return <div className="my-1 border-t border-slate-100" role="separator" />;
  const hasChildren = Boolean(item.children?.length);
  const isOpen = openPath.includes(item.id);
  const isTopLevel = parentPath.length === 0;
  const classes = isTopLevel
    ? `inline-flex h-8 items-center gap-1 rounded px-2 text-sm font-medium disabled:opacity-50 ${item.tone === "primary" ? "text-teal-700 hover:bg-teal-50" : "text-slate-700 hover:bg-slate-100"}`
    : "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  const content = <>{item.icon}<MnemonicLabel label={item.label} mnemonic={item.mnemonic} />{hasChildren ? isTopLevel ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" /> : null}</>;
  const button = <button aria-expanded={hasChildren ? isOpen : undefined} aria-haspopup={hasChildren ? "menu" : undefined} className={classes} data-menu-item={!isTopLevel ? item.id : undefined} data-menu-trigger={isTopLevel ? item.id : undefined} disabled={item.disabled} onClick={() => hasChildren ? onOpen(item.id, parentPath) : onInvoke(item)} role={isTopLevel ? undefined : "menuitem"} type="button">{content}</button>;

  if (!hasChildren) return button;
  return <div className={isTopLevel ? "relative" : "relative"}>
    {button}
    {isOpen ? <div className={isTopLevel ? "absolute left-0 top-9 z-20 min-w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg" : "absolute left-full top-0 z-30 ml-1 min-w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg"} data-menu-id={item.id} role="menu">
      {item.children.map((child) => <MenuEntry item={child} key={child.id || `separator-${item.children.indexOf(child)}`} openPath={openPath} onInvoke={onInvoke} onOpen={onOpen} onOpenAndFocusFirst={onOpenAndFocusFirst} parentPath={[...parentPath, item.id]} />)}
    </div> : null}
  </div>;
}

function MnemonicLabel({ label, mnemonic }) {
  if (!mnemonic) return <span>{label}</span>;
  const index = label.toLowerCase().indexOf(mnemonic.toLowerCase());
  if (index < 0) return <span>{label}</span>;
  return <span>{label.slice(0, index)}<span className="underline decoration-current underline-offset-2">{label[index]}</span>{label.slice(index + 1)}</span>;
}

function findItemById(items, id) {
  for (const item of items) {
    if (item.id === id) return item;
    const nested = item.children && findItemById(item.children, id);
    if (nested) return nested;
  }
  return null;
}

function findItemByMnemonic(items, mnemonic, globalOnly) {
  for (const item of items) {
    if (item.mnemonic?.toLowerCase() === mnemonic && (!globalOnly || item.globalMnemonic)) return item;
    const nested = findItemByMnemonic(item.children || [], mnemonic, globalOnly);
    if (nested) return nested;
  }
  return null;
}

function mnemonicKey(event) {
  const codeMatch = /^Key([A-Z])$/.exec(event.code || "");
  return codeMatch ? codeMatch[1].toLowerCase() : event.key.toLowerCase();
}
