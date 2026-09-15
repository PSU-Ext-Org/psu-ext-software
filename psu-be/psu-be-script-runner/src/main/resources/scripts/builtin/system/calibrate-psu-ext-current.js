(() => {
  // Change these values for the three connected Script Runner devices.
  const siglentDeviceId = "SPD4323X";
  const rigolDeviceId = "DM858E";
  const psuExtDeviceId = "PSUEXT1";
  const siglentChannel = "CH2";
  const psuExtChannel = "CH1";

  // The Siglent powers the calibration circuit. Adjust its voltage or the
  // external load manually to reach the target current at each prompt.
  //
  // The Rigol reading, rather than the requested target, is stored in the
  // calibration point. This keeps the calibration tied to the measured value.
  const sourceCurrentLimitAmps = 2.2;
  const enablePsuExtOutput = true;
  const outputEnableSettlingMilliseconds = 5000;
  const measurementSettlingMilliseconds = 2000;
  const operatorInputTimeoutMilliseconds = 5 * 60 * 1000;

  // Choose as many ascending points as the calibration procedure requires.
  // A replacement calibration commits only the points captured in this run.
  const calibrationTargetCurrentsAmps = [
    0, 0.0010, 0.0030, 0.0050, 0.0100, 0.0500, 0.1000, 0.250, 0.500
  ];

  if (psuExtChannel !== "CH1") {
    throw new Error("PSU-EXT current calibration supports only CH1");
  }

  const sourceOutput = "OUTP " + siglentChannel + ",";
  const psuExtOutput = "OUTP " + psuExtChannel + ",";
  let calibrationTransactionOpen = false;
  let previousActualCurrentAmps = -1;
  let completedPoints = 0;

  try {
    write(siglentDeviceId, sourceOutput + "0");
    log("INFO", "Siglent: " + queryRaw(siglentDeviceId, "*IDN?"));
    log("INFO", "Rigol: " + queryRaw(rigolDeviceId, "*IDN?"));
    log("INFO", "PSU-EXT: " + queryRaw(psuExtDeviceId, "*IDN?"));

    write(rigolDeviceId, "CONF:CURR:DC");
    write(rigolDeviceId, "SENS:CURR:DC:RANG:AUTO ON");
    write(siglentDeviceId, "SOUR:CURR " + siglentChannel + "," + sourceCurrentLimitAmps);

    // A previous interrupted run leaves a transaction open; close it before
    // starting a new one so its captured values cannot be reused accidentally.
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
      throw new Error(
        "PSU-EXT did not acknowledge " + expectedTransaction + ": " + startAcknowledgement
      );
    }

    // Apply power only after PSU-EXT has accepted the calibration transaction.
    write(siglentDeviceId, sourceOutput + "1");
    sleep(outputEnableSettlingMilliseconds);

    for (let index = 0; index < calibrationTargetCurrentsAmps.length; index += 1) {
      if (cancelled()) {
        return { cancelled: true, completedPoints: index };
      }

      const targetCurrentAmps = calibrationTargetCurrentsAmps[index];
      const targetCurrentMilliamps = targetCurrentAmps * 1000;

      // Empty input continues with this point. Entering 0 commits only the
      // points already captured and skips all remaining target points.
      const operatorResponse = input(
        "Set the target current to " + targetCurrentMilliamps +
          " mA. Press Enter when the Rigol reading is stable, or enter 0 to commit now " +
          "(5-minute timeout).",
        operatorInputTimeoutMilliseconds
      );
      if (operatorResponse === 0) {
        log(
          "INFO",
          "Committing current calibration after " + completedPoints + " captured point(s)."
        );
        break;
      }

      sleep(measurementSettlingMilliseconds);

      const rigolCurrentAmps = query(rigolDeviceId, "READ?");

      if (!Number.isFinite(rigolCurrentAmps)) {
        throw new Error("Rigol returned an invalid current at target " + targetCurrentAmps + " A");
      }

      // PSU-EXT calibration references are unsigned. Do not turn a negative
      // Rigol reading into a synthetic zero-current point; ask the operator to
      // correct the setup and retry this point instead.
      if (rigolCurrentAmps < 0) {
        log("WARN", "Rigol returned a negative current; point not captured. Correct the setup and retry.");
        index -= 1;
        continue;
      }

      const calibrationCurrentAmps = Number(rigolCurrentAmps.toFixed(4));

      if (calibrationCurrentAmps <= previousActualCurrentAmps) {
        throw new Error(
          "Rigol current must increase at every calibration point; target " +
            targetCurrentAmps + " A measured " + calibrationCurrentAmps + " A after " +
            previousActualCurrentAmps + " A"
        );
      }

      write(
        psuExtDeviceId,
        "CALibration:CURRent CH1,POINt" + (completedPoints + 1) + "," + calibrationCurrentAmps.toFixed(4)
      );

      // A successful point command has synchronously captured and staged its
      // fresh Q16.16 raw coordinate. The device validates raw-coordinate and
      // PGA ordering on COMMit; do not reinterpret diagnostic query text here.
      previousActualCurrentAmps = calibrationCurrentAmps;
      completedPoints += 1;

      record(new Date(), "calibration-current", "A", rigolCurrentAmps);
      log(
        "INFO",
        "Point " + (index + 1) + ": target " + targetCurrentMilliamps +
          " mA, Rigol " + rigolCurrentAmps +
          " A, calibration value " + calibrationCurrentAmps.toFixed(4) + " A"
      );
      progress((index + 1) / calibrationTargetCurrentsAmps.length);
    }

    // COMMit makes the captured table persistent; an open transaction is
    // otherwise aborted by the cleanup block below.
    write(psuExtDeviceId, "CALibration:COMMit");

    const committedTransaction = queryRaw(psuExtDeviceId, "CALibration:TRANsaction?");

    if (committedTransaction !== "IDLE") {
      throw new Error("PSU-EXT did not complete current calibration: " + committedTransaction);
    }

    calibrationTransactionOpen = false;
    log("INFO", "Current calibration committed for CH1");

    return {
      completedPoints,
      channel: "CH1",
      targetCurrentsAmps: calibrationTargetCurrentsAmps
    };
  } finally {
    // Never leave either output enabled, including after cancellation, timeout,
    // or a rejected calibration point.
    if (calibrationTransactionOpen) {
      try {
        write(psuExtDeviceId, "CALibration:ABORt");
      } catch (error) {
        log("ERROR", "Could not abort unfinished calibration: " + error);
      }
    }

    try {
      write(siglentDeviceId, sourceOutput + "0");

      if (enablePsuExtOutput) {
        write(psuExtDeviceId, psuExtOutput + "0");
      }
    } catch (error) {
      log("ERROR", "Could not switch calibration outputs off: " + error);
    }
  }
})();
