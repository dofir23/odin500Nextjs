import '@/styles/home-page.css';
import { HomePageBody } from './HomePageBody';
import { HomePageHeaderServer } from './HomePageHeaderServer';

/** Full marketing homepage as static HTML — visible with JavaScript disabled. */
export function HomePageServerContent() {
  return (
    <div className="home-page">
      <HomePageHeaderServer />
      <HomePageBody />
    </div>
  );
}
