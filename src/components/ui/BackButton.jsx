import { IconButton } from './IconButton';

/** @example <TopBar title="Edit Patient" leading={<BackButton onClick={() => navigate('detail')} />} /> */
export function BackButton({ onClick }) {
  return <IconButton icon="arrow_back" label="Go back" onClick={onClick} />;
}
