require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Complaint = require('./dist/models/Complaint').default;
  const Department = require('./dist/models/Department').default;
  
  const bhilaiDept = await Department.findOne({ name: 'Bhilai police' });
  
  if (!bhilaiDept) {
    console.error('Bhilai police department not found');
    process.exit(1);
  }
  
  // Update all complaints with null departmentId to point to Bhilai police
  const result = await Complaint.updateMany(
    { departmentId: null },
    { departmentId: bhilaiDept._id }
  );
  
  console.log(`✓ Updated ${result.modifiedCount} complaints`);
  
  // Show updated complaints
  const updated = await Complaint.find({ departmentId: bhilaiDept._id }).select('complaintId department departmentId');
  console.log('\nComplaints now visible to Bhilai police admin:');
  updated.forEach(c => {
    console.log(`  - ${c.complaintId || c._id}: ${c.department}`);
  });
  
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
