const http = require('http');
const req = http.request({
  hostname: '127.0.0.1',
  port: 5000,
  path: '/api/health',
  method: 'GET'
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('HEALTH RESPONSE:', body);
    process.exit(0);
  });
});

req.on('error', err => {
  console.error('CONNECT ERROR:', err.message, err.code);
  process.exit(1);
});

req.end();
