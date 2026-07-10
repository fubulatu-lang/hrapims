import { SessionProvider, useSession } from './context/SessionContext';
import { NavigationProvider } from './context/NavigationContext';
import { LoginPage } from './pages/LoginPage';
import { AppShell } from './AppShell';

export default function App() {
  return (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  );
}

function Gate() {
  const { isAuthenticated } = useSession();
  if (!isAuthenticated) return <LoginPage />;
  return (
    <NavigationProvider initialView="dashboard">
      <AppShell />
    </NavigationProvider>
  );
}
