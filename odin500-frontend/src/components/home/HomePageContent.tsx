import { HomePageBody } from './HomePageBody';
import { HomePageHeader } from './HomePageHeader';
import { HomeInstantNav } from './HomeInstantNav';

export function HomePageContent() {
  return (
    <HomeInstantNav>
      <HomePageHeader />
      <HomePageBody />
    </HomeInstantNav>
  );
}
