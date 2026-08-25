import { House, Inbox, LogOut, Settings, Zap } from 'lucide-react';
import BrandGlyph from './BrandGlyph.jsx';

export const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: House },
  { id: 'activity', label: 'Activity', icon: Inbox },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'setup', label: 'Setup', icon: Settings },
];

export default function Sidebar({ view, onNavigate, onDisconnect }) {
  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <BrandGlyph size={20} />
        </div>
        <div className="brand-name">
          IG Automation
          <small>Admin dashboard</small>
        </div>
      </div>

      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = view === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-item ${active ? 'active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <Icon size={18} aria-hidden="true" />
            {item.label}
          </button>
        );
      })}

      <div className="sidebar-foot">
        <button type="button" className="nav-item" onClick={onDisconnect}>
          <LogOut size={18} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </nav>
  );
}
