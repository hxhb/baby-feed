'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { 
  Baby, 
  PlusCircle, 
  Trash2, 
  Edit2,
  X
} from 'lucide-react'

interface BabyInfo {
  id: string
  name: string
  birthDate: string
  gender: string
  createdAt: string
}

interface Props {
  userName: string
}

export default function SettingsComponent({ userName }: Props) {
  const [babies, setBabies] = useState<BabyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingBaby, setEditingBaby] = useState<BabyInfo | null>(null)
  
  // 表单数据
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE')

  useEffect(() => {
    fetchBabies()
  }, [])

  const fetchBabies = async () => {
    try {
      const response = await fetch('/api/babies')
      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data)) {
          setBabies(data)
        } else {
          setBabies([])
        }
      }
    } catch (error) {
      console.error('获取婴儿列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddBaby = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name || !birthDate) {
      alert('请填写完整信息')
      return
    }

    try {
      const response = await fetch('/api/babies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, birthDate, gender })
      })

      if (response.ok) {
        setShowAddModal(false)
        resetForm()
        fetchBabies()
      } else {
        const error = await response.json()
        alert(error.error || '添加失败')
      }
    } catch (error) {
      console.error('添加失败:', error)
      alert('添加失败，请重试')
    }
  }

  const handleUpdateBaby = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingBaby || !name || !birthDate) {
      return
    }

    try {
      const response = await fetch(`/api/babies/${editingBaby.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, birthDate, gender })
      })

      if (response.ok) {
        setEditingBaby(null)
        resetForm()
        fetchBabies()
      } else {
        const error = await response.json()
        alert(error.error || '更新失败')
      }
    } catch (error) {
      console.error('更新失败:', error)
      alert('更新失败，请重试')
    }
  }

  const handleDeleteBaby = async (id: string) => {
    if (!confirm('确定要删除这个宝宝吗？所有相关记录也会被删除。')) return

    try {
      const response = await fetch(`/api/babies/${id}`, { method: 'DELETE' })
      
      if (response.ok) {
        fetchBabies()
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  const resetForm = () => {
    setName('')
    setBirthDate('')
    setGender('MALE')
  }

  const openEditModal = (baby: BabyInfo) => {
    setEditingBaby(baby)
    setName(baby.name)
    setBirthDate(format(new Date(baby.birthDate), 'yyyy-MM-dd'))
    setGender(baby.gender as 'MALE' | 'FEMALE')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* 用户信息 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4">用户信息</h2>
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-xl">👤</span>
          </div>
          <div>
            <p className="font-medium text-gray-900">{userName}</p>
            <p className="text-sm text-gray-500">用户</p>
          </div>
        </div>
      </div>

      {/* 宝宝管理 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">宝宝管理</h2>
          <button
            onClick={() => {
              resetForm()
              setShowAddModal(true)
            }}
            className="flex items-center text-blue-600 hover:text-blue-700 transition"
          >
            <PlusCircle size={20} className="mr-1" />
            添加宝宝
          </button>
        </div>

        {babies.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Baby size={48} className="mx-auto mb-2 text-gray-300" />
            <p>还没有添加宝宝</p>
          </div>
        ) : (
          <div className="space-y-3">
            {babies.map(baby => (
              <div
                key={baby.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-100 to-blue-100 rounded-full flex items-center justify-center">
                    <Baby size={24} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{baby.name}</p>
                    <p className="text-sm text-gray-500">
                      {baby.gender === 'MALE' ? '👦 男宝' : '👧 女宝'} · 
                      {format(new Date(baby.birthDate), 'yyyy年MM月dd日出生', { locale: zhCN })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEditModal(baby)}
                    className="p-2 text-gray-400 hover:text-blue-600 transition"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteBaby(baby.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加宝宝弹窗 */}
      {(showAddModal || editingBaby) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingBaby ? '编辑宝宝' : '添加宝宝'}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setEditingBaby(null)
                  resetForm()
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={editingBaby ? handleUpdateBaby : handleAddBaby} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  宝宝姓名
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="请输入宝宝姓名"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  出生日期
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  性别
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGender('MALE')}
                    className={`flex items-center justify-center p-3 rounded-lg border-2 transition ${
                      gender === 'MALE'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    👦 男宝
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('FEMALE')}
                    className={`flex items-center justify-center p-3 rounded-lg border-2 transition ${
                      gender === 'FEMALE'
                        ? 'border-pink-500 bg-pink-50 text-pink-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    👧 女宝
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                {editingBaby ? '保存修改' : '添加宝宝'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
