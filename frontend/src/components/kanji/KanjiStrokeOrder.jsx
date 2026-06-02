import { KANJIVG_VIEW_BOX } from '../../utils/kanjiStrokeData'
import { useQuery } from 'react-query'
import { kanjiDataAPI } from '../../services/api'

export default function KanjiStrokeOrder({ kanji, strokes: providedStrokes, step, viewBox: providedViewBox = KANJIVG_VIEW_BOX, strokeOrder }) {
  const strokeOrderQuery = useQuery(
    ['kanjiStrokeOrderComponent', kanji],
    () => kanjiDataAPI.getStrokeOrder(kanji).then((response) => response.data),
    {
      enabled: Boolean(kanji) && !strokeOrder && !providedStrokes,
      staleTime: 1000 * 60 * 60 * 24,
      retry: false,
    }
  )
  const data = strokeOrder || strokeOrderQuery.data
  const strokes = providedStrokes || data?.strokes || []
  const viewBox = data?.viewBox || providedViewBox

  if (!strokes?.length) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-3xl border border-violet-100 bg-white p-5">
        <div className="max-w-md text-center">
          <p className="font-japanese text-7xl font-bold text-gray-300">{kanji}</p>
          <p className="mt-5 text-base font-bold text-gray-950">{data?.message || 'Stroke order data is not available for this Kanji.'}</p>
          <p className="mt-2 text-sm leading-6 text-gray-500">No fallback drawing is shown because unverified stroke paths would be misleading.</p>
        </div>
      </div>
    )
  }

  const visible = strokes.slice(0, step)

  return (
    <div className="grid min-h-[420px] place-items-center rounded-3xl border border-violet-100 bg-white p-5">
      <svg className="h-full max-h-[420px] w-full max-w-[420px]" viewBox={viewBox} role="img" aria-label={`${kanji} stroke order from KanjiVG`}>
        <rect x="0" y="0" width="109" height="109" fill="white" />
        <path d="M0,0 H109 M0,54.5 H109 M0,109 H109 M0,0 V109 M54.5,0 V109 M109,0 V109" stroke="#F3E8FF" strokeWidth="0.5" fill="none" />
        {strokes.map((stroke, index) => (
          <path
            key={`shape-${stroke.path}-${index}`}
            d={stroke.path}
            stroke="#D1D5DB"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {visible.map((stroke, index) => (
          <path
            key={`active-${stroke.path}-${index}`}
            d={stroke.path}
            stroke={index === visible.length - 1 ? '#7C4DFF' : '#111827'}
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </svg>
    </div>
  )
}
