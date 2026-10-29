function createResultSubmissionCoordinator(submitResult) {
  let completedPayload = null;
  let inFlight = null;
  return {
    preserve(payload) {
      if (!completedPayload) {
        const deeplyFrozen = value => !value || typeof value !== "object"
          || (Object.isFrozen(value) && Object.values(value).every(deeplyFrozen));
        const snapshot = value => {
          if (deeplyFrozen(value)) return value;
          const copy = Array.isArray(value) ? value.map(snapshot)
            : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, snapshot(child)]));
          return Object.freeze(copy);
        };
        completedPayload = snapshot(payload);
      }
      return completedPayload;
    },
    clear() { completedPayload = null; inFlight = null; },
    hasPayload() { return completedPayload !== null; },
    submit(signal) {
      if (!completedPayload) return Promise.reject(new Error("Completed match payload is missing."));
      if (inFlight) return inFlight;
      const attempt = Promise.resolve().then(() => submitResult(completedPayload, signal));
      const wrappedAttempt = attempt.finally(() => { if (inFlight === wrappedAttempt) inFlight = null; });
      inFlight = wrappedAttempt;
      return wrappedAttempt;
    },
  };
}
module.exports = { createResultSubmissionCoordinator };
