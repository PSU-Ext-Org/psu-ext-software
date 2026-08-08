(() => {
  // Change these values for the three connected Script Runner devices.
  const siglentDeviceId = "SPD4323X";
  const rigolDeviceId = "DM858E";
  const psuExtDeviceId = "PSUEXT1";
  const siglentChannel = "CH2";
  const psuExtChannel = "CH1";

  // CH2/CH3 support the complete 0 V to 24 V point series on an SPD4323X.
  // For PSU-EXT CH1, set this true when the meter is connected after its relay.
  const enablePsuExtOutput = true;
  const currentLimitAmps = 0.10;
  const outputEnableSettlingMilliseconds = 20000;
  const settleMilliseconds = 5000;
  const maximumReferenceDeviationVolts = 0.05;
  const calibrationPointsVolts = [0, 0.5, 1, 3, 5, 8, 15, 24];

  if (calibrationPointsVolts.length < 2 || calibrationPointsVolts.length > 8) {
    throw new Error("PSU-EXT voltage calibration requires two to eight points");
  }

  const sourceOutput = "OUTP " + siglentChannel + ",";
  const psuExtOutput = "OUTP " + psuExtChannel + ",";
  let calibrationTransactionOpen = false;

  try {
    write(siglentDeviceId, sourceOutput + "0");
    log("INFO", "Siglent: " + queryRaw(siglentDeviceId, "*IDN?"));
    log("INFO", "Rigol: " + queryRaw(rigolDeviceId, "*IDN?"));
    log("INFO", "PSU-EXT: " + queryRaw(psuExtDeviceId, "*IDN?"));

    // The Rigol HI/LO leads must be connected at the same point being calibrated.
    write(rigolDeviceId, "CONF:VOLT:DC");
    write(rigolDeviceId, "SENS:VOLT:DC:RANG:AUTO ON");
    write(siglentDeviceId, "SOUR:CURR " + siglentChannel + "," + currentLimitAmps);

    const existingTransaction = queryRaw(psuExtDeviceId, "CALibration:TRANsaction?");
    log("INFO", "PSU-EXT calibration transaction before start: " + existingTransaction);
    if (existingTransaction !== "IDLE") {
      log("WARN", "Aborting unfinished PSU-EXT calibration: " + existingTransaction);
      write(psuExtDeviceId, "CALibration:ABORt");
    }

    if (enablePsuExtOutput) {
      const outOnCommand = psuExtOutput + "1";
      log("INFO", outOnCommand);
      write(psuExtDeviceId, outOnCommand);
    }

    write(psuExtDeviceId, "CALibration:STARt VOLTage," + psuExtChannel);
    calibrationTransactionOpen = true;
    const expectedTransaction = "OPEN,VOLTAGE," + psuExtChannel;
    const openedTransaction = queryRaw(psuExtDeviceId, "CALibration:TRANsaction?");
    log("INFO", "PSU-EXT calibration transaction after start: " + openedTransaction);
    if (openedTransaction !== expectedTransaction) {
      throw new Error("PSU-EXT did not open " + expectedTransaction + ": " + openedTransaction);
    }
    // All eight point slots are overwritten below, so clearing staging is unnecessary.

    write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + ",0");
    write(siglentDeviceId, sourceOutput + "1");
    sleep(outputEnableSettlingMilliseconds);

    for (let index = 0; index < calibrationPointsVolts.length; index += 1) {
      if (cancelled()) {
        return { cancelled: true, completedPoints: index };
      }

      const setpoint = calibrationPointsVolts[index];
      write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + "," + setpoint);
      sleep(settleMilliseconds);

      const actualVoltage = query(rigolDeviceId, "READ?");
      if (!Number.isFinite(actualVoltage)) {
        throw new Error("Rigol returned an invalid voltage at " + setpoint + " V");
      }
      if (Math.abs(actualVoltage - setpoint) > maximumReferenceDeviationVolts) {
        throw new Error(
          "Rigol measured " + actualVoltage + " V at " + setpoint +
            " V; check the Siglent output and PSU-EXT relay or protection state"
        );
      }

      write(
        psuExtDeviceId,
        "CALibration:VOLTage " + psuExtChannel + ",POINt" + (index + 1) + "," + actualVoltage
      );
      record(new Date(), "calibration-voltage", "V", actualVoltage);
      log("INFO", "Point " + (index + 1) + ": set " + setpoint + " V, meter " + actualVoltage + " V");
      progress((index + 1) / calibrationPointsVolts.length);
    }

    log("INFO", "All " + calibrationPointsVolts.length + " calibration points captured");
    write(psuExtDeviceId, "CALibration:COMMit");
    calibrationTransactionOpen = false;
    log("INFO", "Voltage calibration committed for " + psuExtChannel);
    return { completedPoints: calibrationPointsVolts.length, channel: psuExtChannel };
  } finally {
    if (calibrationTransactionOpen) {
      try {
        write(psuExtDeviceId, "CALibration:ABORt");
      } catch (error) {
        log("ERROR", "Could not abort the unfinished calibration: " + error);
      }
    }
    try {
      write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + ",0");
    } catch (error) {
      log("ERROR", "Could not set the Siglent calibration voltage to 0 V: " + error);
    }
    try {
      write(siglentDeviceId, sourceOutput + "0");
      if (enablePsuExtOutput) {
        const outOffCommand = psuExtOutput + "0";
        log("INFO", outOffCommand)
        write(psuExtDeviceId, outOffCommand);
      }
    } catch (error) {
      log("ERROR", "Could not switch calibration outputs off: " + error);
    }
  }
})();
