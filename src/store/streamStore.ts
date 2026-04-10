import { create } from 'zustand'

interface StreamState {
  myStream: MediaStream | null
  muted: boolean
  cameraOff: boolean
  setMyStream: (stream: MediaStream) => void
  clearStream: () => void
  toggleMute: () => void
  toggleCamera: () => void
}

const useStreamStore = create<StreamState>((set) => ({
  myStream: null,
  muted: false,
  cameraOff: false,
  setMyStream: (stream) => set({ myStream: stream }),
  clearStream: () => set({ myStream: null }),
  toggleMute: () => set((state) => ({ muted: !state.muted })),
  toggleCamera: () => set((state) => ({ cameraOff: !state.cameraOff })),
}))

export default useStreamStore
