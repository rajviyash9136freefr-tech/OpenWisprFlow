import React, { useMemo } from 'react';
import { HubWindow } from './windows/HubWindow';
import { OverlayWindow } from './windows/OverlayWindow';
import { ScratchpadWindow } from './windows/ScratchpadWindow';
import { MeetingWindow } from './windows/MeetingWindow';

export const App: React.FC = () => {
  const windowType = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('window') || 'hub';
  }, []);

  switch (windowType) {
    case 'overlay':
      return <OverlayWindow />;
    case 'scratchpad':
      return <ScratchpadWindow />;
    case 'meeting':
      return <MeetingWindow />;
    case 'hub':
    default:
      return <HubWindow />;
  }
};
