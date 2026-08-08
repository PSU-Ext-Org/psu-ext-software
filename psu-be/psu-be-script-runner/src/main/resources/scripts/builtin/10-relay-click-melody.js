(() => {
  // Electrical caution: this script repeatedly switches the CH1 output relay for one minute.
  // Disconnect or use only a load that is safe to interrupt before running it.
  const deviceId = "PSUEXT1";
  const runMilliseconds = 60000;
  const threeClickRhythm = [
    { onMilliseconds: 100, offMilliseconds: 100 },
    { onMilliseconds: 100, offMilliseconds: 150 },
    { onMilliseconds: 250, offMilliseconds: 350 }
  ];
  const startedAt = Date.now();
  let completedCycles = 0;

  try {
    write(deviceId, "OUTP CH1,0");

    while (Date.now() - startedAt < runMilliseconds) {
      // Each cycle logs the lyric first, then plays three clicks twice.
      log("ERROR", "We will, we will rock you!");

      for (let group = 0; group < 2; group += 1) {
        for (let click = 0; click < threeClickRhythm.length; click += 1) {
          if (cancelled()) {
            return { cancelled: true, completedCycles: completedCycles };
          }

          write(deviceId, "OUTP CH1,1");
          sleep(threeClickRhythm[click].onMilliseconds);
          write(deviceId, "OUTP CH1,0");
          sleep(threeClickRhythm[click].offMilliseconds);
        }
      }

      completedCycles += 1;
      progress(Math.min((Date.now() - startedAt) / runMilliseconds, 1));
    }

    return { completedCycles: completedCycles, durationMilliseconds: runMilliseconds };
  } finally {
    // finally runs after a normal return or an error, so it is the cleanup location.
    try {
      write(deviceId, "OUTP CH1,0");
      log("INFO", "CH1 disabled");
    } catch (error) {
      // Preserve the original task error if the runner has already been cancelled.
    }
  }
})();
