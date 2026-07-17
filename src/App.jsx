import { SessionProvider, useSession } from './context/SessionContext';
import { NavigationProvider } from './context/NavigationContext';
import { LoginPage } from './pages/LoginPage';
import { ForceChangePasswordPage } from './pages/ForceChangePasswordPage';
import { AppShell } from './AppShell';

export default function App() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}

function Gate() {
  const { isAuthenticated, mustChangePassword } = useSession();
  if (!isAuthenticated) return <LoginPage />;
  if (mustChangePassword) return <ForceChangePasswordPage />;
  return (
    <NavigationProvider initialView="dashboard">
      <AppShell />
    </NavigationProvider>
  );
}
