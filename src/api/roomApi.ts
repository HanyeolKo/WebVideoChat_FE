import axiosInstance from './axiosInstance'

export interface RoomSummary {
  id: string
  title: string
  content: string
}

export interface RoomEnterResponse {
  roomId: string
  roomName: string
  participantCount: number
}

export interface CreateRoomPayload {
  title: string
  password: string
  content: string
}

export interface EnterRoomPayload {
  roomId: string
  password: string
}

export const getRooms = (): Promise<RoomSummary[]> =>
  axiosInstance.get<RoomSummary[]>('/api/rooms').then((res) => res.data)

export const createRoom = (payload: CreateRoomPayload): Promise<RoomEnterResponse> =>
  axiosInstance.post<RoomEnterResponse>('/api/rooms', payload).then((res) => res.data)

export const enterRoom = (payload: EnterRoomPayload): Promise<RoomEnterResponse> =>
  axiosInstance.post<RoomEnterResponse>('/api/rooms/enter', payload).then((res) => res.data)
