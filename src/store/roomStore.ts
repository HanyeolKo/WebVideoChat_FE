import { create } from 'zustand'

interface RoomState {
  roomId: string | null
  roomName: string | null
  participantCount: number
  setRoom: (roomId: string, roomName: string, participantCount?: number) => void
  clearRoom: () => void
}

const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  roomName: null,
  participantCount: 0,
  setRoom: (roomId, roomName, participantCount = 0) =>
    set({ roomId, roomName, participantCount }),
  clearRoom: () => set({ roomId: null, roomName: null, participantCount: 0 }),
}))

export default useRoomStore
