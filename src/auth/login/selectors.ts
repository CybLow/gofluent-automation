export const selectors = {
  samlDomainInput: '#outlined-size-normal, input[type="text"]',
  samlSubmit: 'button[type="submit"], input[type="submit"]',
  msEmailInput: '#i0116, input[type="email"]',
  msPasswordInput: '#i0118',
  msSignInBtn: '#idSIButton9, input[type="submit"], button[type="submit"]',
  msStaySignedIn: '#KmsiCheckboxField, input[name="DontShowAgain"]',
  msStaySignedInAccept: '#idSIButton9, #acceptButton',
  msMfaTitle: '#idDiv_SAOTCS_Title',
  msMfaDisplaySign: '#idRichContext_DisplaySign, #displaySign',
};

export const patterns = {
  approveAuthenticatorText: /Approve a request on.*Authenticator/i,
  waitingAuthenticatorText: /Open your Authenticator app|waiting for|approve the sign.?in|Authenticator app and (tap|approve)/i,
  credErrorText: /Your account or password is incorrect|account or password/i,
  samlConnectorUrl: /portal\.gofluent\.com\/login\/samlconnector/i,
  dashboardPath: /\/app\/(?!login|samlconnector|oauth|saml|callback)/i,
};
