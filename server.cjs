// Hostinger's Node launcher loads the configured entry point with require().
// Keep this CommonJS bridge small and load the ESM application asynchronously.
import('./src/server.js').catch(error => {
  console.error('Failed to load Complete CRM API:', error);
  process.exitCode = 1;
});
