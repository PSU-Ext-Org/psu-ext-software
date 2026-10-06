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
export const DEFAULT_PAIR_TIMEOUT_MS = 1000;

/**
 * @typedef {"x" | "y"} XyAxis
 */

/**
 * @typedef {object} XyAxisSample
 * @property {number} value - Numeric measurement.
 * @property {number} t - Update time in milliseconds.
 */

/**
 * @typedef {object} XyPoint
 * @property {number} x
 * @property {number} y
 * @property {number} t - Latest update time of the two values used.
 * @property {XyAxis | null} carried - Axis whose value was carried over from an earlier update, or null when both were fresh.
 */

/**
 * Builds X-Y points out of two independently updated axes.
 *
 * When one axis receives a fresh sample the pairer waits up to `timeoutMs` for the other one. If both are
 * fresh in time a point is emitted from them. On timeout a point is emitted from the fresh value plus the
 * latest known value of the other axis, stamped with the latest update time of the pair. Nothing is emitted
 * if the other axis has never reported.
 *
 * Callers must pass only fresh, numeric samples to `update`; use `seed` for cached values that should not
 * count as new data.
 *
 * @param {object} options
 * @param {number} [options.timeoutMs]
 * @param {(point: XyPoint) => void} options.onPoint
 * @param {(callback: () => void, delayMs: number) => unknown} [options.setTimer]
 * @param {(timerId: unknown) => void} [options.clearTimer]
 * @returns {{
 *   update: (axis: XyAxis, sample: XyAxisSample) => void,
 *   seed: (axis: XyAxis, sample: XyAxisSample) => void,
 *   reset: () => void,
 *   dispose: () => void
 * }}
 */
export function createXyPairer({ timeoutMs = DEFAULT_PAIR_TIMEOUT_MS, onPoint, setTimer, clearTimer }) {
  const schedule = setTimer || ((callback, delayMs) => globalThis.setTimeout(callback, delayMs));
  const cancel = clearTimer || ((timerId) => globalThis.clearTimeout(timerId));
  const waitMs = Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : DEFAULT_PAIR_TIMEOUT_MS;
  const latest = { x: null, y: null };
  const fresh = { x: false, y: false };
  let timer = null;
  let disposed = false;

  function update(axis, sample) {
    if (disposed || !isAxis(axis) || !isSample(sample)) {
      return;
    }

    latest[axis] = sample;
    fresh[axis] = true;

    if (fresh.x && fresh.y) {
      emit(null);
      return;
    }

    if (timer === null) {
      timer = schedule(handleTimeout, waitMs);
    }
  }

  function seed(axis, sample) {
    if (disposed || !isAxis(axis) || !isSample(sample)) {
      return;
    }

    latest[axis] = sample;
  }

  function reset() {
    clearPending();
    latest.x = null;
    latest.y = null;
  }

  function dispose() {
    disposed = true;
    reset();
  }

  function handleTimeout() {
    timer = null;
    if (disposed) {
      return;
    }

    if (!latest.x || !latest.y) {
      fresh.x = false;
      fresh.y = false;
      return;
    }

    emit(fresh.x ? "y" : "x");
  }

  function emit(carried) {
    clearPending();
    onPoint({
      x: latest.x.value,
      y: latest.y.value,
      t: Math.max(latest.x.t, latest.y.t),
      carried,
    });
  }

  function clearPending() {
    if (timer !== null) {
      cancel(timer);
      timer = null;
    }

    fresh.x = false;
    fresh.y = false;
  }

  return { update, seed, reset, dispose };
}

function isAxis(axis) {
  return axis === "x" || axis === "y";
}

function isSample(sample) {
  return Boolean(sample) && Number.isFinite(sample.value) && Number.isFinite(sample.t);
}
