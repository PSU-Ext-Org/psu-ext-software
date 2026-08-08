(() => {
  // Power is measured in watts. Energy is accumulated in watt-hours (Wh).
  // record() creates separate voltage, current, power, and energy chart/CSV series.
  // It does not change the CH1 relay state.
  const deviceId = "PSUEXT1";
  const sampleCount = 10;
  const intervalSeconds = 1;
  let energyWattHours = 0;

  for (let sample = 0; sample < sampleCount; sample += 1) {
    if (cancelled()) {
      return { cancelled: true, completedSamples: sample, energyWattHours: energyWattHours };
    }

    const timestamp = new Date();
    const voltage = query(deviceId, "MEAS:VOLT? CH1");
    const current = query(deviceId, "MEAS:CURR? CH1");
    const power = query(deviceId, "MEAS:POWER? CH1");

    // The first reading establishes the starting point. Later readings add one interval of energy.
    if (sample > 0) {
      energyWattHours += power * intervalSeconds / 3600;
    }

    record(timestamp, "CH1 voltage", "V", voltage);
    record(timestamp, "CH1 current", "A", current);
    record(timestamp, "CH1 power", "W", power);
    record(timestamp, "CH1 energy", "Wh", energyWattHours);
    log("INFO", "Sample " + (sample + 1) + ": " + power + " W, " + energyWattHours + " Wh");
    progress((sample + 1) / sampleCount);

    if (sample + 1 < sampleCount) {
      sleep(intervalSeconds * 1000);
    }
  }

  return { samples: sampleCount, energyWattHours: energyWattHours };
})();
