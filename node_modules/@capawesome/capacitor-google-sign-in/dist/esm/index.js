import { registerPlugin } from '@capacitor/core';
const GoogleSignIn = registerPlugin('GoogleSignIn', {
    web: () => import('./web').then(m => new m.GoogleSignInWeb()),
});
export * from './definitions';
export { GoogleSignIn };
//# sourceMappingURL=index.js.map