const fs = require('fs');
const path = require('path');
const raw = fs.readFileSync(path.join(__dirname, '..', '.install-state.json'), 'utf8');
console.log('migrate-local: reading localStorage export not needed on server, handled via /api/auth/migrate browser call');
console.log(raw);
