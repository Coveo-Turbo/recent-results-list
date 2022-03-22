export * from './RecentResultsList';

declare var String: {
  toLocaleString(locale:any): void;
}

String.toLocaleString({
  'en': {
    'RecentResultsList_Title': 'My Recently Opened Docs',
    'RecentResultsList_NoResults': 'Your recently clicked results will appear here'
  }
});