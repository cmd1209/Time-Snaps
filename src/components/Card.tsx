import { PropsWithChildren, ReactNode } from 'react';

interface CardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function Card({ title, subtitle, actions, children }: CardProps) {
  return (
    <section className="card">
      <div className="card__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
