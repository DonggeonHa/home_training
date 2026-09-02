import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"
import { BrowserLocalStoragePort, type StoragePort } from "../../storage/ports"
import { type AppActions, useAppActionCreators } from "./provider-actions"
import {
  useDisplayPreferencePersistence,
  useStoredStatePersistence,
  useSystemDisplayPreferenceSubscription,
} from "./provider-effects"
import { createAppStoreState, reduceAppStore, toStoredState } from "./reducer"
import type { AppStoreState } from "./types"

export type { ReplaceStoredStateResult } from "./provider-actions"

type AppStoreContextValue = {
  readonly state: AppStoreState
  readonly actions: AppActions
}

const AppStoreContext = createContext<AppStoreContextValue | null>(null)

type AppStoreProviderProps = {
  readonly children: ReactNode
  readonly storage?: StoragePort | undefined
}

export function AppStoreProvider({ children, storage }: AppStoreProviderProps): ReactElement {
  const storageRef = useRef(storage ?? new BrowserLocalStoragePort())
  const [state, dispatch] = useReducer(reduceAppStore, storageRef.current, (initialStorage) =>
    createAppStoreState({ storage: initialStorage }),
  )
  const [initialStoredSnapshot] = useState(() => JSON.stringify(toStoredState(state)))
  const lastSavedSnapshotRef = useRef(initialStoredSnapshot)
  const failedSnapshotRef = useRef<string | null>(null)

  useStoredStatePersistence({
    dispatch,
    failedSnapshotRef,
    lastSavedSnapshotRef,
    state,
    storageRef,
  })
  useDisplayPreferencePersistence(state.display)
  useSystemDisplayPreferenceSubscription(dispatch)

  const actions = useAppActionCreators({
    dispatch,
    failedSnapshotRef,
    lastSavedSnapshotRef,
    state,
    storageRef,
  })
  const value = useMemo(() => ({ state, actions }), [actions, state])

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore(): AppStoreContextValue {
  const value = useContext(AppStoreContext)
  if (value === null) {
    throw new AppStoreProviderError()
  }
  return value
}

class AppStoreProviderError extends Error {
  readonly name = "AppStoreProviderError"

  constructor() {
    super("AppStoreProvider must be mounted before using the app store")
  }
}
