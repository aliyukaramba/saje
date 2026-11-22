import type { ReactNode } from "react";

/** The title block used at the top of every admin page: title, one line of context, and optional actions. */
export function AdminPageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="adm-head">
      <div>
        <h1 className="adm-title">{title}</h1>
        {subtitle ? <p className="adm-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="adm-actions">{actions}</div> : null}
    </header>
  );
}
