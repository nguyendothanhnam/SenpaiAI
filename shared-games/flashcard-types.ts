import type { StudyQuestion, StudyResponse } from './flashcard-study'
export interface CardProgress {state:'new'|'learning'|'mastered';stage:number;due_at:string|null;correct:number;wrong:number;last_reviewed_at:string|null;starred:boolean}
export interface FlashCard {id?:number;deck_id?:number;front:string;back:string;reading:string;note:string;progress?:CardProgress}
export interface DeckStats {total:number;mastered:number;mastered_percent:number;last_studied_at:string|null;new?:number;learning?:number;correct?:number;wrong?:number;accuracy?:number;due_today?:number;review_streak?:number}
export interface Deck {id:number;title:string;description:string;jlpt_level:string|null;topic:string;updated_at:string;stats:DeckStats;cards:FlashCard[]}
export interface DeckInput {title:string;description:string;jlpt_level:string|null;topic:string;cards:FlashCard[]}
export interface ReviewPayload {request_id:string;mode:'flip';duration_seconds:number;results:{card_id:number;correct:boolean}[]}
export interface TextPreview {cards:FlashCard[];errors:{line:number;code:string}[]}
export interface AssessmentResult {total:number;correct:number;wrong:number;accuracy:number;questions:{question_id:string;correct:boolean;answer:unknown;expected:unknown;reading:string}[]}
export interface Assessment {id:string;deck_id:number;mode:'learn'|'test';status:'active'|'completed'|'abandoned';questions:StudyQuestion[];result:AssessmentResult|null}
export interface AssessmentPayload {request_id:string;deck_id:number;mode:'learn'|'test';count:number;types:string[];round_index:number}
export interface AssessmentSubmission {duration_seconds:number;answers:StudyResponse[]}
export interface HistoryItem {id:string;deck_id:number;mode:string;created_at:string;total:number;correct:number;wrong:number;accuracy:number}
