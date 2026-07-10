import { Icon } from './Icon';

/**
 * Material 3 style bottom navigation bar. Renders as a `<nav>` with each
 * item as a real `<button>`; the active item gets `aria-current="page"`
 * (drives both the visual pill indicator via CSS and screen-reader state).
 *
 * @param {object} props
 * @param {{id: string, label: string, icon: string}[]} props.items
 * @param {string} props.activeId
 * @param {(id: string) => void} props.onChange
 *
 * @example
 * <BottomNav
 *   items={[{id:'home',label:'Home',icon:'home'}, {id:'patients',label:'Patients',icon:'groups'}]}
 *   activeId={view}
 *   onChange={setView}
 * />
 */
export function BottomNav({ items, activeId, onChange }) {
  return (
    <nav className="nav-bar" aria-label="Primary">
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            className="nav-item"
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(item.id)}
          >
            <span className="nav-indicator"><Icon name={item.icon} /></span>
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
