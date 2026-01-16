const http = require('http');

function testAPI() {
  // Test login
  const loginData = JSON.stringify({
    email: 'admin@expenseflow.com',
    password: 'admin123'
  });

  const loginOptions = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': loginData.length
    }
  };

  const loginReq = http.request(loginOptions, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('Login successful!');
        console.log('Token:', response.token);
        
        // Test users endpoint
        const usersOptions = {
          hostname: 'localhost',
          port: 5000,
          path: '/api/users',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${response.token}`
          }
        };

        const usersReq = http.request(usersOptions, (usersRes) => {
          let usersData = '';
          
          usersRes.on('data', (chunk) => {
            usersData += chunk;
          });
          
          usersRes.on('end', () => {
            try {
              const users = JSON.parse(usersData);
              console.log('\n=== USERS FROM API ===');
              console.log(JSON.stringify(users, null, 2));
            } catch (e) {
              console.log('Users response:', usersData);
            }
          });
        });

        usersReq.on('error', (e) => {
          console.error('Users request error:', e);
        });

        usersReq.end();
        
      } catch (e) {
        console.log('Login response:', data);
      }
    });
  });

  loginReq.on('error', (e) => {
    console.error('Login request error:', e);
  });

  loginReq.write(loginData);
  loginReq.end();
}

testAPI();
