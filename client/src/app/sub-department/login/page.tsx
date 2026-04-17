import RoleLogin from '@/components/auth/RoleLogin';

export default function SubDepartmentLoginPage() {
  return (
    <RoleLogin
      role="OFFICER"
      title="Sub-Department Access"
      subtitle="Head-assigned queues & resolution dashboard"
      redirectTo="/sub-department"
      portalGuard="SUB_DEPARTMENT"
    />
  );
}
