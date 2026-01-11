const axios = require('axios');

async function testNavigation() {
  try {
    console.log('Testing navigation endpoint...');
    const response = await axios.post('http://localhost:3000/api/scrape/navigation');
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:');
    console.error('  Status:', error.response?.status);
    console.error('  Data:', error.response?.data);
    console.error('  Message:', error.message);
  }
}

testNavigation();
