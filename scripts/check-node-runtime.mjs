// This checks the build/local process, not Vercel's separately managed function runtime.
const [major, minor, patch] = process.versions.node.split('.').map(Number);
if (major !== 24 || minor < 22 || (minor === 22 && patch < 1)) {
  console.error(`Node ${process.versions.node} is unsupported. Use Node >=24.22.1 <25 (see .nvmrc).`);
  process.exitCode = 1;
} else {
  console.log(`Node runtime check passed: ${process.versions.node}`);
}
