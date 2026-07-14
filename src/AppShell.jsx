import { useEffect, useRef, useState } from 'react';
import { BottomNav, Fab } from './components/ui';
import { useNavigation } from './context/NavigationContext';
import { useSession } from './context/SessionContext';
import { useSwipeGesture } from './hooks/useSwipeGesture';
import { DashboardPage } from './pages/DashboardPage';
import { PatientListPage } from './pages/PatientListPage';
import { SearchPage } from './pages/SearchPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { PatientFormPage } from './pages/PatientFormPage';
import { ActivityPage } from './pages/ActivityPage';
import { SettingsPage } from './pages/SettingsPage';
import { StaffManagePage } from './pages/StaffManagePage';

const BASE_NAV_ITEMS = [
  { id: 'dashboard', label: 'Home', icon: 'home' },
  { id: 'patientList', label: 'Patients', icon: 'groups' },
  { id: 'search', label: 'Search', icon: 'search' },
  { id: 'activity', label: 'Activity', icon: 'history', adminOnly: true },
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
  const { view, goTo, navigate } = useNavigation();
  const { isAdmin } = useSession();
  const navItems = BASE_NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin);
  const order = navItems.map((n) => n.id);
  const isNavView = order.includes(view);

  // Staff never navigate to Activity even by URL/state manipulation — the
  // page itself would 200 fine (the API has no role check yet either, see
  // server/src/index.js), but the UI shouldn't offer it, so redirect home.
  const Page = view === 'activity' && !isAdmin ? DashboardPage : (PAGES[view] || DashboardPage);
  const showFab = view === 'dashboard' || view === 'patientList' || view === 'search';

  // Direction drives which way the page slides in — works identically
  // whether the tab changed via swipe or a direct bottom-nav tap.
  const [direction, setDirection] = useState('right');
  const prevIndex = useRef(order.indexOf(view));
  useEffect(() => {
    const newIndex = order.indexOf(view);
    if (newIndex !== -1 && prevIndex.current !== -1 && newIndex !== prevIndex.current) {
      setDirection(newIndex > prevIndex.current ? 'right' : 'left');
    }
    prevIndex.current = newIndex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function swipeToOffset(offset) {
    if (!isNavView) return; // don't hijack swipes on detail/form/sub-pages
    const idx = order.indexOf(view);
    const next = order[(idx + offset + order.length) % order.length];
    goTo(next);
  }
  const swipeHandlers = useSwipeGesture(() => swipeToOffset(1), () => swipeToOffset(-1));

  const transitionClass = `page-transition ${isNavView ? (direction === 'left' ? 'from-left' : '') : 'subpage'}`;

  return (
    <div id="app-shell">
      <div key={view} className={transitionClass} {...swipeHandlers}>
        <Page />
      </div>
      {showFab && <Fab icon="add" label="New Patient" onClick={() => navigate('patientForm')} />}
      <BottomNav items={navItems} activeId={isNavView ? view : null} onChange={goTo} />
    </div>
  );
}
