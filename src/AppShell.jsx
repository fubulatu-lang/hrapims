import { BottomNav, Fab } from './components/ui';
import { useNavigation } from './context/NavigationContext';
import { DashboardPage } from './pages/DashboardPage';
import { PatientListPage } from './pages/PatientListPage';
import { SearchPage } from './pages/SearchPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { PatientFormPage } from './pages/PatientFormPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { StaffManagePage } from './pages/StaffManagePage';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: 'home' },
  { id: 'patientList', label: 'Patients', icon: 'groups' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'activity', label: 'Activity', icon: 'history' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const PAGES = {
  dashboard: DashboardPage,
  patientList: PatientListPage,
  search: SearchPage,
  patientDetail: PatientDetailPage,
  patientForm: PatientFormPage,
  activity: ActivityPage,
  settings: SettingsPage,
  staffManage: StaffManagePage,
};

export function AppShell() {
  const { view, goTo } = useNavigation();
  const Page = PAGES[view] || DashboardPage;
  const showFab = view === 'dashboard' || view === 'patientList';
  const isNavView = NAV_ITEMS.some((n) => n.id === view);

  return (
    <div id="app-shell">
      <Page />
      {showFab && <Fab icon="add" label="New Patient" onClick={() => goTo('patientForm')} />}
      <BottomNav items={NAV_ITEMS} activeId={isNavView ? view : null} onChange={goTo} />
    </div>
  );
}
