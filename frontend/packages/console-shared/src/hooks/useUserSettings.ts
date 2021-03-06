import * as React from 'react';
// FIXME upgrading redux types is causing many errors at this time
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import { useSelector } from 'react-redux';
import { RootState } from '@console/internal/redux';
import { ConfigMapModel } from '@console/internal/models';
import { K8sResourceKind } from '@console/internal/module/k8s';
import { useK8sWatchResource } from '@console/internal/components/utils/k8s-watch-hook';
import { useUserSettingsLocalStorage } from './useUserSettingsLocalStorage';
import {
  createConfigMap,
  deseralizeData,
  seralizeData,
  updateConfigMap,
  USER_SETTING_CONFIGMAP_NAMESPACE,
} from '../utils/user-settings';

const useCounterRef = (initialValue: number = 0): [boolean, () => void, () => void] => {
  const counterRef = React.useRef<number>(initialValue);
  const increment = React.useCallback(() => {
    counterRef.current += 1;
  }, []);
  const decrement = React.useCallback(() => {
    counterRef.current -= 1;
  }, []);
  return [counterRef.current !== initialValue, increment, decrement];
};

export const useUserSettings = <T>(
  key: string,
  defaultValue?: T,
  sync: boolean = false,
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] => {
  const defaultValueRef = React.useRef<T>(defaultValue);
  const keyRef = React.useRef<string>(key);
  const [isRequestPending, increaseRequest, decreaseRequest] = useCounterRef();
  const userUid = useSelector(
    (state: RootState) => state.UI.get('user')?.metadata?.uid ?? 'kubeadmin',
  );
  const configMapResource = React.useMemo(
    () => ({
      kind: ConfigMapModel.kind,
      namespace: USER_SETTING_CONFIGMAP_NAMESPACE,
      isList: false,
      name: `user-settings-${userUid}`,
    }),
    [userUid],
  );
  const [cfData, cfLoaded, cfLoadError] = useK8sWatchResource<K8sResourceKind>(configMapResource);
  const [settings, setSettings] = React.useState<T>();
  const settingsRef = React.useRef<T>(settings);
  settingsRef.current = settings;
  const [loaded, setLoaded] = React.useState(false);

  const [fallbackLocalStorage, setFallbackLocalStorage] = React.useState<boolean>(false);
  const [lsData, setLsDataCallback] = useUserSettingsLocalStorage(
    keyRef.current,
    defaultValueRef.current,
    fallbackLocalStorage,
  );

  React.useEffect(() => {
    if (!fallbackLocalStorage && (cfLoadError || (!cfData && cfLoaded))) {
      (async () => {
        try {
          await createConfigMap();
        } catch (err) {
          if (err?.response?.status === 403) {
            setFallbackLocalStorage(true);
          } else {
            setSettings(defaultValueRef.current);
            setLoaded(true);
          }
        }
      })();
    } else if (
      /**
       * update settings if key is present in config map but data is not equal to settings
       */
      !fallbackLocalStorage &&
      cfData &&
      cfLoaded &&
      cfData.data?.hasOwnProperty(keyRef.current) &&
      seralizeData(settings) !== cfData.data[keyRef.current]
    ) {
      setSettings(deseralizeData(cfData.data[keyRef.current]));
      setLoaded(true);
    } else if (
      /**
       * if key doesn't exist in config map send patch request to add the key with default value
       */
      !fallbackLocalStorage &&
      defaultValueRef.current !== undefined &&
      cfData &&
      cfLoaded &&
      !cfData.data?.hasOwnProperty(keyRef.current)
    ) {
      updateConfigMap(cfData, keyRef.current, seralizeData(defaultValueRef.current));
      setSettings(defaultValueRef.current);
      setLoaded(true);
    } else if (!fallbackLocalStorage && cfLoaded) {
      setSettings(defaultValueRef.current);
      setLoaded(true);
    }
    // This effect should only be run on change of configmap data, status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfLoadError, cfLoaded, fallbackLocalStorage]);

  const callback = React.useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (action: React.SetStateAction<T>) => {
      const previousSettings = settingsRef.current;
      const newState =
        typeof action === 'function' ? (action as (prevState: T) => T)(previousSettings) : action;
      setSettings(newState);
      if (cfLoaded) {
        increaseRequest();
        updateConfigMap(cfData, keyRef.current, seralizeData(newState))
          .then(() => {
            decreaseRequest();
          })
          .catch(() => {
            decreaseRequest();
            setSettings(previousSettings);
          });
      }
    },
    [cfData, cfLoaded, decreaseRequest, increaseRequest],
  );

  const resultedSettings = React.useMemo(() => {
    /**
     * If key is deleted from the config map then return default value
     */
    if (
      sync &&
      cfLoaded &&
      cfData &&
      !cfData.data?.hasOwnProperty(keyRef.current) &&
      settings !== undefined &&
      !isRequestPending
    ) {
      return defaultValueRef.current;
    }
    if (
      sync &&
      !isRequestPending &&
      cfLoaded &&
      cfData &&
      seralizeData(settingsRef.current) !== cfData?.data?.[keyRef.current]
    ) {
      return deseralizeData(cfData?.data?.[keyRef.current]);
    }
    return settings;
  }, [sync, isRequestPending, cfData, cfLoaded, settings]);

  return fallbackLocalStorage
    ? [lsData, setLsDataCallback, true]
    : [resultedSettings, callback, loaded];
};
