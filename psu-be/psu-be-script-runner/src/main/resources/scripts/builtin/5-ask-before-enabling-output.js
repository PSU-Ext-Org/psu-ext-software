(() => {
  // Electrical caution: CH1 is physically connected to the load through a relay.
  // Enter 42 to enable CH1 for two seconds. Any other value leaves it off.
  const deviceId = "PSUEXT1";
  const confirmationCode = 42;
  let enabled = false;

  try {
    write(deviceId, "OUTP CH1,0");
    const answer = input("Enter 42 to enable CH1 for two seconds", 300000);

    if (answer !== confirmationCode) {
      log("INFO", "CH1 was not enabled");
      return { enabled: false, answer: answer };
    }

    write(deviceId, "OUTP CH1,1");
    enabled = true;
    log("INFO", "CH1 enabled for two seconds");
    sleep(2000);
    return { enabled: true, durationMilliseconds: 2000 };
  } finally {
    // finally runs after a normal return or an error, so it is the cleanup location.
    try {
      write(deviceId, "OUTP CH1,0");
      if (enabled) {
        log("INFO", "CH1 disabled");
      }
    } catch (error) {
      // Preserve the original task error if the runner has already been cancelled.
    }
  }
})();
