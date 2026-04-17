require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Complaint = require('./dist/models/Complaint').default;
  const complaints = await Complaint.find().select('category department');
  
  const categories = {};
  complaints.forEach(c => {
    if (!categories[c.category]) categories[c.category] = [];
    categories[c.category].push(c.department);
  });
  
  console.log('Categories and their departments:');
  Object.entries(categories).forEach(([cat, depts]) => {
    console.log(`  ${cat}: ${[...new Set(depts)].join(', ')}`);
  });
  
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
