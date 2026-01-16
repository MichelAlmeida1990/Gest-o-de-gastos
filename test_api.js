const axios = require('axios');

async function testAPI() {
  try {
    // Test login
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'admin@expenseflow.com',
      password: 'admin123'
    });
    
    console.log('Login successful!');
    console.log('Token:', loginResponse.data.token);
    
    // Test users endpoint
    const usersResponse = await axios.get('http://localhost:5000/api/users', {
      headers: {
        'Authorization': `Bearer ${loginResponse.data.token}`
      }
    });
    
    console.log('\n=== USERS FROM API ===');
    console.log(JSON.stringify(usersResponse.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testAPI();
