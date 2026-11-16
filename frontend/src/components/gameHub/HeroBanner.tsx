import { useId } from 'react'
import { ArrowUpRight, Coins, Sparkles, Trophy, VolumeX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import catImage from '../../img/cat-logo.webp'

export default function HeroBanner({ onPlay }: { onPlay: () => void }) {
  const { t } = useTranslation('common'), pattern = useId()
  return <section className="gh-hero relative isolate overflow-hidden rounded-3xl px-6 py-8 text-white sm:px-9 sm:py-10">
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]" width="100%" height="100%"><defs><pattern id={pattern} width="80" height="40" patternUnits="userSpaceOnUse"><path d="M-40 40a40 40 0 0180 0 40 40 0 0180 0M-30 40a30 30 0 0160 0m20 0a30 30 0 0160 0M-20 40a20 20 0 0140 0m40 0a20 20 0 0140 0M-10 40a10 10 0 0120 0m60 0a10 10 0 0120 0" fill="none" stroke="white" strokeWidth="1.5" /></pattern></defs><rect width="100%" height="100%" fill={`url(#${pattern})`} /></svg>
    <div className="relative grid items-center gap-6 md:grid-cols-[1.35fr_1fr]">
      <div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] sm:text-xs"><Sparkles size={14} aria-hidden="true" />{t('arcade.featured')}</span>
        <h1 className="mt-5 max-w-xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl xl:text-[44px]">{t('arcade.heroTitle')}<span className="block text-amber-200">{t('arcade.heroAccent')}</span></h1>
        <p className="mt-4 max-w-md text-sm leading-6 text-emerald-50/90">{t('arcade.heroDescription')}</p>
        <button type="button" onClick={onPlay} className="gh-cta mt-6 inline-flex flex-wrap min-h-[48px] items-center justify-center gap-3 rounded-full bg-[#F59E0B] px-6 py-3 text-sm font-extrabold text-[#342206] shadow-lg shadow-black/10 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"><span className="whitespace-nowrap">{t('arcade.heroPlay')}</span><span className="inline-flex items-center gap-1 whitespace-nowrap border-l border-amber-800/20 pl-3 text-xs"><Coins size={15} aria-hidden="true" />{t('arcade.heroReward')}</span><ArrowUpRight size={17} aria-hidden="true" /></button>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-emerald-50/80"><span className="inline-flex items-center gap-1.5"><Trophy size={13} aria-hidden="true" />{t('arcade.localRecords')}</span><span className="inline-flex items-center gap-1.5"><VolumeX size={13} aria-hidden="true" />{t('arcade.noSound')}</span></div>
      </div>
      <div className="gh-scene relative mx-auto flex w-full max-w-[310px] flex-col items-center pb-1 md:pt-7">
        <div className="gh-speech relative z-10 self-end rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-center text-sm font-semibold leading-5 text-[#0F5132] shadow-lg">{t('arcade.catMessage')}<span aria-hidden="true" className="absolute -bottom-2 left-7 h-4 w-4 rotate-45 bg-white" /></div>
        <div className="gh-cat-stage relative mt-4"><div aria-hidden="true" className="absolute inset-3 rounded-full border border-white/15 bg-white/10" /><span aria-hidden="true" className="gh-float absolute -left-7 top-12 -rotate-12 rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-2xl font-bold">漢</span><span aria-hidden="true" className="gh-orbit-kana absolute -right-6 bottom-12 rotate-12 rounded-2xl bg-amber-200 px-3 py-2 text-lg font-extrabold text-[#0F5132]">あ</span><img src={catImage} alt={t('arcade.mascotAlt')} className="gh-mascot relative z-10 h-44 w-44 object-contain sm:h-52 sm:w-52" width={224} height={224} /></div>
        <div aria-hidden="true" className="gh-shadow mt-1 h-3 w-32 rounded-full bg-black/10" />
      </div>
    </div>
  </section>
}
