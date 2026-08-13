(() => {
  // Change these values for the three connected Script Runner devices.
  const siglentDeviceId = "SPD4323X";
  const rigolDeviceId = "DM858E";
  const psuExtDeviceId = "PSUEXT1";
  const siglentChannel = "CH2";
  const psuExtChannel = "CH1";

  // The source remains at this voltage throughout calibration. Adjust the
  // external load manually to each prompted current before pressing Enter.
  const sourceVoltageVolts = 5;
  const sourceCurrentLimitAmps = 2.2;
  const enablePsuExtOutput = true;
  const outputEnableSettlingMilliseconds = 5000;
  const measurementSettlingMilliseconds = 2000;
  const operatorInputTimeoutMilliseconds = 15 * 60 * 1000;
  const calibrationTargetCurrentsAmps = [0, 0.0010, 0.0050, 0.0100, 0.0500, 0.1000, 0.250, 0.500];

  if (psuExtChannel !== "CH1") {
    throw new Error("PSU-EXT current calibration supports only CH1");
  }
  if (calibrationTargetCurrentsAmps.length !== 8) {
    throw new Error("PSU-EXT current calibration requires exactly eight points");
  }

  const sourceOutput = "OUTP " + siglentChannel + ",";
  const psuExtOutput = "OUTP " + psuExtChannel + ",";
  let calibrationTransactionOpen = false;
  let previousActualCurrentAmps = -1;
  let previousCapturedRawValue = -1;

  try {
    write(siglentDeviceId, sourceOutput + "0");
    log("INFO", "Siglent: " + queryRaw(siglentDeviceId, "*IDN?"));
    log("INFO", "Rigol: " + queryRaw(rigolDeviceId, "*IDN?"));
    log("INFO", "PSU-EXT: " + queryRaw(psuExtDeviceId, "*IDN?"));
    log("INFO", "Current calibration source voltage: " + sourceVoltageVolts + " V");

    write(rigolDeviceId, "CONF:CURR:DC");
    write(rigolDeviceId, "SENS:CURR:DC:RANG:AUTO ON");
    write(siglentDeviceId, "SOUR:CURR " + siglentChannel + "," + sourceCurrentLimitAmps);
    write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + "," + sourceVoltageVolts);

    const existingTransaction = queryRaw(psuExtDeviceId, "CALibration:TRANsaction?");
    if (existingTransaction !== "IDLE") {
      log("WARN", "Aborting unfinished PSU-EXT calibration: " + existingTransaction);
      write(psuExtDeviceId, "CALibration:ABORt");
    }

    if (enablePsuExtOutput) {
      write(psuExtDeviceId, psuExtOutput + "1");
    }

    write(psuExtDeviceId, "CALibration:STARt CURRent,CH1");
    calibrationTransactionOpen = true;
    const expectedTransaction = "OPEN,CURRENT,CH1";
    const startAcknowledgement = queryRaw(psuExtDeviceId, "CALibration:TRANsaction?");
    if (startAcknowledgement !== expectedTransaction) {
      throw new Error("PSU-EXT did not acknowledge " + expectedTransaction + ": " + startAcknowledgement);
    }

    write(siglentDeviceId, sourceOutput + "1");
    sleep(outputEnableSettlingMilliseconds);

    for (let index = 0; index < calibrationTargetCurrentsAmps.length; index += 1) {
      if (cancelled()) {
        return { cancelled: true, completedPoints: index };
      }

      const targetCurrentAmps = calibrationTargetCurrentsAmps[index];
      const targetCurrentMilliamps = targetCurrentAmps * 1000;
      input(
        "Set the external load to " + targetCurrentMilliamps + " mA at " + sourceVoltageVolts +
          " V. Press Enter when the Rigol reading is stable.",
        operatorInputTimeoutMilliseconds
      );
      sleep(measurementSettlingMilliseconds);

      const rigolCurrentAmps = query(rigolDeviceId, "READ?");
      if (!Number.isFinite(rigolCurrentAmps)) {
        throw new Error("Rigol returned an invalid current at target " + targetCurrentAmps + " A");
      }
      const actualCurrentAmps = rigolCurrentAmps < 0 ? 0 : rigolCurrentAmps;
      if (rigolCurrentAmps < 0) {
        log("WARN", "Rigol returned negative current; using 0 A for calibration");
      }
      const calibrationCurrentAmps = Number(actualCurrentAmps.toFixed(4));
      if (calibrationCurrentAmps <= previousActualCurrentAmps) {
        throw new Error("Rigol current must increase at every calibration point; target " +
          targetCurrentAmps + " A measured " + calibrationCurrentAmps + " A after " +
          previousActualCurrentAmps + " A");
      }

      write(psuExtDeviceId,
        "CALibration:CURRent CH1,POINt" + (index + 1) + "," + calibrationCurrentAmps.toFixed(4));
      const capturedPoint = queryRaw(psuExtDeviceId, "CALibration:CURRent? CH1,POINt" + (index + 1));
      const capturedValues = capturedPoint.split(",");
      const capturedRawValue = Number(capturedValues[0]);
      const capturedActualCurrentAmps = Number(capturedValues[1]);
      if (capturedValues.length !== 2 || !Number.isFinite(capturedRawValue)
          || !Number.isFinite(capturedActualCurrentAmps)) {
        throw new Error("PSU-EXT returned an invalid captured point: " + capturedPoint);
      }
      if (capturedRawValue <= previousCapturedRawValue || capturedActualCurrentAmps <= previousActualCurrentAmps) {
        throw new Error("PSU-EXT calibration points must increase strictly; captured " + capturedPoint);
      }

      previousActualCurrentAmps = capturedActualCurrentAmps;
      previousCapturedRawValue = capturedRawValue;
      record(new Date(), "calibration-current", "A", rigolCurrentAmps);
      log("INFO", "Point " + (index + 1) + ": target " + targetCurrentMilliamps +
        " mA at " + sourceVoltageVolts + " V, Rigol " + rigolCurrentAmps +
        " A, calibration value " + calibrationCurrentAmps.toFixed(4) + " A");
      progress((index + 1) / calibrationTargetCurrentsAmps.length);
    }

    write(psuExtDeviceId, "CALibration:COMMit");
    const committedTransaction = queryRaw(psuExtDeviceId, "CALibration:TRANsaction?");
    if (committedTransaction !== "IDLE") {
      throw new Error("PSU-EXT did not complete current calibration: " + committedTransaction);
    }
    calibrationTransactionOpen = false;
    log("INFO", "Current calibration committed for CH1");
    return { completedPoints: calibrationTargetCurrentsAmps.length, channel: "CH1", sourceVoltageVolts,
      targetCurrentsAmps: calibrationTargetCurrentsAmps };
  } finally {
    if (calibrationTransactionOpen) {
      try { write(psuExtDeviceId, "CALibration:ABORt"); } catch (error) {
        log("ERROR", "Could not abort unfinished calibration: " + error);
      }
    }
    try {
      write(siglentDeviceId, sourceOutput + "0");
      if (enablePsuExtOutput) write(psuExtDeviceId, psuExtOutput + "0");
    } catch (error) {
      log("ERROR", "Could not switch calibration outputs off: " + error);
    }
  }
})();
