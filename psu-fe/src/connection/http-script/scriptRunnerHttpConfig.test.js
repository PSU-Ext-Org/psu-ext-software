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
import { beforeEach, describe, expect, it } from "vitest";
import {
  EMPTY_SCRIPT_RUNNER_HTTP_CONFIG,
  getScriptRunnerDeviceApiUrl,
  getScriptRunnerHealthUrl,
  getScriptRunnerScriptSourceApiUrl,
  getScriptRunnerTaskApiUrl,
  loadScriptRunnerHttpConfig,
  SCRIPT_RUNNER_HTTP_CONFIG_KEY,
} from "./scriptRunnerHttpConfig.js";

describe("scriptRunnerHttpConfig", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to the local Script Runner endpoint", () => {
    expect(loadScriptRunnerHttpConfig()).toEqual(EMPTY_SCRIPT_RUNNER_HTTP_CONFIG);
    expect(getScriptRunnerDeviceApiUrl(EMPTY_SCRIPT_RUNNER_HTTP_CONFIG)).toBe("http://localhost:8081/api/devices");
    expect(getScriptRunnerHealthUrl(EMPTY_SCRIPT_RUNNER_HTTP_CONFIG)).toBe("http://localhost:8081/actuator/health");
    expect(getScriptRunnerScriptSourceApiUrl(EMPTY_SCRIPT_RUNNER_HTTP_CONFIG)).toBe("http://localhost:8081/api/scripts/source");
    expect(getScriptRunnerTaskApiUrl(EMPTY_SCRIPT_RUNNER_HTTP_CONFIG)).toBe("http://localhost:8081/api/scripts");
  });

  it("normalizes a configured root path", () => {
    window.localStorage.setItem(SCRIPT_RUNNER_HTTP_CONFIG_KEY, JSON.stringify({ rootPath: "/psu/" }));
    expect(getScriptRunnerDeviceApiUrl(loadScriptRunnerHttpConfig())).toBe("http://localhost:8081/psu/api/devices");
    expect(getScriptRunnerHealthUrl(loadScriptRunnerHttpConfig())).toBe("http://localhost:8081/psu/actuator/health");
    expect(getScriptRunnerScriptSourceApiUrl(loadScriptRunnerHttpConfig())).toBe("http://localhost:8081/psu/api/scripts/source");
    expect(getScriptRunnerTaskApiUrl(loadScriptRunnerHttpConfig())).toBe("http://localhost:8081/psu/api/scripts");
  });
});
