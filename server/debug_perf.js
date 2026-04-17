const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://ankitroy:Ankit%40123@cluster0.ew8ssjs.mongodb.net/grievance-system?retryWrites=true&w=majority';

const UserSchema = new mongoose.Schema({ name: String, email: String, role: String, department: String, departmentId: mongoose.Schema.Types.ObjectId, isActive: Boolean }, { timestamps: true });
const DeptSchema = new mongoose.Schema({ name: String, parentDepartmentId: mongoose.Schema.Types.ObjectId, isActive: Boolean, adminUserId: mongoose.Schema.Types.ObjectId, contactEmail: String }, { timestamps: true });
const ComplaintSchema = new mongoose.Schema({ status: String, priority: String, department: String, departmentId: mongoose.Schema.Types.ObjectId }, { timestamps: true });

const User = mongoose.model('User', UserSchema);
const Dept = mongoose.model('Department', DeptSchema);
const Complaint = mongoose.model('Complaint', ComplaintSchema);

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected\n');

  // 1. Head Departments (no parent)
  const headDepts = await Dept.find({ parentDepartmentId: null, isActive: true }).select('_id name adminUserId contactEmail');
  console.log(`📦 HEAD DEPARTMENTS (${headDepts.length}):`);
  headDepts.forEach(d => console.log(`  [${d._id}] ${d.name} | adminUserId: ${d.adminUserId || 'NONE'} | email: ${d.contactEmail || 'NONE'}`));

  // 2. Admin Users
  const headDeptIds = headDepts.map(d => d._id);
  const headDeptNames = headDepts.map(d => d.name);
  const admins = await User.find({
    role: 'ADMIN',
    isActive: true,
    $or: [
      { departmentId: { $in: headDeptIds } },
      { department: { $in: headDeptNames } }
    ]
  }).select('name email role department departmentId');

  console.log(`\n👤 ADMIN USERS found by current query (${admins.length}):`);
  admins.forEach(a => console.log(`  ${a.name} | ${a.email} | dept: ${a.department} | deptId: ${a.departmentId || 'NONE'}`));

  // 3. ALL admins in DB
  const allAdmins = await User.find({ role: 'ADMIN' }).select('name email department departmentId isActive');
  console.log(`\n👥 ALL ADMIN USERS in DB (${allAdmins.length}):`);
  allAdmins.forEach(a => console.log(`  ${a.name} | ${a.email} | dept: ${a.department || 'NONE'} | deptId: ${a.departmentId || 'NONE'} | active: ${a.isActive}`));

  // 4. Complaints by department
  const compStats = await Complaint.aggregate([
    { $group: { _id: '$department', total: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } }, pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] } }, escalated: { $sum: { $cond: [{ $eq: ['$status', 'ESCALATED'] }, 1, 0] } } } }
  ]);
  console.log(`\n📊 COMPLAINTS BY DEPARTMENT:`);
  compStats.forEach(s => console.log(`  ${s._id || 'NO-DEPT'} → total:${s.total} pending:${s.pending} resolved:${s.resolved} escalated:${s.escalated}`));

  // 5. Check mismatch
  console.log('\n🔍 MISMATCH CHECK:');
  allAdmins.forEach(a => {
    const dept = headDepts.find(d => d._id.toString() === (a.departmentId?.toString() || '') || d.name === a.department);
    if (!dept) console.log(`  ❌ ${a.name} (${a.email}) — NO matching head department! dept="${a.department}" deptId="${a.departmentId}"`);
    else console.log(`  ✅ ${a.name} → matched to "${dept.name}"`);
  });

  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

main().catch(console.error);
