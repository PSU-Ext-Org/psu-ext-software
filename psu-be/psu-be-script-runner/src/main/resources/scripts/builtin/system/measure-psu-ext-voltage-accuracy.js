(() => {
  // Change these values for the three connected Script Runner devices.
  const siglentDeviceId = "SPD4323X";
  const rigolDeviceId = "DM858E";
  const psuExtDeviceId = "PSUEXT1";
  const siglentChannel = "CH2";
  const psuExtChannel = "CH1";

  // CH2/CH3 support the complete 0 V to 25 V series on an SPD4323X.
  // Set true when measuring PSU-EXT CH1 after its output relay.
  const enablePsuExtOutput = true;
  const currentLimitAmps = 0.10;
  const outputEnableSettlingMilliseconds = 5000;
  const settleMilliseconds = 5000;
  const calibrationAnchorsVolts = [0, 1, 2, 3, 5, 8, 15, 24];
  const interiorPointsPerRange = 5;

  const sourceOutput = "OUTP " + siglentChannel + ",";
  const psuExtOutput = "OUTP " + psuExtChannel + ",";

  function roundedMillivolts(voltage) {
    return Math.round(voltage * 1000) / 1000;
  }

  function createRanges() {
    const ranges = [];

    for (let index = 0; index < calibrationAnchorsVolts.length - 1; index += 1) {
      const minimumVolts = calibrationAnchorsVolts[index];
      const maximumVolts = calibrationAnchorsVolts[index + 1];
      const stepVolts = (maximumVolts - minimumVolts) / (interiorPointsPerRange + 1);
      const setpointsVolts = [];

      for (let step = 1; step <= interiorPointsPerRange; step += 1) {
        setpointsVolts.push(roundedMillivolts(minimumVolts + step * stepVolts));
      }
      setpointsVolts.push(maximumVolts);

      ranges.push({
        name: minimumVolts + "-" + maximumVolts + " V",
        minimumVolts: minimumVolts,
        maximumVolts: maximumVolts,
        setpointsVolts: setpointsVolts,
      });
    }

    return ranges;
  }

  function requireFiniteVoltage(value, deviceName, setpointVolts) {
    if (!Number.isFinite(value)) {
      log("ERROR", value);
      throw new Error(deviceName + " returned an invalid voltage at " + setpointVolts + " V");
    }
  }

  const ranges = createRanges();
  const totalMeasurements = ranges.reduce((total, range) => total + range.setpointsVolts.length, 0);

  if (totalMeasurements !== 42) {
    throw new Error("Expected 42 voltage-accuracy measurements, got " + totalMeasurements);
  }

  let completedMeasurements = 0;
  let overallWorstPoint = null;

  try {
    write(siglentDeviceId, sourceOutput + "0");
    log("INFO", "Siglent: " + queryRaw(siglentDeviceId, "*IDN?"));
    log("INFO", "Rigol: " + queryRaw(rigolDeviceId, "*IDN?"));
    log("INFO", "PSU-EXT: " + queryRaw(psuExtDeviceId, "*IDN?"));

    write(rigolDeviceId, "CONF:VOLT:DC");
    write(rigolDeviceId, "SENS:VOLT:DC:RANG:AUTO ON");
    write(siglentDeviceId, "SOUR:CURR " + siglentChannel + "," + currentLimitAmps);

    if (enablePsuExtOutput) {
      write(psuExtDeviceId, psuExtOutput + "1");
    }

    write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + ",0");
    write(siglentDeviceId, sourceOutput + "1");
    sleep(outputEnableSettlingMilliseconds);

    const resultRanges = [];

    for (const range of ranges) {
      const points = [];

      for (const setpointVolts of range.setpointsVolts) {
        if (cancelled()) {
          return { cancelled: true, completedMeasurements: completedMeasurements };
        }

        write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + "," + setpointVolts);
        sleep(settleMilliseconds);

        const rigolVoltage = query(rigolDeviceId, "READ?");
        const psuExtVoltage = query(psuExtDeviceId, "MEAS:VOLT? " + psuExtChannel);
        requireFiniteVoltage(rigolVoltage, "Rigol", setpointVolts);
        requireFiniteVoltage(psuExtVoltage, "PSU-EXT", setpointVolts);
        if (rigolVoltage === 0) {
          throw new Error("Rigol returned 0 V at non-zero setpoint " + setpointVolts + " V");
        }

        const signedErrorVolts = psuExtVoltage - rigolVoltage;
        const signedErrorPercent = (signedErrorVolts / rigolVoltage) * 100;
        const absoluteErrorPercent = Math.abs(signedErrorPercent);
        const sourceErrorVolts = rigolVoltage - setpointVolts;
        const sourceErrorPercent = (sourceErrorVolts / rigolVoltage) * 100;
        const point = {
          setpointVolts: setpointVolts,
          rigolVoltage: rigolVoltage,
          psuExtVoltage: psuExtVoltage,
          signedErrorVolts: signedErrorVolts,
          signedErrorPercent: signedErrorPercent,
          absoluteErrorPercent: absoluteErrorPercent,
        };

        log(
          "INFO",
          "Range " + range.name + ", set " + setpointVolts + " V, Rigol " + rigolVoltage +
            " V, PSU-EXT " + psuExtVoltage + " V, error " + signedErrorVolts + " V (" +
            signedErrorPercent + " %)"
        );
        log(
          "INFO",
          "Siglent setpoint error at " + setpointVolts + " V: " + sourceErrorVolts + " V (" +
            sourceErrorPercent + " %) against Rigol"
        );

        points.push(point);
        if (overallWorstPoint === null || absoluteErrorPercent > overallWorstPoint.absoluteErrorPercent) {
          overallWorstPoint = point;
        }

        completedMeasurements += 1;
        progress(completedMeasurements / totalMeasurements);
      }

      const meanSignedErrorPercent =
        points.reduce((total, point) => total + point.signedErrorPercent, 0) / points.length;
      const worstPoint = points.reduce((worst, point) =>
        point.absoluteErrorPercent > worst.absoluteErrorPercent ? point : worst
      );

      resultRanges.push({
        range: range.name,
        minimumVolts: range.minimumVolts,
        maximumVolts: range.maximumVolts,
        sampleCount: points.length,
        meanSignedErrorPercent: meanSignedErrorPercent,
        maximumAbsoluteErrorPercent: worstPoint.absoluteErrorPercent,
        worstPoint: worstPoint,
      });
    }

    return {
      ranges: resultRanges,
      overallAccuracyPercent: overallWorstPoint.absoluteErrorPercent,
      overallWorstPoint: overallWorstPoint,
    };
  } finally {
    try {
      write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + ",0");
    } catch (error) {
      log("ERROR", "Could not set the Siglent measurement voltage to 0 V: " + error);
    }
    try {
      write(siglentDeviceId, sourceOutput + "0");
      if (enablePsuExtOutput) {
        write(psuExtDeviceId, psuExtOutput + "0");
      }
    } catch (error) {
      log("ERROR", "Could not switch measurement outputs off: " + error);
    }
  }
})();
