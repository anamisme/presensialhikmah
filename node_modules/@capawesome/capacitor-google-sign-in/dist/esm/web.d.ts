import { WebPlugin } from '@capacitor/core';
import type { GoogleSignInPlugin, InitializeOptions, SignInOptions, SignInResult } from './definitions';
export declare class GoogleSignInWeb extends WebPlugin implements GoogleSignInPlugin {
    private clientId;
    private redirectUrl;
    private scopes;
    handleRedirectCallback(): Promise<SignInResult>;
    initialize(options: InitializeOptions): Promise<void>;
    signIn(options?: SignInOptions): Promise<SignInResult>;
    signOut(): Promise<void>;
    private decodeJwtPayload;
    private generateRandomString;
}
