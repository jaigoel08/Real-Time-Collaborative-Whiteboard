const http = require('http');

// Test if the server is running
const testServer = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/boards/test',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  };

  const req = http.request(options, (res) => {
    console.log(`Server is running! Status: ${res.statusCode}`);
    console.log(`Headers:`, res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Response:', data);
    });
  });

  req.on('error', (err) => {
    console.error('Server connection failed:', err.message);
    console.log('Make sure the backend server is running on port 3000');
  });

  req.end();
};

testServer(); 