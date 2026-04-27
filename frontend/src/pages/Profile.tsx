import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from 'react-query'
import { 
  User, 
  Save, 
  Loader2, 
  Target, 
  Trophy,
  BookOpen,
  MessageCircle
} from 'lucide-react'
import { authAPI } from '../services/api'
import { useAuth } from '../services/auth'
import { formatDate, getJLPTDescription } from '../utils/helpers'
import toast from 'react-hot-toast'

interface ProfileFormData {
  username: string
  current_jlpt_level: string
  learning_goals: string[]
}

const JLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

export default function Profile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [newGoal, setNewGoal] = useState('')

  const form = useForm<ProfileFormData>({
    defaultValues: {
      username: user?.username || '',
      current_jlpt_level: user?.current_jlpt_level || 'N5',
      learning_goals: user?.learning_goals || [],
    }
  })

  const updateProfileMutation = useMutation(
    (data: ProfileFormData) => authAPI.updateMe(data).then(res => res.data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['auth'])
        toast.success('Profile updated successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.detail || 'Failed to update profile')
      },
    }
  )

  const handleSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data)
  }

  const addGoal = () => {
    if (!newGoal.trim()) return
    
    const currentGoals = form.getValues('learning_goals')
    if (currentGoals.includes(newGoal.trim())) {
      toast.error('This goal already exists')
      return
    }
    
    form.setValue('learning_goals', [...currentGoals, newGoal.trim()])
    setNewGoal('')
  }

  const removeGoal = (index: number) => {
    const currentGoals = form.getValues('learning_goals')
    form.setValue('learning_goals', currentGoals.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
          <User className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Profile</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your account settings and learning preferences
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Form */}
        <div className="lg:col-span-2">
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
            <div className="card-header border-b border-orange-100">
              <h2 className="card-title text-orange-900">Account Information</h2>
              <p className="card-description text-gray-600">
                Update your profile information and learning preferences
              </p>
            </div>
            <div className="card-content">
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="input w-full bg-gray-100 border-gray-300 text-gray-600"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Email cannot be changed
                  </p>
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    {...form.register('username', {
                      required: 'Username is required',
                      minLength: { value: 3, message: 'Username must be at least 3 characters' },
                      maxLength: { value: 20, message: 'Username must be less than 20 characters' },
                      pattern: {
                        value: /^[a-zA-Z0-9_]+$/,
                        message: 'Username can only contain letters, numbers, and underscores'
                      }
                    })}
                    type="text"
                    className="input w-full border-orange-200 focus:ring-orange-300 bg-orange-50"
                    placeholder="Enter your username"
                  />
                  {form.formState.errors.username && (
                    <p className="mt-1 text-sm text-red-600 font-medium">
                      {form.formState.errors.username.message}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="current_jlpt_level" className="block text-sm font-semibold text-gray-700 mb-2">
                    Current JLPT Level
                  </label>
                  <select
                    {...form.register('current_jlpt_level', { required: 'JLPT level is required' })}
                    className="input w-full border-orange-200 focus:ring-orange-300 bg-orange-50"
                  >
                    {JLPT_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level} - {getJLPTDescription(level)}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.current_jlpt_level && (
                    <p className="mt-1 text-sm text-red-600 font-medium">
                      {form.formState.errors.current_jlpt_level.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Learning Goals
                  </label>
                  <div className="space-y-3">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        placeholder="Add a learning goal..."
                        className="input flex-1 border-orange-200 focus:ring-orange-300 bg-orange-50"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addGoal())}
                      />
                      <button
                        type="button"
                        onClick={addGoal}
                        className="btn btn-outline border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold"
                        disabled={!newGoal.trim()}
                      >
                        Add
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {form.watch('learning_goals').map((goal, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-lg">
                          <span className="text-sm text-gray-800 font-medium">{goal}</span>
                          <button
                            type="button"
                            onClick={() => removeGoal(index)}
                            className="text-red-500 hover:text-red-700 font-bold transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updateProfileMutation.isLoading}
                  className="btn btn-primary w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  {updateProfileMutation.isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Profile Stats */}
        <div className="space-y-6">
          {/* Account Info */}
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
            <div className="card-header border-b border-orange-100">
              <h3 className="card-title text-orange-900">Account Information</h3>
            </div>
            <div className="card-content space-y-4">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
                  <span className="text-lg font-bold text-white">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{user?.username}</p>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                </div>
              </div>
              
              <div className="space-y-3 pt-2 border-t border-orange-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Member since</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {user?.created_at ? formatDate(user.created_at) : 'N/A'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Current Level</span>
                  <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-semibold">
                    {user?.current_jlpt_level}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Learning Goals</span>
                  <span className="text-sm font-semibold text-gray-900 bg-amber-100 px-2 py-1 rounded">
                    {user?.learning_goals?.length || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Learning Progress */}
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
            <div className="card-header border-b border-orange-100">
              <h3 className="card-title text-orange-900">Learning Progress</h3>
            </div>
            <div className="card-content space-y-4">
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <Trophy className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">JLPT Level</p>
                  <p className="text-xs text-gray-600">
                    {user?.current_jlpt_level} - {getJLPTDescription(user?.current_jlpt_level || 'N5')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <Target className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Learning Goals</p>
                  <p className="text-xs text-gray-600">
                    {user?.learning_goals?.length || 0} goal{(user?.learning_goals?.length || 0) !== 1 ? 's' : ''} set
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <MessageCircle className="h-8 w-8 text-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Chat Sessions</p>
                  <p className="text-xs text-gray-600">Track your conversations</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <BookOpen className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Study Materials</p>
                  <p className="text-xs text-gray-600">Access learning library</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
            <div className="card-header border-b border-orange-100">
              <h3 className="card-title text-orange-900">Quick Actions</h3>
            </div>
            <div className="card-content space-y-2">
              <button className="w-full btn btn-outline btn-sm border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold transition-colors">
                Export Learning Data
              </button>
              <button className="w-full btn btn-outline btn-sm border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold transition-colors">
                Reset Progress
              </button>
              <button className="w-full btn btn-outline btn-sm border-red-300 text-red-600 hover:bg-red-50 font-semibold transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

