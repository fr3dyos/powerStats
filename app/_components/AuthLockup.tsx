type Props = {
  title: string;
  subtitle?: string;
};

export function AuthLockup({ title, subtitle }: Props) {
  return (
    <div className="ps-auth__lockup">
      <span className="badge" aria-hidden="true">
        PS
      </span>
      <span className="wordmark">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </span>
    </div>
  );
}
