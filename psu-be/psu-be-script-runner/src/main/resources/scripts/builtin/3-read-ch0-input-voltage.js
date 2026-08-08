(() => {
  // CH0 is the PSU-EXT input-voltage measurement channel.
  // MEAS:VOLT? CH0 returns a numeric voltage in volts.
  const deviceId = "PSUEXT1";
  const inputVoltage = query(deviceId, "MEAS:VOLT? CH0");

  log("INFO", "CH0 input voltage: " + inputVoltage + " V");
  return { channel: "CH0", inputVoltageVolts: inputVoltage };
})();
