import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { NotificationSnapshot, RuntimePorts } from '../core/types';
import { createRequiredContext } from './context';

const [NotificationsContext, useNotifications] =
  createRequiredContext<NotificationSnapshot>('Notifications');

export function NotificationsProvider({
  runtime,
  children,
}: PropsWithChildren<{ runtime: RuntimePorts }>) {
  const [snapshot, setSnapshot] = useState<NotificationSnapshot>({
    supported: false,
    permission: 'unavailable',
  });
  useEffect(() => {
    let active = true;
    void runtime.notifications.install()
      .then(() => runtime.notifications.read())
      .then((next) => {
        if (active) setSnapshot(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [runtime]);
  return <NotificationsContext.Provider value={snapshot}>{children}</NotificationsContext.Provider>;
}

export { useNotifications };
