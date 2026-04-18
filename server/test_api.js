const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://ankitroy:Ankit%40123@cluster0.ew8ssjs.mongodb.net/grievance-system?retryWrites=true&w=majority';

// Quick test — call the actual API
const https = require('http');

async function testAPI() {
  // Get superadmin token
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'superadmin@delhi.gov.in', password: 'super123' })
  });
  const loginData = await loginRes.json();
  
  if (!loginData.success) {
    console.log('❌ Login failed:', loginData);
    return;
  }
  
  const token = loginData.data.token;
  console.log(' Logged in as:', loginData.data.user.name, '| Role:', loginData.data.user.role);
  
  // Hit the admin overview API
  const res = await fetch('http://localhost:5000/api/superadmin/admins', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  
  if (!data.success) {
    console.log('❌ API failed:', data);
    return;
  }
  
  console.log(`\n✅ Admin Overview API returned ${data.data.length} admins:\n`);
  data.data.forEach(a => {
    console.log(`👤 ${a.name} | ${a.email}`);
    console.log(`   Dept: ${a.department} | Status: ${a.status} | Last login: ${a.daysSinceLogin !== null ? a.daysSinceLogin + 'd ago' : 'never'}`);
    console.log(`   Stats: total=${a.stats.total} pending=${a.stats.pending} resolved=${a.stats.resolved} escalated=${a.stats.escalated}`);
    console.log('');
  });
}

testAPI().catch(console.error);
