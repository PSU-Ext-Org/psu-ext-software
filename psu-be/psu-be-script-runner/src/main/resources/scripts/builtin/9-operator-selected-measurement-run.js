(() => {
  // input() returns a number. Choose a run time and measurement interval in seconds.
  // This template supports runs up to one hour.
  // This script records a chart/CSV series and demonstrates validation, loops, and elapsed time.
  // Electrical caution: this enables the CH1 output relay for the measurement run.
  const deviceId = "PSUEXT1";
  const durationSeconds = input("Enter measurement duration in seconds (1 to 3600)", 300000);
  const intervalSeconds = input("Enter measurement interval in seconds (1 to 3600)", 300000);

  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 3600) {
    throw new Error("Duration must be a whole number from 1 to 3600 seconds");
  }
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 1 || intervalSeconds > 3600) {
    throw new Error("Interval must be a whole number from 1 to 3600 seconds");
  }

  // Measure immediately. If the interval is at least the duration, one measurement is enough.
  const sampleCount = intervalSeconds >= durationSeconds
    ? 1
    : Math.floor(durationSeconds / intervalSeconds) + 1;

  function waitForInterval(seconds) {
    // sleep() accepts no more than five minutes, so long intervals are split into simple chunks.
    let remainingMilliseconds = seconds * 1000;
    while (remainingMilliseconds > 0) {
      const chunkMilliseconds = Math.min(remainingMilliseconds, 300000);
      sleep(chunkMilliseconds);
      remainingMilliseconds -= chunkMilliseconds;
    }
  }

  let totalVoltage = 0;
  try {
    write(deviceId, "OUTP CH1,0");
    write(deviceId, "OUTP CH1,1");
    // Let the output and measurement history settle before the first reading.
    sleep(1000);

    for (let sample = 0; sample < sampleCount; sample += 1) {
      if (cancelled()) {
        return { cancelled: true, completedSamples: sample };
      }

      const voltage = query(deviceId, "MEAS:VOLT? CH1");
      totalVoltage += voltage;
      record(new Date(), "CH1 voltage", "V", voltage);
      log("INFO", "Sample " + (sample + 1) + " of " + sampleCount + ": " + voltage + " V");
      progress((sample + 1) / sampleCount);

      if (sample + 1 < sampleCount) {
        waitForInterval(intervalSeconds);
      }
    }

    return {
      durationSeconds: durationSeconds,
      intervalSeconds: intervalSeconds,
      samples: sampleCount,
      averageVoltageVolts: totalVoltage / sampleCount
    };
  } finally {
    // Always try to leave the switched CH1 output disabled.
    try {
      write(deviceId, "OUTP CH1,0");
    } catch (error) {
      // Preserve the original task error if the runner has already been cancelled.
    }
  }
})();
