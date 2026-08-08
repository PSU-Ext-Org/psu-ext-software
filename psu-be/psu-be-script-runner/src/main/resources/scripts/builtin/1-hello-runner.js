(() => {
  // Start here. This script needs no connected device.
  // It demonstrates constants, strings, every log level, and a returned result object.
  const greeting = "Hello from the PSU-EXT Script Runner";
  const lessonNumber = 1;

  log("DEBUG", "DEBUG is useful while developing a script");
  log("INFO", greeting);
  log("WARN", "WARN marks something that may need attention");
  log("ERROR", "ERROR is demonstrated here without failing the script");
  return { greeting: greeting, lessonNumber: lessonNumber };
})();
