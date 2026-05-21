export const logRemote = (message, level = "info") => {
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

  // Log to browser console
  console.log(logEntry);

  // Save to localStorage
  let logs = [];
  try {
    const existing = localStorage.getItem("debug_logs");
    if (existing) {
      logs = JSON.parse(existing);
    }
  } catch (e) { }

  logs.push(logEntry);
  if (logs.length > 50) {
    logs.shift();
  }

  localStorage.setItem("debug_logs", JSON.stringify(logs));

  // Dispatch custom event to notify UI
  window.dispatchEvent(new Event("debug_logs_updated"));
};
