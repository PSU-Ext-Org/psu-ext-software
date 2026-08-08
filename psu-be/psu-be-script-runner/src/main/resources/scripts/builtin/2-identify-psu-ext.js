(() => {
  // Change this value if your PSU-EXT connection has a different device ID.
  // *IDN? is a SCPI query that returns device identity text.
  const deviceId = "PSUEXT1";
  const identity = queryRaw(deviceId, "*IDN?");

  log("INFO", "PSU-EXT identity: " + identity);
  return { deviceId: deviceId, identity: identity };
})();
