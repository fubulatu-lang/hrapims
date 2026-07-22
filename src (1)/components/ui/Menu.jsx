import { useState } from 'react';
import { Icon } from './Icon';

/**
 * Tracks which element a dropdown menu is anchored to. Pass the returned
 * `anchorEl`/`close` to <Menu>, and spread `triggerProps` (or just call
 * `openMenu(e)`) on the button that opens it.
 * @example
 * const menu = useMenu();
 * <IconButton icon="more_vert" label="More actions" onClick={menu.openMenu} />
 * <Menu anchorEl={menu.anchorEl} onClose={menu.closeMenu} items={[...]} />
 */
export function useMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = (e) => setAnchorEl(e.currentTarget);
  const closeMenu = () => setAnchorEl(null);
  return { anchorEl, openMenu, closeMenu };
}

/**
 * Positioned dropdown menu, anchored below-right of `anchorEl`.
 * @param {object} props
 * @param {HTMLElement|null} props.anchorEl
 * @param {() => void} props.onClose
 * @param {{label: string, icon: string, onClick: () => void, danger?: boolean}[]} props.items
 */
export function Menu({ anchorEl, onClose, items }) {
  if (!anchorEl) return null;
  const rect = anchorEl.getBoundingClientRect();
  const style = {
    top: Math.min(rect.bottom + 4, window.innerHeight - 48 * items.length - 24),
    right: window.innerWidth - rect.right,
  };
  return (
    <>
      <button className="overlay transparent" aria-label="Close menu" onClick={onClose} />
      <div className="menu" style={style} role="menu">
        {items.map((item) => (
          <button
            key={item.label}
            className={`menu-item ${item.danger ? 'danger' : ''}`}
            role="menuitem"
            onClick={() => { onClose(); item.onClick(); }}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}
