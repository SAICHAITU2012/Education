import { useEffect } from 'react';
import { Layout } from './components/Layout.js';
import { useRoute } from './route.js';
import { useApp } from './store.js';
import { Onboarding } from './screens/Onboarding.js';
import { Home } from './screens/Home.js';
import { Practice } from './screens/Practice.js';
import { Review } from './screens/Review.js';
import { Feedback } from './screens/Feedback.js';
import { Mastery } from './screens/Mastery.js';
import { Cohort } from './screens/Cohort.js';
import { Settings } from './screens/Settings.js';
import { Landing } from './screens/Landing.js';
import { ThemeStudio } from './screens/ThemeStudio.js';

export function App() {
  const { profile, navigate } = useApp();
  const route = useRoute();

  useEffect(() => {
    if (route.path === '/landing') return; // landing is always reachable
    if (!profile && route.path !== '/onboarding') navigate('/onboarding');
    if (profile && route.path === '/onboarding') navigate('/home');
  }, [profile, route.path, navigate]);

  if (route.path === '/landing') return <Landing />;

  if (!profile) {
    return (
      <>
        <div className="sky-orbs" aria-hidden="true"><i /><i /><i /></div>
        <Onboarding />
      </>
    );
  }

  if (route.path === '/practice') return <Practice />;
  if (route.path === '/review') return <Review />;

  let screen;
  switch (route.path) {
    case '/mastery':
      screen = <Mastery />;
      break;
    case '/cohort':
      screen = <Cohort />;
      break;
    case '/settings':
      screen = <Settings />;
      break;
    case '/themes':
      screen = <ThemeStudio />;
      break;
    case '/feedback':
      screen = <Feedback />;
      break;
    case '/home':
    default:
      screen = <Home />;
  }

  return (
    <Layout>
      <div className="sky-orbs" aria-hidden="true"><i /><i /><i /></div>
      {screen}
    </Layout>
  );
}
