import {useDB} from '@/lib/db-provider';

/**
 * The signed-in user's profile. It comes from DBProvider, which keeps the last profile
 * on the device, so roles still work when the app starts without a connection.
 */
export function useCurrentUser() {
  const {currentUser} = useDB();
  return {data: currentUser ?? undefined};
}
