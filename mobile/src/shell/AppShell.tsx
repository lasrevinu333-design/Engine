import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  HashRouter,
  MemoryRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router';
import type { EditionDefinition, RuntimePorts, ShellRoute } from './core/types';
import {
  handoffToLegacy,
  resolveHardwareBackAction,
} from './core/legacy-handoff';
import { ShellProviders } from './providers/shell-providers';
import { useAuth } from './providers/auth';
import { useDeepLinks } from './providers/deep-links';
import { useDeviceIdentity } from './providers/device';
import { useNetwork } from './providers/network';
import { useRelease } from './providers/release';

interface ShellAppProps {
  definition: EditionDefinition;
  runtime: RuntimePorts;
}

const initialShellRequest = (() => {
  const search = new URLSearchParams(window.location.search);
  return (typeof __MZ_SHELL_PROOF__ !== 'undefined' && __MZ_SHELL_PROOF__)
    || search.get('shell') === 'stay'
    || search.get('shell') === 'proof'
    || window.location.hash.startsWith('#/');
})();

function shouldRemainInShell(): boolean {
  return initialShellRequest;
}

function selectedRoute(definition: EditionDefinition, pathname: string): ShellRoute {
  return definition.routes.find((route) => route.path === pathname)
    ?? definition.routes.find((route) => route.id === definition.homeRouteId)
    ?? definition.routes[0];
}

function custodialSetupTarget(definition: EditionDefinition): string {
  return definition.routes.find((route) => route.id === 'custodial.setup')?.legacyTarget
    ?? './index.html?setup=1';
}

function RouteView({
  definition,
  route,
  onBack,
}: {
  definition: EditionDefinition;
  route: ShellRoute;
  onBack: () => void;
}) {
  const device = useDeviceIdentity();
  const auth = useAuth();
  const network = useNetwork();
  const release = useRelease();
  const home = route.id === definition.homeRouteId;
  const custodialSetupRequired = definition.edition === 'custodial' && auth.state !== 'enrolled';
  const handoffTarget = custodialSetupRequired
    ? custodialSetupTarget(definition)
    : route.legacyTarget;

  return (
    <section className="shellRoute" aria-labelledby="route-title">
      <div className="routeToolbar">
        {!home && (
          <button className="shellBack" type="button" onClick={onBack}>
            Back
          </button>
        )}
        <span className={`networkState ${network.connected ? 'online' : 'offline'}`} role="status">
          {network.connected ? 'Connected' : 'Offline'}
        </span>
      </div>
      <div className="routeHero">
        <p className="eyebrow">Migration-safe shell route</p>
        <h1 id="route-title">{route.label}</h1>
        <p>{route.description}</p>
      </div>
      <div className="handoffCard">
        <div>
          <strong>Current production module</strong>
          <p>This route hands off to the existing page while its replacement is built and verified.</p>
        </div>
        <button
          className="primaryAction"
          type="button"
          data-testid="legacy-handoff"
          onClick={() => handoffToLegacy(
            handoffTarget,
            definition.edition,
            custodialSetupRequired ? '' : device.canonicalId,
          )}
        >
          {custodialSetupRequired ? 'Open phone setup' : `Open ${route.shortLabel}`}
        </button>
      </div>
      <dl className="shellFacts" aria-label="Shell status">
        <div><dt>Edition</dt><dd>{definition.edition}</dd></div>
        <div><dt>Access</dt><dd>{auth.state}</dd></div>
        <div><dt>Device</dt><dd>{device.configured ? device.canonicalId : 'Not configured'}</dd></div>
        <div><dt>Build</dt><dd>{release.buildId}</dd></div>
      </dl>
      {device.conflicts.length > 0 && (
        <p className="identityWarning" role="status">
          Device identity conflict detected. The enrolled or stored assignment remains authoritative.
        </p>
      )}
    </section>
  );
}

