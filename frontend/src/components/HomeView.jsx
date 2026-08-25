import { ArrowRight, Rocket, TriangleAlert } from 'lucide-react';
import ActivitySection from './ActivitySection.jsx';
import CountersSection from './CountersSection.jsx';

export default function HomeView({ overview, activity, onNavigate }) {
  const setupComplete = (overview.missingConfig ?? []).length === 0;

  return (
    <>
      {setupComplete ? (
        <div className="hero-banner">
          <div className="icon-wrap" aria-hidden="true">
            <Rocket size={22} />
          </div>
          <div>
            <strong>Your automation is live</strong>
            <span>
              Comments and DMs are being answered automatically
              {overview.database === 'mongodb' ? ' · history saved to MongoDB' : ''}.
            </span>
          </div>
        </div>
      ) : (
        <div className="hero-banner warn-banner">
          <div className="icon-wrap" aria-hidden="true">
            <TriangleAlert size={22} />
          </div>
          <div>
            <strong>Almost there — finish setup</strong>
            <span>{(overview.missingConfig ?? []).length} setting(s) still missing.</span>
          </div>
          <button type="button" className="banner-cta" onClick={() => onNavigate('setup')}>
            Go to setup
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <CountersSection counters={overview.counters} />

      <ActivitySection
        entries={activity}
        persistent={overview.database === 'mongodb'}
        limit={5}
        onViewAll={() => onNavigate('activity')}
      />
    </>
  );
}
