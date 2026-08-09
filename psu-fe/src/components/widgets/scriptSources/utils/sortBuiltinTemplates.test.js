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
import { describe, expect, it } from "vitest";
import { sortBuiltinTemplates } from "./sortBuiltinTemplates.js";

describe("sortBuiltinTemplates", () => {
  it("uses explicit positions before template names", () => {
    expect(sortBuiltinTemplates([
      { name: "10. Melody", position: 10 },
      { name: "2. Second", position: 2 },
      { name: "1. First", position: 1 },
    ]).map((template) => template.name)).toEqual(["1. First", "2. Second", "10. Melody"]);
  });

  it("sorts unpositioned templates by name after positioned templates", () => {
    expect(sortBuiltinTemplates([
      { name: "Unpositioned" },
      { name: "Positioned", position: 1 },
    ]).map((template) => template.name)).toEqual(["Positioned", "Unpositioned"]);
  });
});