function ShellRouterContent({
  definition,
  runtime,
}: ShellAppProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const device = useDeviceIdentity();
  const deepLinks = useDeepLinks();
  const handledSequence = useRef(0);
  const current = selectedRoute(definition, location.pathname);
  const homePath = selectedRoute(definition, '/').path;
  const navigationRoutes = useMemo(
    () => definition.routes.filter((route) => route.navigation),
    [definition],
  );
  const returnFromDetail = useCallback(() => {
    const browserHistoryIndex = Number(window.history.state?.idx ?? 0);
    if (runtime.platform === 'capacitor' || browserHistoryIndex > 0) navigate(-1);
    else navigate(homePath, { replace: true });
  }, [homePath, navigate, runtime.platform]);

  useEffect(() => {
    if (!deepLinks.ready || handledSequence.current === deepLinks.sequence) return;
    handledSequence.current = deepLinks.sequence;
    if (deepLinks.resolution?.kind === 'shell') {
      navigate(deepLinks.resolution.path);
    } else if (deepLinks.resolution?.kind === 'legacy') {
      const setupRequired = definition.edition === 'custodial' && auth.state !== 'enrolled';
      const target = setupRequired
        ? custodialSetupTarget(definition)
        : deepLinks.resolution.target;
      handoffToLegacy(
        target,
        definition.edition,
        setupRequired ? '' : device.canonicalId,
        true,
      );
    }
  }, [auth.state, deepLinks, definition, device.canonicalId, navigate]);

  useEffect(() => {
    if (!deepLinks.ready || deepLinks.sequence > 0 || shouldRemainInShell()) return;
    const home = definition.routes.find((route) => route.id === definition.homeRouteId);
    if (!home) return;
    const setupRequired = definition.edition === 'custodial' && auth.state !== 'enrolled';
    handoffToLegacy(
      setupRequired ? custodialSetupTarget(definition) : home.legacyTarget,
      definition.edition,
      setupRequired ? '' : device.canonicalId,
      true,
    );
  }, [auth.state, deepLinks.ready, deepLinks.sequence, definition, device.canonicalId]);

  useEffect(() => {
    let active = true;
    let remove = () => {};
    void runtime.deepLinks.addBackListener(() => {
      if (!active) return;
      const action = resolveHardwareBackAction(current.id, definition.homeRouteId);
      if (action === 'pop') returnFromDetail();
      else void runtime.deepLinks.handleRootBack(definition.edition);
    }).then((listener) => {
      remove = () => void listener.remove();
      if (!active) remove();
    });
    return () => {
      active = false;
      remove();
    };
  }, [current.id, definition.edition, definition.homeRouteId, returnFromDetail, runtime]);

  return (
    <div
      className={`shellFrame edition-${definition.edition}`}
      data-edition={definition.edition}
      data-role-marker={definition.roleMarker}
    >
      <header className="shellHeader">
        <img src="./Zoo_Logo_ui.webp" alt="Memphis Zoo" width="64" height="64" />
        <div>
          <p className="eyebrow">Living Field Guide foundation</p>
          <strong>{definition.title}</strong>
          <span>{definition.subtitle}</span>
        </div>
      </header>
      <main className="shellMain">
        <Routes>
          {definition.routes.map((route) => (
            <Route
              key={route.id}
              path={route.path}
              element={<RouteView definition={definition} route={route} onBack={returnFromDetail} />}
            />
          ))}
          <Route
            path="*"
            element={<Navigate replace to={selectedRoute(definition, '/').path} />}
          />
        </Routes>
      </main>
      <nav className="shellNavigation" aria-label={`${definition.title} navigation`}>
        {navigationRoutes.map((route) => (
          <NavLink key={route.id} to={route.path}>
            <span>{route.shortLabel}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function ShellApp({ definition, runtime }: ShellAppProps) {
  const homePath = definition.routes.find((route) => route.id === definition.homeRouteId)?.path ?? '/';
  const content = (
    <ShellProviders definition={definition} runtime={runtime}>
      <ShellRouterContent definition={definition} runtime={runtime} />
    </ShellProviders>
  );
  return runtime.platform === 'capacitor'
    ? <MemoryRouter initialEntries={[homePath]}>{content}</MemoryRouter>
    : <HashRouter>{content}</HashRouter>;
}
