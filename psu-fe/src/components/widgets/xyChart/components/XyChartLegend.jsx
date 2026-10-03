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
/**
 * Live legend for the X-Y chart. It uses uPlot's legend markup and classes, so it looks like the regular chart's
 * legend: an X row (in place of the regular chart's time row), then one row per line with its own value.
 * uPlot cannot render an X row for faceted data, which is why this legend is drawn here instead.
 *
 * @param {object} props
 * @param {Array<{color?: string, label: string, value: string}>} props.rows
 * @returns {import("react").ReactElement}
 */
export function XyChartLegend({ rows }) {
  return (
    <div className="psu-uplot psu-uplot-xy pointer-events-none absolute inset-0" data-testid="xy-chart-legend">
      <table className="u-legend u-inline u-live">
        <tbody>
          {rows.map((row, index) => (
            <tr className="u-series" key={index}>
              <th>
                {row.color ? <div className="u-marker" style={{ border: `2px solid ${row.color}` }} /> : null}
                <div className="u-label">{row.label}</div>
              </th>
              <td className="u-value">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
