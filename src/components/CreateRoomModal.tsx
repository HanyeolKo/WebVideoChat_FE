import { useState } from 'react'
import type { CreateRoomPayload } from '../api/roomApi'
import Modal from './Modal'

interface CreateRoomModalProps {
  onClose: () => void
  onCreate: (payload: CreateRoomPayload) => void
}

const CreateRoomModal = ({ onClose, onCreate }: CreateRoomModalProps) => {
  const [title, setTitle] = useState('')
  const [password, setPassword] = useState('')
  const [passwordCheck, setPasswordCheck] = useState('')
  const [content, setContent] = useState('')

  const passwordMismatch = password !== '' && passwordCheck !== '' && password !== passwordCheck
  const isSubmittable = title !== '' && password !== '' && passwordCheck !== '' && !passwordMismatch

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSubmittable) return
    onCreate({ title, password, content })
  }

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="inline">
          <label>채팅방 이름</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="inline">
          <label>비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="inline">
          <label>비밀번호 확인</label>
          <input type="password" value={passwordCheck} onChange={(e) => setPasswordCheck(e.target.value)} />
          {passwordMismatch && <span className="errorMsg">비밀번호가 일치하지 않습니다.</span>}
        </div>
        <div className="inline">
          <label>주제</label>
          <input type="text" value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <button type="submit" disabled={!isSubmittable}>채팅방 생성</button>
      </form>
    </Modal>
  )
}

export default CreateRoomModal
