/**
 * Single Centralized Branding File for Open Wispr
 * Modify values here to rename or rebrand the entire application in one place.
 */

export const BRANDING = {
  // App Naming
  appName: 'Open Wispr',
  productName: 'Open Wispr',
  companyName: 'Open Wispr Community',
  author: 'Clean Room Open Source Project',
  version: '1.0.6',
  description: 'Open Wispr — Free, Private & Open-Source AI Voice Dictation with Zero Login',

  // Window Titles
  hubTitle: 'Open Wispr — Hub',
  overlayTitle: 'Open Wispr Flow Bar',
  scratchpadTitle: 'Open Wispr Scratchpad',
  meetingTitle: 'Open Wispr Meeting Recorder',

  // System Tray
  trayTooltip: 'Open Wispr — Voice Dictation',
  trayDefaultAction: 'Hold Caps Lock / Ctrl to Speak',

  // UI Tags and Badges
  brandBadge: 'Open',
  versionString: 'Open Wispr v1.0.6',
  tagline: 'Universal voice-typing for any app',

  // Storage and Path Keys
  appId: 'com.openwispr.voice',
  storageKey: 'openwispr-state',

  // Assets Paths
  iconPath: 'assets/icon.png',
  icoPath: 'assets/icon.ico',
  logoSvgPath: 'assets/logo.svg',
} as const;

export type BrandingConfig = typeof BRANDING;
