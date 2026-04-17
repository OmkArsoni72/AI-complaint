const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '../.env' });

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);

  const Department = mongoose.model(
    'Department',
    new mongoose.Schema({
      name: String,
      parentDepartmentId: mongoose.Schema.Types.ObjectId,
      isActive: Boolean,
      contactEmail: String,
    })
  );

  const User = mongoose.model(
    'User',
    new mongoose.Schema({
      name: String,
      email: String,
      role: String,
      department: String,
      departmentId: mongoose.Schema.Types.ObjectId,
    })
  );

  const departments = await Department.find({}).sort({ name: 1 }).lean();
  console.log('Departments:');
  departments.forEach((d) => {
    console.log({
      id: d._id.toString(),
      name: d.name,
      parentDepartmentId: d.parentDepartmentId ? d.parentDepartmentId.toString() : null,
      isActive: d.isActive,
      contactEmail: d.contactEmail || null,
    });
  });

  const admins = await User.find({ role: { $in: ['ADMIN', 'SUPER_ADMIN'] } })
    .select('name email role department departmentId')
    .lean();
  console.log('\nAdmins:');
  admins.forEach((u) => {
    console.log({
      email: u.email,
      role: u.role,
      department: u.department || null,
      departmentId: u.departmentId ? u.departmentId.toString() : null,
    });
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
