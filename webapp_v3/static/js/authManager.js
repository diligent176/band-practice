/**
 * Band Practice Pro v3 - Auth Manager
 * Handles Firebase authentication and authorization
 */

const AuthManager = {
    auth: null,
    ui: null,
    currentUser: null,
    idToken: null,
    authStateCallCount: 0,

    /**
     * Initialize Firebase Auth with configuration from template
     * @param {Object} firebaseConfig - Firebase configuration object
     */
    init(firebaseConfig) {
        console.log('🔥 Using Firebase Auth');
        console.log('🔥 Firebase config:', firebaseConfig);
        console.log('🔥 Step 1: Initializing Firebase...');

        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        console.log('🔥 Step 2: Firebase initialized');

        this.auth = firebase.auth();
        console.log('🔥 Step 3: Auth instance created');

        // Set persistence to LOCAL for redirect flow
        this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(() => {
            console.log('🔥 Step 4: Persistence set to LOCAL');
        }).catch((error) => {
            console.error('❌ Failed to set persistence:', error);
        });

        // Setup FirebaseUI
        this.setupFirebaseUI();

        // Setup auth state listener
        this.setupAuthStateListener();

        console.log('🔥 Step 8: onAuthStateChanged listener registered');
    },

    /**
     * Setup FirebaseUI configuration
     */
    setupFirebaseUI() {
        const uiConfig = {
            signInFlow: 'popup',
            signInOptions: [
                {
                    provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                    customParameters: {
                        prompt: 'select_account'
                    }
                }
            ],
            callbacks: {
                signInSuccessWithAuthResult: (authResult) => {
                    console.log('✅✅✅ SIGN IN SUCCESS CALLBACK FIRED ✅✅✅');
                    console.log('📧 User email:', authResult.user.email);
                    console.log('🆔 User uid:', authResult.user.uid);
                    console.log('✅ Email verified:', authResult.user.emailVerified);
                    console.log('👤 Full user object:', authResult.user);
                    console.log('🔐 Credential:', authResult.credential);
                    console.log('📝 Additional user info:', authResult.additionalUserInfo);
                    console.log('🔄 Auth successful - onAuthStateChanged will handle UI');
                    return false;
                },
                signInFailure: (error) => {
                    console.error('❌❌❌ SIGN IN FAILURE ❌❌❌');
                    console.error('Error code:', error.code);
                    console.error('Error message:', error.message);
                    console.error('Full error:', error);
                    return Promise.resolve();
                },
                uiShown: () => {
                    console.log('🎨 FirebaseUI widget shown');
                }
            }
        };

        console.log('🔥 Step 5: Creating FirebaseUI instance...');
        this.ui = new firebaseui.auth.AuthUI(this.auth);
        console.log('🔥 Step 6: FirebaseUI created');
    },

    /**
     * Setup auth state change listener
     */
    setupAuthStateListener() {
        console.log('🔥 Step 7: Setting up onAuthStateChanged listener...');
        
        this.auth.onAuthStateChanged(async (user) => {
            this.authStateCallCount++;
            console.log('🔐🔐🔐 AUTH STATE CHANGED CALLBACK FIRED (Call #' + this.authStateCallCount + ') 🔐🔐🔐');
            console.log('📍 Current URL:', window.location.href);
            console.log('📍 Has URL params?', window.location.search);
            console.log('User object:', user);
            console.log('User email:', user ? user.email : 'NULL');
            console.log('User emailVerified:', user ? user.emailVerified : 'N/A');
            console.log('User uid:', user ? user.uid : 'N/A');

            // DEBUG: Check if user was signed in before
            if (!user && this.currentUser) {
                console.error('🚨🚨🚨 USER WAS SIGNED IN BUT NOW IS NULL 🚨🚨🚨');
                console.error('Previous user:', this.currentUser.email);
                console.error('This means Firebase signed the user out!');
            }

            if (user) {
                await this.handleSignedInUser(user);
            } else {
                await this.handleSignedOutUser();
            }
        });
    },

    /**
     * Handle signed-in user
     */
    async handleSignedInUser(user) {
        console.log('✅ USER IS SIGNED IN');
        try {
            console.log('📝 Step A: Getting ID token...');
            this.idToken = await user.getIdToken();
            console.log('✅ Step B: Got ID token (first 50 chars):', this.idToken.substring(0, 50));
            this.currentUser = user;

            // Check if user is allowed by making a test API call
            console.log('🌐 Step C: About to call /api/v3/auth/login with Authorization header...');
            console.log('Authorization header will be:', `Bearer ${this.idToken.substring(0, 50)}...`);

            const response = await fetch('/api/v3/auth/login', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.idToken}`
                }
            });

            console.log('📥 Step D: /api/v3/auth/login response received. Status:', response.status);

            if (response.ok) {
                // User is authorized
                console.log('✅✅✅ USER AUTHORIZED ✅✅✅');
                console.log('User email:', user.email);
                console.log('Step E: Hiding auth gate, showing main app');
                
                document.getElementById('auth-gate').style.display = 'none';
                document.getElementById('main-app').style.display = 'block';

                // Update logout button tooltips with username
                const logoutButtons = [
                    document.getElementById('signout-btn'),
                    document.getElementById('songs-logout-btn'),
                    document.getElementById('player-logout-btn')
                ];
                logoutButtons.forEach(btn => {
                    if (btn) btn.title = `Logout ${user.email}`;
                });

                // Make current user available globally
                window.currentUser = user;

                // Initialize ViewManager for SPA navigation
                ViewManager.init();

                // Trigger app initialization (collections loading)
                if (typeof window.onAuthSuccess === 'function') {
                    window.onAuthSuccess();
                }
            } else {
                // User not authorized
                const errorText = await response.text();
                console.error('❌❌❌ AUTHORIZATION FAILED ❌❌❌');
                console.error('Response status:', response.status);
                console.error('Response body:', errorText);
                console.error('User email:', user.email);
                console.error('ID token (first 50 chars):', this.idToken.substring(0, 50));
                
                document.getElementById('auth-error').textContent =
                    'You are not authorized to access this application. Contact the admin.';
                document.getElementById('auth-error').style.display = 'block';
                await this.auth.signOut();
            }
        } catch (error) {
            console.error('💥💥💥 ERROR DURING AUTHENTICATION 💥💥💥');
            console.error('Error:', error);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            
            document.getElementById('auth-error').textContent = 'Authentication error. Please try again.';
            document.getElementById('auth-error').style.display = 'block';
        }
    },

    /**
     * Handle signed-out user
     */
    async handleSignedOutUser() {
        console.log('👋👋👋 USER IS NULL - SIGNED OUT 👋👋👋');
        console.log('🔍 Checking localStorage for auth data...');
        console.log('localStorage keys:', Object.keys(localStorage));
        console.log('firebase:authUser keys:', Object.keys(localStorage).filter(k => k.includes('firebase')));

        // Check if we're returning from OAuth redirect
        const urlParams = new URLSearchParams(window.location.search);
        console.log('🔍 URL params:', Array.from(urlParams.entries()));

        console.log('Step X: Hiding main app, showing auth gate');
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('auth-gate').style.display = 'block';

        // Check if FirebaseUI is already rendered
        const authContainer = document.getElementById('firebaseui-auth-container');
        console.log('🔍 Auth container children:', authContainer.children.length);

        if (authContainer.children.length === 0) {
            console.log('Step Y: Starting FirebaseUI...');
            this.ui.start('#firebaseui-auth-container', this.getUIConfig());
            console.log('Step Z: FirebaseUI started');
        } else {
            console.log('⚠️ FirebaseUI already rendered, not starting again');
        }
    },

    /**
     * Get UI config (needed for delayed start)
     */
    getUIConfig() {
        return {
            signInFlow: 'popup',
            signInOptions: [
                {
                    provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
                    customParameters: {
                        prompt: 'select_account'
                    }
                }
            ],
            callbacks: {
                signInSuccessWithAuthResult: () => false,
                signInFailure: (error) => {
                    console.error('Sign in failure:', error);
                    return Promise.resolve();
                },
                uiShown: () => {
                    console.log('🎨 FirebaseUI widget shown');
                }
            }
        };
    },

    /**
     * Sign out current user
     */
    async signOut() {
        await this.auth.signOut();
    },

    /**
     * Get current ID token
     */
    getIdToken() {
        return this.idToken;
    }
};

// Export for global use
window.AuthManager = AuthManager;
