(() => {
  // CH0 measures the PSU-EXT input voltage. CH1 measures output voltage after the relay.
  // This records three chart/CSV series: input voltage, output voltage, and their difference.
  // It does not change the CH1 relay state.
  const deviceId = "PSUEXT1";
  const sampleCount = 10;
  const intervalMilliseconds = 1000;
  let totalInputVoltage = 0;
  let totalOutputVoltage = 0;
  let totalVoltageDrop = 0;

  for (let sample = 0; sample < sampleCount; sample += 1) {
    if (cancelled()) {
      return { cancelled: true, completedSamples: sample };
    }

    const inputVoltage = query(deviceId, "MEAS:VOLT? CH0");
    const outputVoltage = query(deviceId, "MEAS:VOLT? CH1");
    const voltageDrop = inputVoltage - outputVoltage;
    const timestamp = new Date();

    totalInputVoltage += inputVoltage;
    totalOutputVoltage += outputVoltage;
    totalVoltageDrop += voltageDrop;
    record(timestamp, "CH0 input voltage", "V", inputVoltage);
    record(timestamp, "CH1 output voltage", "V", outputVoltage);
    record(timestamp, "Voltage drop", "V", voltageDrop);
    log("INFO", "Sample " + (sample + 1) + ": drop is " + voltageDrop + " V");
    progress((sample + 1) / sampleCount);

    if (sample + 1 < sampleCount) {
      sleep(intervalMilliseconds);
    }
  }

  return {
    samples: sampleCount,
    averageInputVoltageVolts: totalInputVoltage / sampleCount,
    averageOutputVoltageVolts: totalOutputVoltage / sampleCount,
    averageVoltageDropVolts: totalVoltageDrop / sampleCount
  };
})();
