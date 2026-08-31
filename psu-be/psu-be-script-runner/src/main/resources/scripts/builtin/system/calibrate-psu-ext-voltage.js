(() => {
  // Connected Script Runner device IDs.
  const siglentDeviceId = "SPD4323X";
  const rigolDeviceId = "DM858E";
  const psuExtDeviceId = "PSUEXT1";

  const siglentChannel = "CH2";
  const psuExtChannel = "CH1";

  // Set true when the meter is connected after the PSU-EXT relay.
  const enablePsuExtOutput = true;

  const currentLimitAmps = 0.10;
  const outputEnableSettlingMilliseconds = 20000;
  const settleMilliseconds = 5000;
  const maximumReferenceDeviationVolts = 0.05;
  const calibrationPointsVolts = [0, 0.1, 0.25, 0.5, 3, 5, 12, 24];

  if (
    calibrationPointsVolts.length < 2 ||
    calibrationPointsVolts.length > 8
  ) {
    throw new Error(
      "PSU-EXT voltage calibration requires two to eight points"
    );
  }

  const sourceOutput = "OUTP " + siglentChannel + ",";
  const psuExtOutput = "OUTP " + psuExtChannel + ",";

  let calibrationTransactionOpen = false;

  try {
    write(siglentDeviceId, sourceOutput + "0");

    log(
      "INFO",
      "Siglent: " + queryRaw(siglentDeviceId, "*IDN?")
    );
    log(
      "INFO",
      "Rigol: " + queryRaw(rigolDeviceId, "*IDN?")
    );
    log(
      "INFO",
      "PSU-EXT: " + queryRaw(psuExtDeviceId, "*IDN?")
    );

    // The Rigol HI/LO leads must be connected at the point being calibrated.
    write(rigolDeviceId, "CONF:VOLT:DC");
    write(rigolDeviceId, "SENS:VOLT:DC:RANG:AUTO ON");

    write(
      siglentDeviceId,
      "SOUR:CURR " + siglentChannel + "," + currentLimitAmps
    );

    const existingTransaction = queryRaw(
      psuExtDeviceId,
      "CALibration:TRANsaction?"
    );

    log(
      "INFO",
      "PSU-EXT calibration transaction before start: " +
        existingTransaction
    );

    if (existingTransaction !== "IDLE") {
      log(
        "WARN",
        "Aborting unfinished PSU-EXT calibration: " +
          existingTransaction
      );

      write(psuExtDeviceId, "CALibration:ABORt");

      // Synchronize with ABORT.
      const stateAfterAbort = queryRaw(
        psuExtDeviceId,
        "CALibration:TRANsaction?"
      );

      if (stateAfterAbort !== "IDLE") {
        throw new Error(
          "PSU-EXT calibration transaction did not abort: " +
            stateAfterAbort
        );
      }
    }

    if (enablePsuExtOutput) {
      const outputOnCommand = psuExtOutput + "1";
      log("INFO", outputOnCommand);
      write(psuExtDeviceId, outputOnCommand);
    }

    write(
      psuExtDeviceId,
      "CALibration:STARt VOLTage," + psuExtChannel
    );

    calibrationTransactionOpen = true;

    const expectedTransaction =
      "OPEN,VOLTAGE," + psuExtChannel;

    // Synchronize with START and verify its result.
    const openedTransaction = queryRaw(
      psuExtDeviceId,
      "CALibration:TRANsaction?"
    );

    log(
      "INFO",
      "PSU-EXT calibration transaction after start: " +
        openedTransaction
    );

    if (openedTransaction !== expectedTransaction) {
      throw new Error(
        "PSU-EXT did not open " +
          expectedTransaction +
          ": " +
          openedTransaction
      );
    }

    // Remove all old points from the staging table.
    write(
      psuExtDeviceId,
      "CALibration:VOLTage:CLEar " + psuExtChannel
    );

    // Synchronize with CLEAR and verify it completed.
    const clearedCountText = queryRaw(
      psuExtDeviceId,
      "CALibration:VOLTage:COUNt? " + psuExtChannel
    );

    const clearedCount = Number(clearedCountText);

    if (clearedCount !== 0) {
      throw new Error(
        "PSU-EXT calibration table was not cleared; count is " +
          clearedCountText
      );
    }

    write(
      siglentDeviceId,
      "SOUR:VOLT " + siglentChannel + ",0"
    );

    write(siglentDeviceId, sourceOutput + "1");

    sleep(outputEnableSettlingMilliseconds);

    for (
      let index = 0;
      index < calibrationPointsVolts.length;
      index += 1
    ) {
      if (cancelled()) {
        return {
          cancelled: true,
          completedPoints: index
        };
      }

      const pointNumber = index + 1;
      const setpoint = calibrationPointsVolts[index];

      write(
        siglentDeviceId,
        "SOUR:VOLT " + siglentChannel + "," + setpoint
      );

      sleep(settleMilliseconds);

      const actualVoltage = query(
        rigolDeviceId,
        "READ?"
      );

      if (!Number.isFinite(actualVoltage)) {
        throw new Error(
          "Rigol returned an invalid voltage at " +
            setpoint +
            " V"
        );
      }

      if (
        Math.abs(actualVoltage - setpoint) >
        maximumReferenceDeviationVolts
      ) {
        throw new Error(
          "Rigol measured " +
            actualVoltage +
            " V at " +
            setpoint +
            " V; check the Siglent output, PSU-EXT relay, and protection state"
        );
      }

      /*
       * Firmware calibration values use unsigned u4 fixed point.
       * A DMM can report a few negative microvolts at nominal zero,
       * so clamp the calibration reference to zero.
       */
      const calibrationVoltage = Math.max(0, actualVoltage);

      const captureCommand =
        "CALibration:VOLTage " +
        psuExtChannel +
        ",POINt" +
        pointNumber +
        "," +
        calibrationVoltage;

      log(
        "INFO",
        "Capturing point " +
          pointNumber +
          ": set " +
          setpoint +
          " V, meter " +
          actualVoltage +
          " V"
      );

      write(psuExtDeviceId, captureCommand);

      /*
       * Critical synchronization:
       *
       * write() returns before the firmware finishes its 16-sample capture.
       * The query is processed only after that capture command completes.
       * Do not change the source voltage before this query returns.
       *
       * If capture fails, the pending ERR response is observed here.
       */
      const capturedPoint = queryRaw(
        psuExtDeviceId,
        "CALibration:VOLTage? " +
          psuExtChannel +
          ",POINt" +
          pointNumber
      );

      log(
        "INFO",
        "Point " +
          pointNumber +
          " captured: set " +
          setpoint +
          " V, meter " +
          actualVoltage +
          " V, reference " +
          calibrationVoltage +
          " V, stored raw/actual " +
          capturedPoint
      );

      record(
        new Date(),
        "calibration-voltage",
        "V",
        actualVoltage
      );

      progress(
        pointNumber / calibrationPointsVolts.length
      );
    }

    const capturedCountText = queryRaw(
      psuExtDeviceId,
      "CALibration:VOLTage:COUNt? " + psuExtChannel
    );

    const capturedCount = Number(capturedCountText);

    if (capturedCount !== calibrationPointsVolts.length) {
      throw new Error(
        "PSU-EXT captured " +
          capturedCountText +
          " points; expected " +
          calibrationPointsVolts.length
      );
    }

    log(
      "INFO",
      "All " +
        calibrationPointsVolts.length +
        " calibration points captured"
    );

    write(psuExtDeviceId, "CALibration:COMMit");

    // Synchronize with COMMIT and ensure the transaction closed.
    const transactionAfterCommit = queryRaw(
      psuExtDeviceId,
      "CALibration:TRANsaction?"
    );

    if (transactionAfterCommit !== "IDLE") {
      throw new Error(
        "PSU-EXT calibration commit did not complete: " +
          transactionAfterCommit
      );
    }

    calibrationTransactionOpen = false;

    log(
      "INFO",
      "Voltage calibration committed for " + psuExtChannel
    );

    return {
      completedPoints: calibrationPointsVolts.length,
      channel: psuExtChannel
    };
  } finally {
    if (calibrationTransactionOpen) {
      try {
        write(psuExtDeviceId, "CALibration:ABORt");

        const transactionAfterAbort = queryRaw(
          psuExtDeviceId,
          "CALibration:TRANsaction?"
        );

        log(
          "INFO",
          "PSU-EXT transaction after abort: " +
            transactionAfterAbort
        );
      } catch (error) {
        log(
          "ERROR",
          "Could not abort the unfinished calibration: " +
            error
        );
      }
    }

    try {
      write(
        siglentDeviceId,
        "SOUR:VOLT " + siglentChannel + ",0"
      );
    } catch (error) {
      log(
        "ERROR",
        "Could not set the Siglent calibration voltage to 0 V: " +
          error
      );
    }

    try {
      write(siglentDeviceId, sourceOutput + "0");
    } catch (error) {
      log(
        "ERROR",
        "Could not switch off the Siglent output: " +
          error
      );
    }

    if (enablePsuExtOutput) {
      try {
        const outputOffCommand = psuExtOutput + "0";
        log("INFO", outputOffCommand);
        write(psuExtDeviceId, outputOffCommand);
      } catch (error) {
        log(
          "ERROR",
          "Could not switch off the PSU-EXT output: " +
            error
        );
      }
    }
  }
})();