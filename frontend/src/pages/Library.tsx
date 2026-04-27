import { useState } from 'react'
import { useQuery } from 'react-query'
import { useForm } from 'react-hook-form'
import { 
  Library as LibraryIcon, 
  Search, 
  BookOpen, 
  Tag, 
  Calendar,
  ExternalLink,
  Loader2
} from 'lucide-react'
import { libraryAPI } from '../services/api'
import { formatDate } from '../utils/helpers'
import LoadingSpinner from '../components/LoadingSpinner'

interface Document {
  id: number
  title: string
  content: string
  document_type: string
  jlpt_level?: string
  tags: string[]
  source_url?: string
  created_at: string
}

interface SearchFormData {
  query: string
  document_type: string
  jlpt_level: string
}

export default function Library() {
  const [searchResults, setSearchResults] = useState<Document[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const searchForm = useForm<SearchFormData>({
    defaultValues: {
      document_type: '',
      jlpt_level: '',
    }
  })

  const { data: documents, isLoading: isLoadingDocuments } = useQuery(
    ['documents'],
    () => libraryAPI.getDocuments().then(res => res.data),
    {
      refetchOnWindowFocus: false,
    }
  )

  const { data: categories } = useQuery(
    ['categories'],
    () => libraryAPI.getCategories().then(res => res.data),
    {
      refetchOnWindowFocus: false,
    }
  )

  const { data: stats } = useQuery(
    ['libraryStats'],
    () => libraryAPI.getStats().then(res => res.data),
    {
      refetchOnWindowFocus: false,
    }
  )

  const handleSearch = async (data: SearchFormData) => {
    if (!data.query.trim()) return
    
    setIsSearching(true)
    try {
      const response = await libraryAPI.searchDocuments(
        data.query,
        data.document_type || undefined,
        data.jlpt_level || undefined
      )
      setSearchResults(response.data.documents)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const clearSearch = () => {
    setSearchResults([])
    searchForm.reset()
  }

  const displayDocuments = searchResults.length > 0 ? searchResults : documents || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
          <LibraryIcon className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Learning Library</h1>
          <p className="text-sm text-gray-600 mt-1">
            Browse and search Japanese learning materials
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
            <div className="card-content">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Total Documents</p>
                  <p className="text-2xl font-bold text-orange-900">{stats.total_documents}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
            <div className="card-content">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Tag className="h-6 w-6 text-amber-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Document Types</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {Object.keys(stats.documents_by_type).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
            <div className="card-content">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Calendar className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">JLPT Levels</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {Object.keys(stats.documents_by_jlpt).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
            <div className="card-content">
              <div className="flex items-center">
                <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Search className="h-6 w-6 text-amber-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Vector Chunks</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {stats.vector_db_stats?.total_documents || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card bg-white border border-orange-100 rounded-2xl shadow-md hover:shadow-lg transition-shadow">
        <div className="card-header border-b border-orange-100">
          <h2 className="card-title text-orange-900">Search Documents</h2>
          <p className="card-description text-gray-600">
            Find specific learning materials using semantic search
          </p>
        </div>
        <div className="card-content">
          <form onSubmit={searchForm.handleSubmit(handleSearch)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="query" className="block text-sm font-semibold text-gray-700 mb-2">
                  Search Query
                </label>
                <input
                  {...searchForm.register('query', { required: 'Search query is required' })}
                  type="text"
                  className="input w-full border-orange-200 focus:ring-orange-300 bg-orange-50"
                  placeholder="Search for topics, grammar, vocabulary..."
                />
              </div>
              
              <div>
                <label htmlFor="document_type" className="block text-sm font-semibold text-gray-700 mb-2">
                  Document Type
                </label>
                <select
                  {...searchForm.register('document_type')}
                  className="input w-full border-orange-200 focus:ring-orange-300 bg-orange-50"
                >
                  <option value="">All Types</option>
                  {categories?.document_types.map((type: string) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="jlpt_level" className="block text-sm font-semibold text-gray-700 mb-2">
                  JLPT Level
                </label>
                <select
                  {...searchForm.register('jlpt_level')}
                  className="input w-full border-orange-200 focus:ring-orange-300 bg-orange-50"
                >
                  <option value="">All Levels</option>
                  {categories?.jlpt_levels_ordered.map((level: string) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <button
                type="submit"
                disabled={isSearching || !searchForm.watch('query')?.trim()}
                className="btn btn-primary bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold shadow-md hover:shadow-lg transition-all"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </button>
              
              {searchResults.length > 0 && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="btn btn-outline border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold"
                >
                  Clear Search
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Documents List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {searchResults.length > 0 ? 'Search Results' : 'All Documents'}
          </h2>
          <span className="text-sm text-gray-500">
            {displayDocuments.length} document{displayDocuments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {isLoadingDocuments ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : displayDocuments.length === 0 ? (
          <div className="card bg-white border border-orange-100 rounded-2xl shadow-md">
            <div className="card-content">
              <div className="text-center py-12 text-gray-500">
                <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
                  <LibraryIcon className="h-8 w-8 text-orange-400" />
                </div>
                <p className="text-lg font-semibold text-gray-700">No documents found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchResults.length > 0 
                    ? 'Try adjusting your search criteria'
                    : 'No documents available yet'
                  }
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayDocuments.map((document: Document) => (
              <div key={document.id} className="card bg-white border border-orange-100 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className="card-header border-b border-orange-100">
                  <div className="flex items-start justify-between">
                    <h3 className="card-title text-lg text-orange-900">{document.title}</h3>
                    {document.source_url && (
                      <a
                        href={document.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:text-orange-600 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <p className="card-description text-gray-600 font-medium">
                    {document.document_type.charAt(0).toUpperCase() + document.document_type.slice(1)}
                  </p>
                </div>
                
                <div className="card-content">
                  <p className="text-sm text-gray-700 mb-4 line-clamp-3 font-medium">
                    {document.content.substring(0, 150)}...
                  </p>
                  
                  <div className="space-y-3">
                    {document.jlpt_level && (
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-gray-600">Level:</span>
                        <span className="inline-block px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                          {document.jlpt_level}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-3 w-3 text-orange-400" />
                      <span className="text-xs text-gray-600 font-medium">
                        {formatDate(document.created_at)}
                      </span>
                    </div>
                    
                    {document.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {document.tags.slice(0, 3).map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800"
                          >
                            {tag}
                          </span>
                        ))}
                        {document.tags.length > 3 && (
                          <span className="text-xs text-gray-600 font-medium">
                            +{document.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

