import RoleLogin from '@/components/auth/RoleLogin';

export default function SuperAdminLoginPage() {
  return (
    <RoleLogin
      role="SUPER_ADMIN"
      title="Superadmin Command Console"
      subtitle="Citywide Oversight & Strategic Control"
      redirectTo="/superadmin/controlroom"
    />
  );
}
