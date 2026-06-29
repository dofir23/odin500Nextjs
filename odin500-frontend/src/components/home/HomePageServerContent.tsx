import { HomePageBody } from './HomePageBody';
import { HomePageHeader } from './HomePageHeader';

/** Server HTML mirror — plain anchors, no client nav handler (see HomeInstantNav on client). */
export function HomePageServerContent() {
  return (
    <div className="home-page">
      <HomePageHeader />
      <HomePageBody />
    </div>
  );
}
