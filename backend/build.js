const { execSync } = require('child_process');
const result = execSync('node node_modules/@nestjs/cli/bin/nest.js build', { encoding: 'utf8', cwd: 'E:/pet-project/ddd' });
console.log('STDOUT:', result);
