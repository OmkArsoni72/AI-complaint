const http = require('http');
const querystring = require('querystring');

const URL = 'http://localhost:5000/api/whatsapp/webhook';
const PHONE = 'whatsapp:+919999999999';

async function sendRequest(bodyObj) {
  const postData = querystring.stringify({
    From: PHONE,
    ...bodyObj
  });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(URL, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract the plain text from Twilio XML `<Message>...</Message>`
        const messageMatch = data.match(/<Message>([\s\S]*?)<\/Message>/);
        resolve(messageMatch ? messageMatch[1] : data);
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function runTest() {
  console.log('--- STARTING WHATSAPP BOT LOCAL TEST ---');
  console.log('Make sure your Node server is running on port 5000!\n');

  try {
    console.log('👨💻 User  : "Hi"');
    let reply = await sendRequest({ Body: 'Hi' });
    console.log('🤖 Bot   :\n' + reply + '\n');

    console.log('👨💻 User  : "Street light nahi jal rahi hai"');
    reply = await sendRequest({ Body: 'Street light nahi jal rahi hai' });
    console.log('🤖 Bot   :\n' + reply + '\n');

    console.log('👨💻 User  : [Sends Image]');
    reply = await sendRequest({ MediaUrl0: 'https://example.com/dummy-image.jpg' });
    console.log('🤖 Bot   :\n' + reply + '\n');

    console.log('👨💻 User  : [Sends Live Location Pin]');
    reply = await sendRequest({ Latitude: '28.6139', Longitude: '77.2090' });
    console.log('🤖 Bot   :\n' + reply + '\n');

    console.log('✅ Test Completed! Check your MongoDB Compass to see the new complaint.');
  } catch (err) {
    console.error('❌ Server is not responding. Please run "npm run dev" in another terminal first.');
  }
}

runTest();
