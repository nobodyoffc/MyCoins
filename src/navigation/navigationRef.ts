import {createNavigationContainerRef} from '@react-navigation/native';

/**
 * Shared navigation ref so components rendered outside the
 * NavigationContainer (e.g. the floating avatar) can trigger navigation.
 */
export const navigationRef = createNavigationContainerRef();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    // @ts-expect-error - dynamic route name/params from outside the navigator tree
    navigationRef.navigate(name, params);
  }
}
