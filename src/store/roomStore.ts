import { create } from 'zustand'

interface RoomState {
  roomId: string | null
  roomName: string | null
  setRoom: (roomId: string, roomName: string) => void
  clearRoom: () => void
}

const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  roomName: null,
  setRoom: (roomId, roomName) => set({ roomId, roomName }),
  clearRoom: () => set({ roomId: null, roomName: null }),
}))

export default useRoomStore
