import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createRoom, enterRoom, getRooms, type RoomSummary } from '../api/roomApi'
import CreateRoomModal from '../components/CreateRoomModal'
import EnterRoomModal from '../components/EnterRoomModal'
import RoomList from '../components/RoomList'
import useRoomStore from '../store/roomStore'
import '../styles/login.css'

const LoginPage = () => {
  const navigate = useNavigate()
  const { setRoom } = useRoomStore()

  const [rooms, setRooms] = useState<RoomSummary[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [enterTargetRoomId, setEnterTargetRoomId] = useState<string | null>(null)

  const fetchRooms = useCallback(async () => {
    try {
      const data = await getRooms()
      setRooms(data)
    } catch {
      console.error('채팅방 목록 조회 실패')
    }
  }, [])

  useEffect(() => {
    fetchRooms()
  }, [fetchRooms])

  const handleCreate = async (payload: { title: string; password: string; content: string }) => {
    try {
      const res = await createRoom(payload)
      setRoom(res.roomId, res.roomName, res.participantCount)
      navigate(`/room/${res.roomId}`)
    } catch {
      alert('채팅방 생성에 실패했습니다.')
    }
  }

  const handleEnterRequest = (roomId: string) => {
    setEnterTargetRoomId(roomId)
  }

  const handleEnterConfirm = async (password: string) => {
    if (!enterTargetRoomId) return
    try {
      const res = await enterRoom({ roomId: enterTargetRoomId, password })
      setRoom(res.roomId, res.roomName, res.participantCount)
      navigate(`/room/${res.roomId}`)
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } }).response?.status
      if (status === 401) {
        alert('비밀번호가 일치하지 않습니다.')
      } else if (status === 404) {
        alert('채팅방을 찾을 수 없습니다.')
      } else {
        alert('입장에 실패했습니다.')
      }
    } finally {
      setEnterTargetRoomId(null)
    }
  }

  return (
    <div className="login-page">
      <h1>웹 화상 채팅</h1>
      <p className="login-sub">
        링크 하나로 시작하는 실시간 화상 대화. 방을 만들거나 골라서 바로 입장하세요.
      </p>

      <RoomList rooms={rooms} onEnter={handleEnterRequest} />

      <button id="createRoom" onClick={() => setShowCreateModal(true)}>
        채팅방 생성
      </button>

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}

      {enterTargetRoomId && (
        <EnterRoomModal
          onClose={() => setEnterTargetRoomId(null)}
          onEnter={handleEnterConfirm}
        />
      )}
    </div>
  )
}

export default LoginPage
