const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://ankitroy:Ankit%40123@cluster0.ew8ssjs.mongodb.net/grievance-system?retryWrites=true&w=majority').then(async () => {
  const depts = await mongoose.connection.db.collection('departments').find({ isActive: true }).toArray();
  console.log('=== ALL ACTIVE DEPARTMENTS ===');
  depts.forEach(d => console.log(`Name: "${d.name}" | Parent: ${d.parentDepartmentId} | Email: ${d.contactEmail}`));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
