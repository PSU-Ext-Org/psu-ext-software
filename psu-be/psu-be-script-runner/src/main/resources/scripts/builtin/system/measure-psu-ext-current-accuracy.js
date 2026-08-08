(() => {
  // Change these values for the three connected Script Runner devices.
  const siglentDeviceId = "SPD4323X";
  const rigolDeviceId = "DM858E";
  const psuExtDeviceId = "PSUEXT1";
  const siglentChannel = "CH2";
  const psuExtChannel = "CH1";

  // The Rigol must be wired in series with this fixed load resistor.
  const loadResistorOhms = 47;
  const sourceCurrentLimitAmps = 1;
  const maximumSourceVoltageVolts = 24;
  const enablePsuExtOutput = true;
  const outputEnableSettlingMilliseconds = 5000;
  const settleMilliseconds = 5000;
  const zeroCurrentToleranceAmps = 0.001;
  const targetCurrentsAmps = [0, 0.005, 0.010, 0.050, 0.100, 0.200, 0.350, 0.450];

  if (psuExtChannel !== "CH1") {
    throw new Error("PSU-EXT current measurements support only CH1");
  }
  if (!Number.isFinite(loadResistorOhms) || loadResistorOhms <= 0) {
    throw new Error("Load resistor value must be a positive number of ohms");
  }
  if (targetCurrentsAmps.length !== 8) {
    throw new Error("PSU-EXT current accuracy measurement requires exactly eight points");
  }

  const sourceOutput = "OUTP " + siglentChannel + ",";
  const psuExtOutput = "OUTP " + psuExtChannel + ",";
  let overallWorstPoint = null;

  try {
    write(siglentDeviceId, sourceOutput + "0");
    log("INFO", "Siglent: " + queryRaw(siglentDeviceId, "*IDN?"));
    log("INFO", "Rigol: " + queryRaw(rigolDeviceId, "*IDN?"));
    log("INFO", "PSU-EXT: " + queryRaw(psuExtDeviceId, "*IDN?"));
    log("INFO", "Fixed load resistor: " + loadResistorOhms + " ohm");

    write(rigolDeviceId, "CONF:CURR:DC");
    write(rigolDeviceId, "SENS:CURR:DC:RANG:AUTO ON");
    write(siglentDeviceId, "SOUR:CURR " + siglentChannel + "," + sourceCurrentLimitAmps);

    if (enablePsuExtOutput) {
      write(psuExtDeviceId, psuExtOutput + "1");
    }

    write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + ",0");
    write(siglentDeviceId, sourceOutput + "1");
    sleep(outputEnableSettlingMilliseconds);

    const points = [];
    for (let index = 0; index < targetCurrentsAmps.length; index += 1) {
      if (cancelled()) {
        return { cancelled: true, completedMeasurements: index };
      }

      const targetCurrentAmps = targetCurrentsAmps[index];
      const setpointVolts = targetCurrentAmps * loadResistorOhms;
      if (setpointVolts > maximumSourceVoltageVolts) {
        throw new Error("Target " + targetCurrentAmps + " A requires " + setpointVolts +
          " V, above the configured source maximum of " + maximumSourceVoltageVolts + " V");
      }

      write(siglentDeviceId, "SOUR:VOLT " + siglentChannel + "," + setpointVolts);
      sleep(settleMilliseconds);

      let rigolCurrent = query(rigolDeviceId, "READ?");
      const psuExtCurrent = query(psuExtDeviceId, "MEAS:CURR? " + psuExtChannel);
      if (!Number.isFinite(rigolCurrent) || rigolCurrent < -zeroCurrentToleranceAmps) {
        throw new Error("Rigol returned an invalid current at target " + targetCurrentAmps + " A");
      }
      if (!Number.isFinite(psuExtCurrent) || psuExtCurrent < -zeroCurrentToleranceAmps) {
        throw new Error("PSU-EXT returned an invalid current at target " + targetCurrentAmps + " A");
      }
      if (targetCurrentAmps === 0 && rigolCurrent < 0) {
        rigolCurrent = 0;
      }

      const signedErrorAmps = psuExtCurrent - rigolCurrent;
      const signedErrorMilliamps = signedErrorAmps * 1000;
      const signedErrorPercent = rigolCurrent === 0 ? null : (signedErrorAmps / rigolCurrent) * 100;
      const point = {
        targetCurrentAmps: targetCurrentAmps,
        setpointVolts: setpointVolts,
        rigolCurrent: rigolCurrent,
        psuExtCurrent: psuExtCurrent,
        signedErrorAmps: signedErrorAmps,
        signedErrorMilliamps: signedErrorMilliamps,
        signedErrorPercent: signedErrorPercent,
        absoluteErrorMilliamps: Math.abs(signedErrorMilliamps),
      };

      log(
        "INFO",
        "Target " + (targetCurrentAmps * 1000) + " mA, set " + setpointVolts + " V, Rigol " +
          (rigolCurrent * 1000) + " mA, PSU-EXT " + (psuExtCurrent * 1000) + " mA, error " +
          signedErrorMilliamps + " mA" +
          (signedErrorPercent === null ? "" : " (" + signedErrorPercent + " %)")
      );

      points.push(point);
      if (overallWorstPoint === null
          || point.absoluteErrorMilliamps > overallWorstPoint.absoluteErrorMilliamps) {
        overallWorstPoint = point;
      }
      progress((index + 1) / targetCurrentsAmps.length);
    }

    return {
      loadResistorOhms: loadResistorOhms,
      points: points,
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
