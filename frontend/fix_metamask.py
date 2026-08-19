content = open("/app/src/index.js").read()

suppress = """
// Suppress MetaMask noise
const _consoleError = console.error;
console.error = (...args) => {
  if (args[0] && String(args[0]).includes('MetaMask')) return;
  _consoleError(...args);
};
const _consoleWarn = console.warn;
console.warn = (...args) => {
  if (args[0] && String(args[0]).includes('MetaMask')) return;
  _consoleWarn(...args);
};
"""

content = suppress + content
open("/app/src/index.js", "w").write(content)
print("OK")
