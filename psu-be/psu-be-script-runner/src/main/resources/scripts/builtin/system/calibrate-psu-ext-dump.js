(() => {
  // Change this to the connected PSU-EXT Script Runner device ID.
  const psuExtDeviceId = "PSUEXT1";
  const maximumPoints = 32;
  const tables = [
    { channel: "CH0", kind: "VOLTage", series: "CH0 voltage calibration", actualUnit: "V" },
    { channel: "CH1", kind: "VOLTage", series: "CH1 voltage calibration", actualUnit: "V" },
    { channel: "CH1", kind: "CURRent", series: "CH1 current calibration", actualUnit: "A" }
  ];
  const results = [];

  // Queries inside an open transaction can return staged rather than saved points.
  const transaction = queryRaw(psuExtDeviceId, "CALibration:TRANsaction?");
  if (transaction !== "IDLE") {
    throw new Error("Finish or abort the calibration transaction before dumping saved tables: " + transaction);
  }

  for (let tableIndex = 0; tableIndex < tables.length; tableIndex += 1) {
    const table = tables[tableIndex];
    const points = [];
    results.push({ channel: table.channel, kind: table.kind, actualUnit: table.actualUnit, points });
    const command = "CALibration:" + table.kind + "?";
    const unsetResponse = 'ERR,"' + command + ' failed: ESP_ERR_INVALID_ARG"';
    const unit = "raw V / actual " + table.actualUnit + " / PGA V";

    for (let pointNumber = 1; pointNumber <= maximumPoints; pointNumber += 1) {
      if (cancelled()) {
        return { cancelled: true, tables: results };
      }

      let response;
      try {
        response = queryRaw(psuExtDeviceId, command + " " + table.channel + ",POINt" + pointNumber);
      } catch (error) {
        // The runner raises firmware ERR responses as exceptions. A point-query
        // error ends this table; keep its captured points and try the next table.
        if (cancelled()) {
          return { cancelled: true, tables: results };
        }
        log("INFO", table.series + ": finished at point " + pointNumber + ": " + error);
        break;
      }
      if (response === unsetResponse || response.startsWith("ERR,")) {
        log("INFO", table.series + ": point " + pointNumber + " is not set; finished this table");
        break;
      }

      const fields = response.split(",").map(value => value.trim());
      const values = fields.map(Number);
      if (fields.length !== 3 || fields.some(value => value === "")
          || values.some(value => !Number.isFinite(value)) || values[1] < 0 || values[2] <= 0) {
        throw new Error("Invalid " + table.series + " point " + pointNumber + ": " + response);
      }

      const [rawVoltage, actual, pgaFullScaleVolts] = values;
      points.push({ point: pointNumber, rawVoltage, actual, pgaFullScaleVolts });

      // One downloadable series per table. Every point occupies three rows,
      // in raw/actual/PGA order, sharing the same acquisition timestamp.
      const timestamp = new Date();
      record(timestamp, table.series, unit, rawVoltage);
      record(timestamp, table.series, unit, actual);
      record(timestamp, table.series, unit, pgaFullScaleVolts);
      log("INFO", table.series + " point " + pointNumber + " (raw,actual,PGA): " + response);
      progress((tableIndex + pointNumber / maximumPoints) / tables.length);
    }

    if (points.length === 0) {
      log("WARN", table.series + " is empty; no CSV series is created for an empty table");
    }
    log("INFO", table.series + ": dumped " + points.length + " point(s)");
    progress((tableIndex + 1) / tables.length);
  }

  return { device: psuExtDeviceId, tables: results };
})();
