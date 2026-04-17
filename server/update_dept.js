require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Department = require('./dist/models/Department').default;
  
  // Update Bhilai police to handle general categories
  await Department.updateOne(
    { name: 'Bhilai police' },
    { 
      categories: ['Public Safety', 'Crime', 'Harassment', 'Water Supply', 'Road & Infrastructure', 'Electricity', 'General'],
      isActive: true
    }
  );
  
  console.log('✓ Updated Bhilai police department categories');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
