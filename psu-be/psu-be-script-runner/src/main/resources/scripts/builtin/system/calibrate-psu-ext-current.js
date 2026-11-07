(() => {
  const siglentDeviceId = "SPD4323X";
  const rigolDeviceId = "DM858E";
  const psuExtDeviceId = "PSUEXT1";
  const siglentChannel = "CH2";
  const psuExtChannel = "CH1";

  // Configure the PSU-EXT response timeout in Script Runner to >= 35 seconds.
  const sourceCurrentLimitAmps = 2.5;
  const enablePsuExtOutput = true;
  const outputEnableSettlingMilliseconds = 5000;
  const measurementSettlingMilliseconds = 2000;
  const operatorInputTimeoutMilliseconds = 5 * 60 * 1000;

  const calibrationTargetCurrentsAmps = [
    0, 0.0010, 0.0030, 0.0050, 0.0100, 0.0500, 0.1000,
    0.250, 0.500, 0.700, 1, 1.5, 2, 2.4
  ];

  if (psuExtChannel !== "CH1") {
    throw new Error("PSU-EXT current calibration supports only CH1");
  }

  const sourceOutput = "OUTP " + siglentChannel + ",";
  const psuExtOutput = "OUTP " + psuExtChannel + ",";
  const expectedTransaction = "OPEN,CURRENT,CH1";

  let calibrationTransactionOpen = false;
  let previousActualCurrentAmps = -1;
  let completedPoints = 0;

  function readPsuExt(command) {
    const response = String(queryRaw(psuExtDeviceId, command)).trim();

    if (/^ERR\b/i.test(response)) {
      throw new Error("PSU-EXT error while confirming " + command + ": " + response);
    }

    return response;
  }

  function requireTransaction(expected) {
    const response = readPsuExt("CALibration:TRANsaction?");

    if (response !== expected) {
      throw new Error(
        "Expected PSU-EXT transaction " + expected + ", received: " + response
      );
    }
  }

  function confirmPoint(pointIndex, expectedCurrentAmps) {
    // The firmware processes this query after the preceding capture command.
    // Reply format: raw ADC voltage, stored reference current, PGA full scale.
    const command = "CALibration:CURRent? CH1,POINt" + pointIndex;
    const response = readPsuExt(command);
    const fields = response.split(",").map(value => value.trim());

    if (
      fields.length !== 3 ||
      fields.some(value => value === "" || !Number.isFinite(Number(value)))
    ) {
      throw new Error(
        "Invalid readback for point " + pointIndex + ": " + response
      );
    }

    const rawVoltage = Number(fields[0]);
    const storedCurrentAmps = Number(fields[1]);
    const pgaFullScaleVolts = Number(fields[2]);

    // Compare in the firmware's 0.0001 A reference units.
    if (
      storedCurrentAmps < 0 ||
      Math.round(storedCurrentAmps * 10000) !==
        Math.round(expectedCurrentAmps * 10000) ||
      pgaFullScaleVolts <= 0
    ) {
      throw new Error(
        "Point " + pointIndex + " confirmation failed: expected " +
        expectedCurrentAmps.toFixed(4) + " A, received: " + response
      );
    }

    log(
      "INFO",
      "Confirmed point " + pointIndex +
        ": stored " + storedCurrentAmps.toFixed(4) +
        " A, raw " + rawVoltage.toFixed(6) +
        " V, PGA ±" + pgaFullScaleVolts.toFixed(3) + " V"
    );
  }

  try {
    write(siglentDeviceId, sourceOutput + "0");

    log("INFO", "Siglent: " + queryRaw(siglentDeviceId, "*IDN?"));
    log("INFO", "Rigol: " + queryRaw(rigolDeviceId, "*IDN?"));
    log("INFO", "PSU-EXT: " + readPsuExt("*IDN?"));

    write(rigolDeviceId, "CONF:CURR:DC");
    write(rigolDeviceId, "SENS:CURR:DC:RANG:AUTO ON");
    write(
      siglentDeviceId,
      "SOUR:CURR " + siglentChannel + "," + sourceCurrentLimitAmps
    );

    const existingTransaction = readPsuExt("CALibration:TRANsaction?");

    if (existingTransaction !== "IDLE") {
      log("WARN", "Aborting unfinished calibration: " + existingTransaction);
      write(psuExtDeviceId, "CALibration:ABORt");
      requireTransaction("IDLE");
    }

    if (enablePsuExtOutput) {
      write(psuExtDeviceId, psuExtOutput + "1");
    }

    write(psuExtDeviceId, "CALibration:STARt CURRent,CH1");
    calibrationTransactionOpen = true;
    requireTransaction(expectedTransaction);

    write(siglentDeviceId, sourceOutput + "1");
    sleep(outputEnableSettlingMilliseconds);

    for (let index = 0; index < calibrationTargetCurrentsAmps.length; index += 1) {
      if (cancelled()) {
        return { cancelled: true, completedPoints };
      }

      const targetCurrentAmps = calibrationTargetCurrentsAmps[index];
      const targetCurrentMilliamps = targetCurrentAmps * 1000;

      const operatorResponse = input(
        "Set the target current to " + targetCurrentMilliamps +
          " mA. Press Enter when the Rigol reading is stable, or enter 0 " +
          "to commit the confirmed points (5-minute timeout).",
        operatorInputTimeoutMilliseconds
      );

      if (operatorResponse === 0) {
        log(
          "INFO",
          "Committing after " + completedPoints + " confirmed point(s)."
        );
        break;
      }

      sleep(measurementSettlingMilliseconds);

      const rigolCurrentAmps = query(rigolDeviceId, "READ?");

      if (!Number.isFinite(rigolCurrentAmps)) {
        throw new Error(
          "Rigol returned an invalid current at target " + targetCurrentAmps + " A"
        );
      }

      const calibrationCurrentAmps = Number(rigolCurrentAmps.toFixed(4));

      // Permit tiny negative zero readings that round to zero, as in the
      // supplied script, but reject values that remain negative after rounding.
      if (calibrationCurrentAmps < 0) {
        throw new Error(
          "Rigol current is negative: " + rigolCurrentAmps + " A"
        );
      }

      if (calibrationCurrentAmps <= previousActualCurrentAmps) {
        throw new Error(
          "Rigol current must increase at every calibration point; target " +
            targetCurrentAmps + " A measured " + calibrationCurrentAmps +
            " A after " + previousActualCurrentAmps + " A"
        );
      }

      const pointIndex = completedPoints + 1;

      log(
        "INFO",
        "Capturing point " + pointIndex + ": " +
          calibrationCurrentAmps.toFixed(4) + " A; waiting for confirmation."
      );

      try {
        write(
          psuExtDeviceId,
          "CALibration:CURRent CH1,POINt" + pointIndex + "," +
            calibrationCurrentAmps.toFixed(4)
        );

        // Do not update progress or ask for the next point until readback agrees.
        confirmPoint(pointIndex, calibrationCurrentAmps);
      } catch (error) {
        throw new Error(
          "Point " + pointIndex + " at target " + targetCurrentMilliamps +
            " mA was not confirmed: " + error
        );
      }

      previousActualCurrentAmps = calibrationCurrentAmps;
      completedPoints += 1;

      record(new Date(), "calibration-current", "A", rigolCurrentAmps);
      log(
        "INFO",
        "Point " + pointIndex + " completed: target " +
          targetCurrentMilliamps + " mA, Rigol " + rigolCurrentAmps + " A"
      );
      progress((index + 1) / calibrationTargetCurrentsAmps.length);
    }

    write(psuExtDeviceId, "CALibration:COMMit");
    requireTransaction("IDLE");

    calibrationTransactionOpen = false;
    log("INFO", "Current calibration committed for CH1");

    return {
      completedPoints,
      channel: "CH1",
      targetCurrentsAmps: calibrationTargetCurrentsAmps
    };
  } finally {
    // Attempt each output shutdown independently, before transaction cleanup.
    try {
      write(siglentDeviceId, sourceOutput + "0");
    } catch (error) {
      log("ERROR", "Could not switch Siglent output off: " + error);
    }

    if (enablePsuExtOutput) {
      try {
        write(psuExtDeviceId, psuExtOutput + "0");
      } catch (error) {
        log("ERROR", "Could not switch PSU-EXT output off: " + error);
      }
    }

    if (calibrationTransactionOpen) {
      try {
        write(psuExtDeviceId, "CALibration:ABORt");
        requireTransaction("IDLE");
      } catch (error) {
        log("ERROR", "Could not confirm calibration abort: " + error);
      }
    }
  }
})();