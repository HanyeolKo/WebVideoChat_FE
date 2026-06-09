import { useState } from 'react'
import Modal from './Modal'

interface EnterRoomModalProps {
  onClose: () => void
  onEnter: (password: string) => void
}

/** 채팅방 입장 시 비밀번호 입력 모달. 기존 prompt() 대체. */
const EnterRoomModal = ({ onClose, onEnter }: EnterRoomModalProps) => {
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === '') return
    onEnter(password)
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="inline">
          <label>비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        <button type="submit" disabled={password === ''}>입장</button>
      </form>
    </Modal>
  )
}

export default EnterRoomModal
