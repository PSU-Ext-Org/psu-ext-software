(() => {
  // Electrical caution: this enables the CH1 output relay while readings are collected.
  // A for loop repeats a group of instructions a fixed number of times.
  // record() creates a CH1 voltage result series that the UI can display as a chart or export as CSV.
  const deviceId = "PSUEXT1";
  const sampleCount = 5;
  const samples = [];

  try {
    write(deviceId, "OUTP CH1,0");
    write(deviceId, "OUTP CH1,1");
    // Let the output and measurement history settle before the first reading.
    sleep(1000);

    for (let sample = 0; sample < sampleCount; sample += 1) {
      if (cancelled()) {
        break;
      }

      const voltage = query(deviceId, "MEAS:VOLT? CH1");
      const reading = { sample: sample + 1, voltageVolts: voltage };
      
      samples.push(reading);
      record(new Date(), "CH1 voltage", "V", voltage);
      
      log("INFO", "Sample " + reading.sample + ": " + voltage + " V");
      progress((sample + 1) / sampleCount);

      if (sample + 1 < sampleCount) {
        sleep(1000);
      }
    }

    // The return value is also an array, separate from the chart/CSV result series above.
    return samples;
  } finally {
    // Always try to leave the switched CH1 output disabled.
    try {
      write(deviceId, "OUTP CH1,0");
    } catch (error) {
      // Preserve the original task error if the runner has already been cancelled.
    }
  }
})();
