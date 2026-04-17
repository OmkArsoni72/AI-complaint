import RoleLogin from '@/components/auth/RoleLogin';

export default function AdminLoginPage() {
  return (
    <RoleLogin
      role="ADMIN"
      title="Admin Access Portal"
      subtitle="Department Operations & Resolution Desk"
      redirectTo="/admin"
      portalGuard="HEAD_ADMIN"
    />
  );
}
