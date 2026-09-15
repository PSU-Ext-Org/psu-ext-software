(() => {
  // Change these values for the three connected Script Runner devices.
  const siglentDeviceId = "SPD4323X";
  const rigolDeviceId = "DM858E";
  const psuExtDeviceId = "PSUEXT1";
  const siglentChannel = "CH2";
  const psuExtChannel = "CH1";

  // Wire the Rigol in series with the load and PSU-EXT CH1.
  const highValueLoadOhms = 1000;
  const lowValueLoadOhms = 47;
  const sourceCurrentLimitAmps = 1;
  const maximumSourceVoltageVolts = 24;
  const enablePsuExtOutput = true;
  const outputEnableSettlingMilliseconds = 5000;
  // PSU-EXT averages 50 samples at 128 SPS; wait at least five seconds.
  const settleMilliseconds = 5000;
  const zeroOffsetSampleCount = 5;
  const zeroOffsetSampleIntervalMilliseconds = 500;
  // Below this Rigol reference current, report mA error only, not percentage.
  const minimumCurrentForPercentageAmps = 0.005;
  const operatorInputTimeoutMilliseconds = 5 * 60 * 1000;
  const zeroCurrentToleranceAmps = 0.001;

  const highValueSetpointsVolts = [0, 1, 3, 5, 8, 12, 15, 18, 21, 24];
  // 24 V / 47 Ohm is about 0.51 A and 12 W, so it is intentionally excluded.
  const lowValueSetpointsVolts = [0, 1, 3, 5, 8, 12, 15, 18, 20, 21];

  if (psuExtChannel !== "CH1") {
    throw new Error("PSU-EXT current measurements support only CH1");
  }
  if (highValueSetpointsVolts.length !== 10 || lowValueSetpointsVolts.length !== 10) {
    throw new Error("Each resistor sweep must contain exactly 10 points");
  }
  if (lowValueSetpointsVolts.some((voltage) => voltage / lowValueLoadOhms >= 0.5)) {
    throw new Error("The 47 Ohm sweep must not operate at or above 0.5 A");
  }

  const sourceOutput = "OUTP " + siglentChannel + ",";
  const psuExtOutput = "OUTP " + psuExtChannel + ",";
  const totalMeasurements = zeroOffsetSampleCount + highValueSetpointsVolts.length + lowValueSetpointsVolts.length;
  let completedMeasurements = 0;
  let overallWorstPoint = null;

  function requireRawCurrent(value, deviceName, setpointVolts) {
    if (!Number.isFinite(value) || value < -zeroCurrentToleranceAmps) {
      throw new Error(deviceName + " returned an invalid current at " + setpointVolts + " V");
    }
    return value < 0 ? 0 : value;
  }

  function average(values) {
    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  // Measure PSU-EXT at the first range, with the source at 0 V.
  // Later PSU-EXT readings subtract this mean zero offset. The Rigol remains
  // the unmodified reference for every accuracy calculation.
  function measureZeroOffsets() {
    const psuExtSamples = [];
    write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + ",0");
    log("INFO", "Capturing " + zeroOffsetSampleCount + " zero-current samples.");

    for (let index = 0; index < zeroOffsetSampleCount; index += 1) {
      if (cancelled()) {
        return { cancelled: true };
      }
      psuExtSamples.push(requireRawCurrent(query(psuExtDeviceId, "MEAS:CURR? " + psuExtChannel), "PSU-EXT", 0));
      completedMeasurements += 1;
      progress(completedMeasurements / totalMeasurements);
      if (index + 1 < zeroOffsetSampleCount) {
        sleep(zeroOffsetSampleIntervalMilliseconds);
      }
    }

    const offsets = {
      psuExtCurrentAmps: average(psuExtSamples),
      psuExtSamples: psuExtSamples,
    };
    log(
      "INFO",
      "PSU-EXT zero offset: " + (offsets.psuExtCurrentAmps * 1000) +
        " mA. It is subtracted from later PSU-EXT readings."
    );
    return { cancelled: false, offsets: offsets };
  }

  function measureSweep(loadName, loadOhms, setpointsVolts, offsets) {
    const points = [];

    for (const setpointVolts of setpointsVolts) {
      if (cancelled()) {
        return { cancelled: true, points: points };
      }
      write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + "," + setpointVolts);
      sleep(settleMilliseconds);

      const rigolRawCurrent = requireRawCurrent(query(rigolDeviceId, "READ?"), "Rigol", setpointVolts);
      const psuExtRawCurrent = requireRawCurrent(
        query(psuExtDeviceId, "MEAS:CURR? " + psuExtChannel), "PSU-EXT", setpointVolts
      );
      const rigolCurrent = rigolRawCurrent;
      const psuExtCurrent = psuExtRawCurrent - offsets.psuExtCurrentAmps;
      const signedErrorAmps = psuExtCurrent - rigolCurrent;
      const signedErrorMilliamps = signedErrorAmps * 1000;
      const percentageApplicable = rigolCurrent >= minimumCurrentForPercentageAmps;
      const signedErrorPercent = percentageApplicable ? (signedErrorAmps / rigolCurrent) * 100 : null;
      const point = {
        loadOhms: loadOhms,
        setpointVolts: setpointVolts,
        estimatedCurrentAmps: setpointVolts / loadOhms,
        rigolRawCurrent: rigolRawCurrent,
        psuExtRawCurrent: psuExtRawCurrent,
        rigolCurrent: rigolCurrent,
        psuExtCurrent: psuExtCurrent,
        signedErrorAmps: signedErrorAmps,
        signedErrorMilliamps: signedErrorMilliamps,
        signedErrorPercent: signedErrorPercent,
        percentageApplicable: percentageApplicable,
        absoluteErrorMilliamps: Math.abs(signedErrorMilliamps),
      };

      log(
        "INFO",
        loadName + ", set " + setpointVolts + " V, Rigol " +
          (rigolCurrent * 1000) + " mA, corrected PSU-EXT " + (psuExtCurrent * 1000) +
          " mA, error " + signedErrorMilliamps + " mA" +
          (percentageApplicable ? " (" + signedErrorPercent + " %)" : " (percentage omitted below 5 mA)")
      );
      points.push(point);
      if (overallWorstPoint === null || point.absoluteErrorMilliamps > overallWorstPoint.absoluteErrorMilliamps) {
        overallWorstPoint = point;
      }
      completedMeasurements += 1;
      progress(completedMeasurements / totalMeasurements);

      // Remove load power between points; this limits 47 Ohm resistor heating.
      write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + ",0");
    }

    return { cancelled: false, points: points };
  }

  try {
    write(siglentDeviceId, sourceOutput + "0");
    log("INFO", "Siglent: " + queryRaw(siglentDeviceId, "*IDN?"));
    log("INFO", "Rigol: " + queryRaw(rigolDeviceId, "*IDN?"));
    log("INFO", "PSU-EXT: " + queryRaw(psuExtDeviceId, "*IDN?"));
    write(rigolDeviceId, "CONF:CURR:DC");
    write(rigolDeviceId, "SENS:CURR:DC:RANG:AUTO ON");
    write(siglentDeviceId, "SOUR:CURR " + siglentChannel + "," + sourceCurrentLimitAmps);
    if (enablePsuExtOutput) {
      write(psuExtDeviceId, psuExtOutput + "1");
    }
    write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + ",0");
    write(siglentDeviceId, sourceOutput + "1");
    sleep(outputEnableSettlingMilliseconds);

    const zeroOffsetResult = measureZeroOffsets();
    if (zeroOffsetResult.cancelled) {
      return { cancelled: true, completedMeasurements: completedMeasurements };
    }
    const zeroOffsets = zeroOffsetResult.offsets;
    log("INFO", "Starting 1 kOhm sweep: 10 points, 5 s settling per point.");
    const highValueLoad = measureSweep("1 kOhm load", highValueLoadOhms, highValueSetpointsVolts, zeroOffsets);
    if (highValueLoad.cancelled) {
      return { cancelled: true, zeroOffsets: zeroOffsets, highValueLoad: highValueLoad };
    }

    write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + ",0");
    write(siglentDeviceId, sourceOutput + "0");
    const continueWithLowValueLoad = input(
      "Siglent output is OFF. Replace the 1 kOhm load with the 47 Ohm load, then enter 1 to continue. Enter 0 to finish.",
      operatorInputTimeoutMilliseconds
    );
    if (continueWithLowValueLoad === 0) {
      return {
        zeroOffsets: zeroOffsets,
        highValueLoad: highValueLoad,
        lowValueLoadSkipped: true,
        completedMeasurements: completedMeasurements,
        maximumAbsoluteErrorMilliamps: overallWorstPoint.absoluteErrorMilliamps,
        overallWorstPoint: overallWorstPoint,
      };
    }

    write(siglentDeviceId, sourceOutput + "1");
    sleep(outputEnableSettlingMilliseconds);
    log("WARN", "Starting 47 Ohm sweep. It stops at 21 V (about 0.45 A); 24 V is excluded.");
    const lowValueLoad = measureSweep("47 Ohm load", lowValueLoadOhms, lowValueSetpointsVolts, zeroOffsets);
    return {
      cancelled: lowValueLoad.cancelled,
      zeroOffsets: zeroOffsets,
      highValueLoad: highValueLoad,
      lowValueLoad: lowValueLoad,
      completedMeasurements: completedMeasurements,
      maximumAbsoluteErrorMilliamps: overallWorstPoint.absoluteErrorMilliamps,
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