/**
 * Sticky top app bar, used at the head of every page for a consistent
 * title/navigation/actions pattern.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.leading] - typically a <BackButton /> or nothing
 * @param {React.ReactNode} [props.trailing] - typically one or two <IconButton />s
 *
 * @example <TopBar title="Patients" subtitle="128 records" trailing={<IconButton icon="tune" label="Filter" />} />
 */
export function TopBar({ title, subtitle, leading, trailing }) {
  return (
    <div className="topbar">
      {leading}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 className="topbar-title" style={{ paddingLeft: leading ? 0 : 8 }}>{title}</h1>
        {subtitle && <span className="topbar-sub" style={{ paddingLeft: leading ? 0 : 8 }}>{subtitle}</span>}
      </div>
      {trailing}
    </div>
  );
}
