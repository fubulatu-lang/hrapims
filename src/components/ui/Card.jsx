import { Icon } from './Icon';

/**
 * @param {object} props
 * @param {'default'|'elevated'|'outlined'} [props.variant='default']
 * @param {React.ElementType} [props.as='div']
 * @example <Card variant="elevated"><CardTitle icon="badge">Personal Information</CardTitle>...</Card>
 */
export function Card({ variant = 'default', as: Component = 'div', className = '', children, ...rest }) {
  const variantClass = variant === 'elevated' ? 'elevated' : variant === 'outlined' ? 'outlined' : '';
  return (
    <Component className={`card ${variantClass} ${className}`} {...rest}>
      {children}
    </Component>
  );
}

/** @example <CardTitle icon="medical_information">Medical</CardTitle> */
export function CardTitle({ icon, children }) {
  return (
    <div className="card-title">
      {icon && <Icon name={icon} />}
      {children}
    </div>
  );
}
