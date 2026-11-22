// SMA panel on GitHub Pages: where @Human is and how people sign in.
// The client secret is public by design (it ships in this page, as @Human's own web apps do).
// What protects the data: sign-in through @Human, the registered redirect addresses, and the
// sma_panel client keeping only the SMA Owner and SMA Reviewer roles.
window.SMA_HUMAN = {
  baseUrl: 'https://20219-qc.cortezaproject.org',
  namespaceId: '523644426145955841',
  modules: {
    account: '523646339184132097',
    media: '523646439713341441',
    post: '523646540141756417',
    note: '523646942727831553',
    event: '523646942996070401',
    invite: '523646943180619777',
    mail: '523661136470671361'
  },
  roles: { owner: '523647345800314881', reviewer: '523647345833803777' },
  clientId: '523696770941714433',
  clientSecret: 'DmFaaHRvMuXTW9JHqnpR6hcKXnhRwCBJYzkTLYzse65GhgG5iwLWkYT8yG6eh7ET',
  lockMinutes: 2
};
