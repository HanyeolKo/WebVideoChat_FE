import type { RoomSummary } from '../api/roomApi'

interface RoomListProps {
  rooms: RoomSummary[]
  onEnter: (roomId: string) => void
}

const RoomList = ({ rooms, onEnter }: RoomListProps) => {
  if (rooms.length === 0) {
    return <p className="room-empty">생성된 채팅방이 없습니다.</p>
  }

  return (
    <div id="chatRoomList">
      {rooms.map((room) => (
        <div key={room.id} className="chatRoomItem">
          <button onClick={() => onEnter(room.id)}>{room.title}</button>
          {room.content && <span className="roomContent">{room.content}</span>}
        </div>
      ))}
    </div>
  )
}

export default RoomList
