import {getAuth} from "firebase/auth"
import {getDatabase, onDisconnect, onValue, ref, set} from "firebase/database"
import {doc, getFirestore, serverTimestamp, setDoc} from "firebase/firestore"
import {serverTimestamp as serverTimestampRT} from "@firebase/database"

export const presenseObserver = () => {
    const uid = getAuth().currentUser?.uid

    if (uid) {
        const database = getDatabase()
        const firebase = getFirestore()

        // Create a reference to this user's specific status node.
        // This is where we will store data about being online/offline.
        const userStatusDatabaseRef = ref(database, 'status/' + uid)
        // ...
        const userStatusFirestoreRef  = doc(firebase, 'status', uid)

        // We'll create two constants which we will write to
        // the Realtime database when this device is offline
        // or online.
        const isOfflineForDatabase = {
            state: 'offline',
            last_changed: serverTimestampRT(),
        }

        const isOnlineForDatabase = {
            state: 'online',
            last_changed: serverTimestampRT(),
        }

        // Firestore uses a different server timestamp value, so we'll
        // create two more constants for Firestore state.
        const isOfflineForFirestore = {
            state: 'offline',
            last_changed: serverTimestamp(),
        };

        const isOnlineForFirestore = {
            state: 'online',
            last_changed: serverTimestamp(),
        };

        // Create a reference to the special '.info/connected' path in
        // Realtime Database. This path returns `true` when connected
        // and `false`
        onValue(ref(database, '.info/connected'), async (snapshot) => {
            if (snapshot.val() === false) {
                // Instead of simply returning, we'll also set Firestore's state
                // to 'offline'. This ensures that our Firestore cache is aware
                // of the switch to 'offline.'
                await setDoc(userStatusFirestoreRef, isOfflineForFirestore)
                return
            }

            // If we are currently connected, then use the 'onDisconnect()'
            // method to add a set which will only trigger once this
            // client has disconnected by closing the app,
            // losing internet, or any other means.
            onDisconnect(userStatusDatabaseRef)
                .set(isOfflineForDatabase)
                .then(async function() { await setDoc(userStatusFirestoreRef, isOfflineForFirestore) })
                .then(async function () {
                        // The promise returned from .onDisconnect().set() will
                        // resolve as soon as the server acknowledges the onDisconnect()
                        // request, NOT once we've actually disconnected:
                        // https://firebase.google.com/docs/reference/js/database.ondisconnect
                        // https://firebase.google.com/docs/database/web/offline-capabilities

                        // We can now safely set ourselves as 'online' knowing that the
                        // server will mark us as offline once we lose connection.
                        await set(ref(database, 'status/' + uid), isOnlineForDatabase)

                        // We'll also add Firestore set here for when we come online.
                        await setDoc(userStatusFirestoreRef, isOnlineForFirestore)
                    }
                )
        })

        const functions = require('firebase-functions')
    } else {
        console.error('presenceObserver: no uid')
    }
}