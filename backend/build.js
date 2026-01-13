// build.js
const { execSync } = require('child_process');
const fs = require('fs');

console.log('🔨 Building TypeScript with manual compiler...');

// Clean dist folder
if (fs.existsSync('./dist')) {
  console.log('🧹 Cleaning dist folder...');
  fs.rmSync('./dist', { recursive: true });
}

// Run TypeScript compiler directly
try {
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('✅ Build successful!');
  
  // Verify main.js exists
  if (fs.existsSync('./dist/main.js')) {
    console.log('✅ dist/main.js created successfully');
  } else {
    console.log('❌ dist/main.js NOT created - check TypeScript errors');
  }
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}