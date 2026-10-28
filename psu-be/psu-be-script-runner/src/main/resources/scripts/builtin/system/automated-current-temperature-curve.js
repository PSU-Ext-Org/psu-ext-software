(() => {
  // ========================= Bench configuration =======================
  // Manually configured source -> PSU-EXT CH1 -> ET5410A electronic load.
  // Ramp the load in CC mode; keep the relay closed between current steps.
  // Stop after recording the 2 A point, or immediately at 70 C. No down sweep.
  const measurementDevice = "PSUEXT1";
  const loadDevice = "ET5410A";
  const stepAmps = 0.020;
  const maximumCurrentAmps = 2;
  const maximumMeasuredCurrentAmps = 2.2;
  const maximumTemperatureCelsius = 70;
  // Allow approximately 15 mA load ripple with a small margin. Record the
  // averaged measured current, rather than assuming it equals the target.
  const currentToleranceAmps = 0.020;

  // Six readings make a 30-second average, smoothing the 0.3 C sensor ripple.
  // Two consecutive averages must form a plateau, in heating or cooling.
  const sampleIntervalMilliseconds = 5000;
  const samplesPerAverage = 6;
  const stableAverageCount = 2;
  const averageTemperatureThresholdCelsius = 0.3;
  const pointTimeoutMilliseconds = 30 * 60 * 1000;

  // ============================ SCPI commands ==========================
  const scpi = Object.freeze({
    loadOff: "CH:SW OFF",
    loadOn: "CH:SW ON",
    loadConstantCurrent: "CH:MODE CC",
    loadLowRange: "LOAD:CRANGE LOW",
    loadSetCurrent: "CURR:CC ",
    loadQueryMode: "CH:MODE?",
    loadQueryCurrent: "CURR:CC?",
    relayOn: "OUTP CH1,1",
    relayOff: "OUTP CH1,0",
    measureCurrent: "MEAS:CURR? 1",
    measureTemperature: "EXT:MEAS:TEMP? 1"
  });

  // ========================= Build sweep targets =======================
  const steps = Math.round(maximumCurrentAmps / stepAmps);
  if (steps < 1 || Math.abs(steps * stepAmps - maximumCurrentAmps) > 1e-9
      || maximumCurrentAmps >= maximumMeasuredCurrentAmps) {
    throw new Error("Check current step, sweep range, and measured-current safety limit");
  }
  const targets = [];
  const points = [];
  for (let index = 1; index <= steps; index += 1) {
    targets.push({ current: index * stepAmps, direction: "up" });
  }
  // ====================== Measurement / safety helpers =================
  function writeLoad(command) {
    try {
      write(loadDevice, command);
    } catch (error) {
      // The ET5410A can reply to a setting command after accepting it. The
      // runner has already consumed that reply, but rejects text for write().
      // Do not resend: tolerate only this response-type error, not timeouts,
      // disconnections, cancellation, or other transport failures.
      const message = String(error);
      const isTextResponse = message.includes("Write command returned text response:");
      // Some transports report the load acknowledgement directly rather than
      // passing it through the runner's text-response validation.
      const isLoadAcknowledgement = /Rexecu\s+success/i.test(message);
      if (!isTextResponse && !isLoadAcknowledgement) {
        throw error;
      }
      log("WARN", "ET5410A write returned text; continuing after " + command + ": " + String(error));
    }
  }

  function measure(command) {
    const value = query(measurementDevice, command);
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Invalid measurement for " + command + ": " + value);
    }
    return value;
  }

  function finishAtTemperatureLimit(temperature, target, lastCurrentSample) {
    // Disconnect before recording or logging. A failed relay write remains a
    // task failure; only a confirmed thermal shutdown is a successful early exit.
    write(measurementDevice, scpi.relayOff);
    writeLoad(scpi.loadOff);
    const timestamp = new Date();
    record(timestamp, "Temperature cutoff", "degC", temperature);
    const cutoff = {
      timestamp: timestamp.toISOString(),
      temperatureCelsius: temperature,
      targetCurrentAmps: target.current,
      direction: target.direction,
      lastCurrentSample: lastCurrentSample
    };
    // The cutoff is not a settled curve point. Keep the last pre-shutdown
    // current and its timestamp explicitly, without inventing a paired reading.
    log("WARN", "Temperature limit reached; relay OFF. " + JSON.stringify(cutoff));
    return { stoppedByTemperature: true, stepAmps: stepAmps, points: points, cutoff: cutoff };
  }

  function mean(samples, field) {
    return samples.reduce((sum, sample) => sum + sample[field], 0) / samples.length;
  }

  function confirmInitialCurrent() {
    // query() converts only bare numbers. Load firmware may include a unit
    // or command label; inspect the raw reply instead of requiring JS number type.
    let reply = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      reply = queryRaw(loadDevice, scpi.loadQueryCurrent).trim();
      log("INFO", "ET5410A initial current reply (" + attempt + "/3): " + JSON.stringify(reply));
      // This ET5410A firmware prefixes numeric replies with R (e.g. R0.020).
      const match = /^(?:CURR:CC\s*[:=]?\s*)?(?:R\s*)?([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(mA|A)?$/i
        .exec(reply);
      if (match) {
        const value = Number(match[1]) * (match[2] && match[2].toUpperCase() === "MA" ? 0.001 : 1);
        if (Number.isFinite(value) && Math.abs(value - stepAmps) <= 0.001) {
          return;
        }
      }
      // Allow delayed setpoint updates or an outstanding acknowledgement to
      // clear, without resending the setting or enabling the load prematurely.
      if (attempt < 3) {
        sleep(500);
      }
    }
    throw new Error("Electronic load initial current verification failed: expected "
      + stepAmps.toFixed(3) + " A; last raw reply=" + JSON.stringify(reply));
  }

  // ========================= Configure / enable load ===================
  // Mode and range changes require the load input to be OFF. Never change
  // the source voltage here. Use the load's 0-3 A range for this 2 A sweep.
  try {
    writeLoad(scpi.loadOff);
    const initialTemperature = measure(scpi.measureTemperature);
    if (initialTemperature >= maximumTemperatureCelsius) {
      return finishAtTemperatureLimit(initialTemperature, targets[0], null);
    }
    writeLoad(scpi.loadConstantCurrent);
    writeLoad(scpi.loadLowRange);
    writeLoad(scpi.loadSetCurrent + stepAmps.toFixed(3));
    if (queryRaw(loadDevice, scpi.loadQueryMode).trim().toUpperCase() !== "CC") {
      throw new Error("Electronic load did not acknowledge CC mode");
    }
    confirmInitialCurrent();
    write(measurementDevice, scpi.relayOn);
    writeLoad(scpi.loadOn);

    // ======================= Automated upward sweep ====================
    for (const target of targets) {
      // Only the CC setpoint changes between points: no relay cycling or prompts.
      writeLoad(scpi.loadSetCurrent + target.current.toFixed(3));
      // ======================= Wait for thermal plateau ================
      const started = Date.now();
      let samples = [];
      let averages = [];
      let lastCurrentSample = null;
      while (true) {
        if (cancelled()) {
          return { cancelled: true, points: points };
        }
        if (Date.now() - started >= pointTimeoutMilliseconds) {
          throw new Error("Settling timed out at " + target.current.toFixed(3) + " A");
        }
        const temperature = measure(scpi.measureTemperature);
        if (temperature >= maximumTemperatureCelsius) {
          return finishAtTemperatureLimit(temperature, target, lastCurrentSample);
        }
        const current = measure(scpi.measureCurrent);
        if (Math.abs(current) > maximumMeasuredCurrentAmps) {
          write(measurementDevice, scpi.relayOff);
          throw new Error("Measured current exceeded the configured safety limit");
        }
        const timestamp = new Date();
        lastCurrentSample = { currentAmps: current, timestamp: timestamp.toISOString() };
        record(timestamp, "Live current", "A", current);
        record(timestamp, "Live temperature", "degC", temperature);

        // Reject history collected at the wrong current, including partial blocks.
        if (Math.abs(current - target.current) > currentToleranceAmps) {
          samples = [];
          averages = [];
          log("INFO", "Waiting for load to reach " + target.current.toFixed(3) + " A; measured "
            + current.toFixed(4) + " A. Settling history reset.");
        } else {
          samples.push({ current: current, temperature: temperature });
          if (samples.length === samplesPerAverage) {
            const average = { current: mean(samples, "current"), temperature: mean(samples, "temperature") };
            samples = [];
            averages.push(average);
            if (averages.length > stableAverageCount) {
              averages.shift();
            }
            record(timestamp, "Average temperature", "degC", average.temperature);
            const temperatures = averages.map(value => value.temperature);
            const range = Math.max(...temperatures) - Math.min(...temperatures);
            log("INFO", target.direction + " target=" + target.current.toFixed(3)
              + " A; average temperature=" + average.temperature.toFixed(3)
              + " degC; average range=" + range.toFixed(3) + " degC ("
              + averages.length + "/" + stableAverageCount + " blocks)");

            // =================== Record settled curve point =============
            // A full range rejects both continued warming and continued cooling.
            // Averaging alone cannot remove slow sensor drift or prove equilibrium.
            if (averages.length === stableAverageCount
                && range < averageTemperatureThresholdCelsius) {
              const point = {
                direction: target.direction,
                targetCurrentAmps: target.current,
                currentAmps: mean(averages, "current"),
                temperatureCelsius: mean(averages, "temperature"),
                averageTemperatureRangeCelsius: range,
                settlingSeconds: (Date.now() - started) / 1000
              };
              points.push(point);
              // Pair current and temperature CSV coordinates by timestamp.
              record(timestamp, "Settled current " + target.direction, "A", point.currentAmps);
              record(timestamp, "Settled temperature " + target.direction, "degC", point.temperatureCelsius);
              log("INFO", "Settled point: " + JSON.stringify(point));
              progress(points.length / targets.length);
              break;
            }
          }
        }
        sleep(sampleIntervalMilliseconds);
      }
    }
    return { reachedMaximumCurrent: true, stepAmps: stepAmps, points: points };
  } finally {
    // ============================ Final cleanup ========================
    // Attempt both independently on normal completion, fault, or cancellation.
    // On normal completion this happens only after the final 2 A point is saved.
    for (const output of [
      [measurementDevice, scpi.relayOff],
      [loadDevice, scpi.loadOff]
    ]) {
      try {
        if (output[0] === loadDevice) {
          writeLoad(output[1]);
        } else {
          write(output[0], output[1]);
        }
      } catch (error) {
        // Cancellation/timeouts may block writes; verify outputs after an abort.
      }
    }
  }
})();
