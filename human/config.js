// SMA panel on GitHub Pages: where @Human is and how people sign in.
// The client secret is public by design (it ships in this page, as @Human's own web apps do).
// What protects the data: sign-in through @Human, the registered redirect addresses, and the
// panel admitting only people who hold SMA Owner or SMA Reviewer (client sma_panel_web).
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
    mail: '523661136470671361',
    team: '524284653297729537'
  },
  roles: { owner: '523647345800314881', writer: '524284653230620673', reviewer: '523647345833803777', member: '524284653230948353' },
  // Anyone signing in with one of these email domains can join the team as a Member (workflow sma_team_self_join);
  // new accounts are added automatically (sma_team_join). Owners set roles in Settings › Team.
  joinDomains: ['planetcrust.com', 'crust.tech'],
  joinWorkflow: '524285047428087809',
  clientId: '523699086499577857',
  clientSecret: 'sfeQH40gFryVH1g4Z8KGz9i7ezACeabDLBu8SmZFZmPVRf3VJPf43pmowq5jiriB',
  lockMinutes: 2
};
