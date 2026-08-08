(() => {
  // CH1 is the switched output channel.
  // These SCPI queries return voltage (V), current (A), and power (W).
  // Electrical caution: this enables the CH1 output relay while measurements are read.
  const deviceId = "PSUEXT1";

  try {
    write(deviceId, "OUTP CH1,0");
    write(deviceId, "OUTP CH1,1");
    // Let the output and measurement history settle before the first reading.
    sleep(1000);

    const voltage = query(deviceId, "MEAS:VOLT? CH1");
    const current = query(deviceId, "MEAS:CURR? CH1");
    const power = query(deviceId, "MEAS:POWER? CH1");

    log("INFO", "CH1: " + voltage + " V, " + current + " A, " + power + " W");
    return { channel: "CH1", voltageVolts: voltage, currentAmps: current, powerWatts: power };
  } finally {
    // Always try to leave the switched CH1 output disabled.
    try {
      write(deviceId, "OUTP CH1,0");
    } catch (error) {
      // Preserve the original task error if the runner has already been cancelled.
    }
  }
})();
