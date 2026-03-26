interface Props {
  label: string;
  description?: string;
}

export function Placeholder({ label, description }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '300px', color: 'var(--text-muted)',
      fontSize: '1.1rem', gap: '8px',
    }}>
      <span>{label}</span>
      {description && <span style={{ fontSize: '0.85rem' }}>{description}</span>}
    </div>
  );
}
